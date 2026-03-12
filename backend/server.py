#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import secrets
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
FRONTEND_DIST_DIR = PROJECT_ROOT / "frontend" / "dist"
USER_DATA_DIR = BACKEND_DIR / "userdata"
SHARE_STORE_PATH = USER_DATA_DIR / "snapshots.json"
LEGACY_SHARE_STORE_PATH = BACKEND_DIR / "shares" / "snapshots.json"
DATASET_PATHS = {
    "ndss-2026": BACKEND_DIR / "data" / "ndss2026" / "ndss-2026.json",
    "chi-2026": BACKEND_DIR / "data" / "chi2026" / "chi-2026.json",
}
DEFAULT_SHARE_TTL_DAYS = 7
MAX_SHARE_TTL_DAYS = 90
MAX_REQUEST_SIZE = 5 * 1024 * 1024
SHARE_ID_RE = re.compile(r"^[A-Za-z0-9_-]{8,40}$")
VALID_ENTITY_TYPES = {"paper", "session", "custom"}
DEFAULT_CONFERENCE_TIMEZONE = "America/Los_Angeles"
_CONFERENCE_TIMEZONE_CACHE: Dict[str, str] = {}


class ShareValidationError(ValueError):
    pass


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_iso_datetime(raw: Any, *, field_name: str) -> datetime:
    text = str(raw or "").strip()
    if not text:
        raise ShareValidationError(f"{field_name} is required.")
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ShareValidationError(f"{field_name} must be ISO datetime.") from exc
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def to_iso_local(value: datetime) -> str:
    return value.replace(microsecond=0, tzinfo=None).isoformat(timespec="seconds")


