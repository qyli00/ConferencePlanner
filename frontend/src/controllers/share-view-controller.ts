// @ts-nocheck
import { normalizeSharedEventDateTime, resolveConferenceTimeZone } from "./time-utils";

const shareEl = {};

function resolveShareElements() {
  Object.assign(shareEl, {
    openPlannerBtn: document.getElementById("openPlannerBtn"),
    shareTitle: document.getElementById("shareTitle"),
    shareSubtitle: document.getElementById("shareSubtitle"),
    shareMetaText: document.getElementById("shareMetaText"),
    shareStatusMessage: document.getElementById("shareStatusMessage"),
    shareImportHint: document.getElementById("shareImportHint"),
    shareEventContainer: document.getElementById("shareEventContainer"),
  });
}

function assertShareElements() {
  const missing = Object.entries(shareEl)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length) {
    throw new Error(`Share view DOM not ready: missing ${missing.join(", ")}`);
  }
}

let initialized = false;

export async function initShareView() {
  if (initialized) return;
  resolveShareElements();
  assertShareElements();
  initialized = true;
  const shareId = getShareIdFromPath();
  if (!shareId) {
    showError("Invalid share link.");
    return;
  }

  try {
    const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, { cache: "no-store" });
    if (response.status === 404) {
      showError("This shared link does not exist.");
      return;
    }
    if (response.status === 410) {
      const body = await response.json().catch(() => ({}));
      const expiryText = body?.expiresAt ? ` It expired on ${fmtDateTime(body.expiresAt)}.` : "";
      showError(`This shared link has expired.${expiryText}`);
      return;
    }
    if (!response.ok) {
      showError(`Failed to load share link (HTTP ${response.status}).`);
      return;
    }

    const payload = await response.json();
    renderShare(payload, shareId);
  } catch (error) {
    showError(`Failed to load share link: ${error.message}`);
  }
}

function getShareIdFromPath() {
  const match = window.location.pathname.match(/^\/s\/([A-Za-z0-9_-]+)\/?$/);
  return match ? match[1] : "";
}

function renderShare(payload, shareId) {
  const conferenceId = String(payload?.conferenceId || "Conference");
  const conferenceTimeZone = resolveConferenceTimeZone(conferenceId, payload?.conferenceTimezone);
  const events = normalizeSharedEvents(payload?.events, conferenceTimeZone);
  const createdAt = String(payload?.createdAt || "");
  const expiresAt = String(payload?.expiresAt || "");

  shareEl.shareTitle.textContent = `${conferenceId.toUpperCase()} Shared Schedule`;
  shareEl.shareSubtitle.textContent = "Read-only preview. Import it into your planner to merge events.";
  const plannerUrl = new URL("/planner.html", window.location.origin);
  plannerUrl.searchParams.set("conference", conferenceId);
  plannerUrl.searchParams.set("share", shareId);
  shareEl.openPlannerBtn.href = plannerUrl.toString();
  shareEl.openPlannerBtn.textContent = "Import Into Planner";
  shareEl.shareMetaText.textContent = `${events.length} event(s) • Created ${fmtDateTime(createdAt)} • Expires ${fmtDateTime(expiresAt)}`;
  shareEl.shareStatusMessage.textContent = "";
  shareEl.shareImportHint.textContent =
    "Import steps: click \"Import Into Planner\", then choose \"Load Entire Schedule\" or \"Select Specific Events\" in the merge dialog.";
  shareEl.shareImportHint.style.color = "#214836";
  shareEl.shareEventContainer.textContent = "";

  if (!events.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "No events in this shared schedule.";
    shareEl.shareEventContainer.appendChild(empty);
    return;
  }

  const grouped = groupEventsByDay(events);
  for (const [dayId, dayEvents] of grouped.entries()) {
    const daySection = document.createElement("section");
    daySection.className = "share-day-section";

    const title = document.createElement("h3");
    title.className = "day-title";
    title.innerHTML = `${escapeHtml(fmtDay(dayId))} <span>${dayEvents.length} events</span>`;
    daySection.appendChild(title);

    const list = document.createElement("div");
    list.className = "share-event-list";
    for (const event of dayEvents) {
      list.appendChild(renderSharedEventCard(event));
    }
    daySection.appendChild(list);
    shareEl.shareEventContainer.appendChild(daySection);
  }
}

function normalizeSharedEvents(rawEvents, conferenceTimeZone) {
  const events = Array.isArray(rawEvents) ? rawEvents : [];
  const normalized = [];
  for (const rawEvent of events) {
    if (!rawEvent || typeof rawEvent !== "object") continue;
    const start = normalizeSharedEventDateTime(rawEvent.start, conferenceTimeZone);
    const end = normalizeSharedEventDateTime(rawEvent.end, conferenceTimeZone);
    if (!start || !end) continue;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      continue;
    }

    normalized.push({
      ...rawEvent,
      start,
      end,
      links: rawEvent.links && typeof rawEvent.links === "object" ? rawEvent.links : {},
    });
  }
  return normalized;
}

function renderSharedEventCard(event) {
  const card = document.createElement("article");
  card.className = "share-event-card";

  const head = document.createElement("div");
  head.className = "share-event-head";

  const title = document.createElement("h4");
  title.className = "session-title";
  title.textContent = String(event.title || "Untitled event");

  const meta = document.createElement("p");
  meta.className = "session-meta";
  meta.textContent = `${fmtTime(event.start)}-${fmtTime(event.end)} | ${String(event.location || "TBD")}`;

  head.append(title, meta);
  card.appendChild(head);

  const details = document.createElement("div");
  details.className = "details-list";
  if (event.sessionTitle) details.appendChild(detailRow("Session", event.sessionTitle));
  if (event.description) details.appendChild(detailRow("Description", event.description));
  if (event.notes) details.appendChild(detailRow("Notes", event.notes));
  card.appendChild(details);

  const links = event.links && typeof event.links === "object" ? event.links : {};
  const row = document.createElement("div");
  row.className = "details-linkrow";
  if (links.paperUrl) row.appendChild(makeLinkButton(links.paperUrl, "Open Paper PDF"));
  if (links.detailsUrl) row.appendChild(makeLinkButton(links.detailsUrl, "Open Source Details"));
  if (row.childElementCount > 0) card.appendChild(row);

  return card;
}

function makeLinkButton(href, text) {
  const link = document.createElement("a");
  link.className = "btn secondary details-action-btn details-action-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = text;
  return link;
}

function detailRow(label, value) {
  const row = document.createElement("p");
  row.className = "details-row";
  row.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value || ""))}`;
  return row;
}

function groupEventsByDay(events) {
  const buckets = new Map();
  const sorted = [...events].sort((a, b) => {
    const ta = new Date(a.start).getTime();
    const tb = new Date(b.start).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
  });
  for (const event of sorted) {
    const dayId = isoDay(String(event.start || "")) || "unscheduled";
    if (!buckets.has(dayId)) buckets.set(dayId, []);
    buckets.get(dayId).push(event);
  }
  return new Map([...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

function showError(message) {
  shareEl.shareTitle.textContent = "Shared Schedule";
  shareEl.shareSubtitle.textContent = "Read-only preview.";
  shareEl.shareMetaText.textContent = "";
  shareEl.shareStatusMessage.textContent = message;
  shareEl.shareStatusMessage.style.color = "#a83f1a";
  shareEl.shareImportHint.textContent = "";
  shareEl.shareEventContainer.textContent = "";
}

function fmtDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(isoDate) {
  if (!isoDate || isoDate === "unscheduled") return "Unscheduled";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function isoDay(isoDateTime) {
  if (typeof isoDateTime !== "string") return "";
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
