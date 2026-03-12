const LOCAL_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const OFFSET_DATE_TIME_RE = /(Z|[+-]\d{2}:\d{2})$/i;
const DEFAULT_CONFERENCE_TIMEZONE = "America/Los_Angeles";
const KNOWN_CONFERENCE_TIMEZONES = {
  "chi-2026": DEFAULT_CONFERENCE_TIMEZONE,
  "ndss-2026": DEFAULT_CONFERENCE_TIMEZONE,
};

const formatterCache = new Map();

function pad2(value) {
  return String(value).padStart(2, "0");
}

function localDateTimeFromDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}:${pad2(date.getSeconds())}`;
}

function getFormatter(timeZone) {
  const normalizedTimeZone = String(timeZone || "").trim() || DEFAULT_CONFERENCE_TIMEZONE;
  if (!formatterCache.has(normalizedTimeZone)) {
    formatterCache.set(
      normalizedTimeZone,
      new Intl.DateTimeFormat("en-CA", {
        timeZone: normalizedTimeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      })
    );
  }
  return formatterCache.get(normalizedTimeZone);
}

export function resolveConferenceTimeZone(conferenceId, fallbackTimeZone = "") {
  const fallback = String(fallbackTimeZone || "").trim();
  if (fallback) return fallback;
  const normalizedId = String(conferenceId || "").trim().toLowerCase();
  return KNOWN_CONFERENCE_TIMEZONES[normalizedId] || DEFAULT_CONFERENCE_TIMEZONE;
}

export function normalizeLocalDateTimeText(value) {
  const text = String(value || "").trim();
  const match = text.match(LOCAL_DATE_TIME_RE);
  if (!match) return "";

  const [, year, month, day, hour, minute, second = "00"] = match;
  const normalized = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  if (localDateTimeFromDate(parsed) !== normalized) return "";
  return normalized;
}

export function normalizeSharedEventDateTime(value, conferenceTimeZone = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  if (!OFFSET_DATE_TIME_RE.test(text)) return normalizeLocalDateTimeText(text);

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const parts = {};
  for (const part of getFormatter(conferenceTimeZone).formatToParts(parsed)) {
    if (part.type === "literal") continue;
    parts[part.type] = part.value;
  }

  if (!parts.year || !parts.month || !parts.day || !parts.hour || !parts.minute || !parts.second) return "";
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}