def get_zoneinfo(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo(DEFAULT_CONFERENCE_TIMEZONE)


def resolve_conference_timezone(conference_id: str, raw_timezone: Any) -> str:
    explicit_timezone = clean_text(raw_timezone, max_len=120)
    if explicit_timezone:
        return explicit_timezone

    if conference_id in _CONFERENCE_TIMEZONE_CACHE:
        return _CONFERENCE_TIMEZONE_CACHE[conference_id]

    timezone_name = DEFAULT_CONFERENCE_TIMEZONE
    dataset_path = DATASET_PATHS.get(conference_id)
    if dataset_path and dataset_path.exists():
        try:
            parsed = json.loads(dataset_path.read_text(encoding="utf-8"))
            conference = parsed.get("conference") if isinstance(parsed, dict) else {}
            timezone_name = clean_text((conference or {}).get("timezone"), max_len=120) or timezone_name
        except (OSError, json.JSONDecodeError):
            pass

    _CONFERENCE_TIMEZONE_CACHE[conference_id] = timezone_name
    return timezone_name


def clean_text(value: Any, *, max_len: int = 2000) -> str:
    return str(value or "").strip()[:max_len]


def clean_url(value: Any) -> str:
    text = clean_text(value, max_len=2000)
    if not text:
        return ""
    parsed = urlparse(text)
    if parsed.scheme in {"http", "https"} and parsed.netloc:
        return text
    return ""


def generate_share_id(existing: Dict[str, Dict[str, Any]]) -> str:
    for _ in range(32):
        candidate = secrets.token_urlsafe(8).replace("-", "").replace("_", "")[:12]
        if len(candidate) < 8:
            continue
        if candidate in existing:
            continue
        return candidate
    raise RuntimeError("Could not allocate unique share ID.")


def normalize_expiry(payload: Dict[str, Any], now: datetime) -> datetime:
    raw_expiry = payload.get("expiresAt")
    if raw_expiry:
        expires_at = parse_iso_datetime(raw_expiry, field_name="expiresAt")
    else:
        expires_at = now + timedelta(days=DEFAULT_SHARE_TTL_DAYS)
    if expires_at <= now:
        raise ShareValidationError("expiresAt must be in the future.")
    if expires_at > now + timedelta(days=MAX_SHARE_TTL_DAYS):
        raise ShareValidationError(f"expiresAt cannot be more than {MAX_SHARE_TTL_DAYS} days from now.")
    return expires_at


def parse_event_datetime(raw: Any, *, field_name: str, conference_timezone: str) -> datetime:
    text = str(raw or "").strip()
    if not text:
        raise ShareValidationError(f"{field_name} is required.")
    normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
    try:
        dt = datetime.fromisoformat(normalized)
    except ValueError as exc:
        raise ShareValidationError(f"{field_name} must be ISO datetime.") from exc

    if dt.tzinfo is None:
        return dt.replace(microsecond=0)
    return dt.astimezone(get_zoneinfo(conference_timezone)).replace(tzinfo=None, microsecond=0)


def normalize_events(raw_events: Any, *, conference_timezone: str) -> List[Dict[str, Any]]:
    if not isinstance(raw_events, list):
        raise ShareValidationError("events must be an array.")
    if not raw_events:
        raise ShareValidationError("events must include at least one event.")

    normalized: List[Dict[str, Any]] = []
    for index, raw_event in enumerate(raw_events):
        if not isinstance(raw_event, dict):
            raise ShareValidationError(f"events[{index}] must be an object.")

        entity_type = clean_text(raw_event.get("entityType"), max_len=40).lower()
        if entity_type not in VALID_ENTITY_TYPES:
            raise ShareValidationError(f"events[{index}].entityType is invalid.")

        title = clean_text(raw_event.get("title"), max_len=280)
        if not title:
            raise ShareValidationError(f"events[{index}].title is required.")

        start = parse_event_datetime(
            raw_event.get("start"), field_name=f"events[{index}].start", conference_timezone=conference_timezone
        )
        end = parse_event_datetime(
            raw_event.get("end"), field_name=f"events[{index}].end", conference_timezone=conference_timezone
        )
        if end <= start:
            raise ShareValidationError(f"events[{index}] end must be after start.")

        source_event_id = clean_text(raw_event.get("sourceEventId"), max_len=180)
        if not source_event_id:
            source_event_id = f"{entity_type}:{index + 1}"

        links_raw = raw_event.get("links")
        links = links_raw if isinstance(links_raw, dict) else {}
        raw_sort_order = raw_event.get("sortOrder", index)
        try:
            sort_order = int(raw_sort_order)
        except (TypeError, ValueError) as exc:
            raise ShareValidationError(f"events[{index}].sortOrder must be an integer.") from exc

        event: Dict[str, Any] = {
            "sourceEventId": source_event_id,
            "entityType": entity_type,
            "title": title,
            "start": to_iso_local(start),
            "end": to_iso_local(end),
            "location": clean_text(raw_event.get("location"), max_len=280),
            "description": clean_text(raw_event.get("description"), max_len=8000),
            "sessionTitle": clean_text(raw_event.get("sessionTitle"), max_len=280),
            "links": {
                "paperUrl": clean_url(links.get("paperUrl")),
                "detailsUrl": clean_url(links.get("detailsUrl")),
            },
            "sortOrder": sort_order,
        }

        notes = clean_text(raw_event.get("notes"), max_len=8000)
        if notes:
            event["notes"] = notes
        normalized.append(event)

    normalized.sort(key=lambda item: (item.get("sortOrder", 0), item["start"], item["title"]))
    for index, event in enumerate(normalized):
        event["sortOrder"] = index
    return normalized


@dataclass
class ShareLookup:
    status: str
    snapshot: Dict[str, Any] | None


class ShareStore:
    def __init__(self, path: Path, legacy_path: Path | None = None):
        self.path = path
        self.legacy_path = legacy_path
        self._lock = threading.Lock()
        self._shares: Dict[str, Dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists() and self.legacy_path and self.legacy_path.exists():
            try:
                self.path.write_text(self.legacy_path.read_text(encoding="utf-8"), encoding="utf-8")
            except OSError:
                pass
        if not self.path.exists():
            self._write({})
            return
        try:
            parsed = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            parsed = {}
        if not isinstance(parsed, dict):
            parsed = {}
        shares = parsed.get("shares")
        self._shares = shares if isinstance(shares, dict) else {}

    def _write(self, shares: Dict[str, Dict[str, Any]]) -> None:
        payload = {"version": 1, "shares": shares}
        self.path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def create_snapshot(self, payload: Dict[str, Any], base_url: str) -> Dict[str, Any]:
        now = now_utc()
        conference_id = clean_text(payload.get("conferenceId"), max_len=120)
        if not conference_id:
            raise ShareValidationError("conferenceId is required.")
        conference_timezone = resolve_conference_timezone(conference_id, payload.get("conferenceTimezone"))
        share_name = clean_text(payload.get("shareName"), max_len=180)
        if not share_name:
            share_name = f"{conference_id} shared schedule"

        events = normalize_events(payload.get("events"), conference_timezone=conference_timezone)
        expires_at = normalize_expiry(payload, now)

        snapshot = {
            "version": clean_text(payload.get("version"), max_len=40) or "1",
            "shareName": share_name,
            "conferenceId": conference_id,
            "conferenceTimezone": conference_timezone,
            "createdAt": to_iso_utc(now),
            "expiresAt": to_iso_utc(expires_at),
            "events": events,
        }

        with self._lock:
            share_id = generate_share_id(self._shares)
            self._shares[share_id] = snapshot
            self._write(self._shares)

        return {
            "shareId": share_id,
            "shareUrl": f"{base_url}/s/{share_id}",
            "shareName": snapshot["shareName"],
            "expiresAt": snapshot["expiresAt"],
        }

    def get_snapshot(self, share_id: str) -> ShareLookup:
        if not SHARE_ID_RE.match(share_id):
            return ShareLookup(status="missing", snapshot=None)

        with self._lock:
            snapshot = self._shares.get(share_id)
            if not snapshot:
                return ShareLookup(status="missing", snapshot=None)

        expires_at = parse_iso_datetime(snapshot.get("expiresAt"), field_name="expiresAt")
        if now_utc() >= expires_at:
            return ShareLookup(status="expired", snapshot=snapshot)
        return ShareLookup(status="active", snapshot=snapshot)


class ConferencePlannerHandler(SimpleHTTPRequestHandler):
    store = ShareStore(SHARE_STORE_PATH, LEGACY_SHARE_STORE_PATH)

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, directory=str(FRONTEND_DIST_DIR), **kwargs)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path.startswith("/api/datasets/"):
            dataset_id = path[len("/api/datasets/") :].strip("/")
            self._handle_get_dataset(dataset_id)
            return
        if path.startswith("/api/shares/"):
            share_id = path[len("/api/shares/") :].strip("/")
            self._handle_get_share(share_id)
            return
        if path in {"/", "/index.html"}:
            self.path = "/index.html"
            return super().do_GET()
        if path in {"/planner", "/planner/", "/planner.html"}:
            self.path = "/planner.html"
            return super().do_GET()
        if path.startswith("/s/") and len(path.split("/")) >= 3:
            self.path = "/share.html"
            return super().do_GET()
        super().do_GET()

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/shares":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Not found"})
            return
        self._handle_create_share()

    def _handle_create_share(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0") or "0")
        if content_length <= 0:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Request body is required."})
            return
        if content_length > MAX_REQUEST_SIZE:
            self._send_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"error": "Request body is too large."})
            return

        try:
            raw = self.rfile.read(content_length)
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON body."})
            return

        if not isinstance(payload, dict):
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": "JSON body must be an object."})
            return

        try:
            created = self.store.create_snapshot(payload, self._base_url())
        except ShareValidationError as exc:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return
        except Exception:
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Failed to create share link."})
            return

        self._send_json(HTTPStatus.CREATED, created)

    def _handle_get_share(self, share_id: str) -> None:
        lookup = self.store.get_snapshot(share_id)
        if lookup.status == "missing":
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Share link not found."})
            return
        if lookup.status == "expired":
            self._send_json(
                HTTPStatus.GONE,
                {"error": "Share link expired.", "expiresAt": lookup.snapshot.get("expiresAt")},
            )
            return
        self._send_json(HTTPStatus.OK, lookup.snapshot or {})

    def _handle_get_dataset(self, dataset_id: str) -> None:
        path = DATASET_PATHS.get(dataset_id)
        if not path or not path.exists():
            self._send_json(HTTPStatus.NOT_FOUND, {"error": "Dataset not found."})
            return
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": "Failed to read dataset."})
            return
        self._send_json(HTTPStatus.OK, payload)

    def _base_url(self) -> str:
        scheme = self.headers.get("X-Forwarded-Proto")
        if not scheme:
            scheme = "https" if getattr(self.server, "server_port", 80) == 443 else "http"
        scheme = scheme.split(",", 1)[0].strip()

        host = self.headers.get("X-Forwarded-Host") or self.headers.get("Host")
        if not host:
            host = f"{self.server.server_address[0]}:{self.server.server_address[1]}"
        host = host.split(",", 1)[0].strip()
        return f"{scheme}://{host}"

    def _send_json(self, status: HTTPStatus, payload: Dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Conference Planner local server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    return parser.parse_args()


def main() -> None:
    if not FRONTEND_DIST_DIR.exists():
        raise SystemExit(
            f"Frontend build not found at {FRONTEND_DIST_DIR}. Run `npm install` and `npm run build` inside frontend/ first."
        )
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), ConferencePlannerHandler)
    print(f"Serving Conference Planner at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
