const PROFILE_VERSION = 5;
const PAPER_SLOT_MINUTES = 20;
const DEFAULT_MAX_PARALLEL_PER_ROW = 4;
const CONFERENCE_REGISTRY = {
  "ndss-2026": {
    id: "ndss-2026",
    label: "NDSS 2026",
    dataUrl: "./data/ndss2026/ndss-2026.json",
    loadHint:
      "python3 scripts/crawl_ndss_2026.py --raw-output data/ndss2026/raw/program.html --json-output data/ndss2026/ndss-2026.json",
  },
  "chi-2026": {
    id: "chi-2026",
    label: "CHI 2026",
    dataUrl: "./data/chi2026/chi-2026.json",
    loadHint:
      "python3 scripts/crawl_chi_2026.py --raw-output data/chi2026/raw/program.html --json-output data/chi2026/chi-2026.json",
  },
};
const DEFAULT_CONFERENCE_ID = "chi-2026";
const LEVELS = ["none", "interested", "must_go"];
const LEVEL_WEIGHT = { none: 0, interested: 1, must_go: 2 };
const LEVEL_LABEL = { none: "None", interested: "Interested", must_go: "Must-Go" };
const DECISIONS = ["attend", "maybe", "not_go"];
const DECISION_LABEL = { attend: "Attend", maybe: "Maybe", not_go: "Not Go" };
const KIND_LABEL = {
  technical: "Papers",
  meetup: "Meet-Up",
  workshop: "Workshop",
  keynote: "Keynote",
  award: "Awards",
  panel: "Panel",
  journal: "Journal",
  src: "SRC",
  event: "Event",
  logistics: "Logistics",
};
const BADGE_ALIAS_MAP = new Map([
  ["keynotes", "keynote"],
  ["awards", "award"],
  ["workshops", "workshop"],
  ["panels", "panel"],
  ["papers", "paper"],
  ["meetups", "meetup"],
  ["meet-ups", "meet-up"],
  ["journals", "journal"],
]);
const GENERIC_PAPER_TRACKS = new Set(["paper", "papers"]);
const PAPERLIKE_TRACK_HINTS = ["papers", "journal", "src"];
const MEETUP_TRACK_HINTS = ["meet-up", "meetup"];
const NON_PAPER_TRACK_HINTS = ["workshop", "panel", "meet-up", "meetup", "award", "keynote", "roundtable", "journal", "src"];
const NON_PAPER_TITLE_HINTS = [
  "workshop",
  "panel",
  "meet-up",
  "meetup",
  "award",
  "townhall",
  "breakfast",
  "lunch",
  "reception",
  "student mentoring",
  "video presentation",
  "video presentations",
  "plenary",
  "keynote",
  "academy panel",
  "roundtable",
];
const KIND_PRECEDENCE = ["logistics", "keynote", "workshop", "meetup", "award", "panel", "src", "journal", "technical", "event"];
const KIND_KEYWORDS = {
  logistics: ["breakfast", "lunch", "reception", "townhall", "coffee"],
  keynote: ["keynote", "plenary"],
  workshop: ["workshop"],
  meetup: ["meet-up", "meetup"],
  award: ["award"],
  panel: ["panel"],
  src: ["src", "student research competition"],
  journal: ["journal"],
  technical: ["paper", "papers"],
};

const state = {
  activeConferenceId: DEFAULT_CONFERENCE_ID,
  data: null,
  sessionMap: new Map(),
  paperMap: new Map(),
  papersBySession: new Map(),
  conferenceUi: null,
  filters: {
    search: "",
    day: "all",
    kind: "all",
    sessionTag: "all",
    priority: "all",
  },
  expandedSessionIds: new Set(),
  priorities: {
    sessions: {},
    papers: {},
  },
  decisions: {},
  eventNotes: {},
  customEvents: [],
  showCustomForm: false,
  activeCalendarItemId: "",
  activeTab: "program",
  profileStorageKey: "",
};

const el = {
  searchInput: document.getElementById("searchInput"),
  dayFilter: document.getElementById("dayFilter"),
  kindFilter: document.getElementById("kindFilter"),
  sessionTagFilter: document.getElementById("sessionTagFilter"),
  priorityFilter: document.getElementById("priorityFilter"),
  conferenceSelect: document.getElementById("conferenceSelect"),
  backToLandingBtn: document.getElementById("backToLandingBtn"),
  programTabBtn: document.getElementById("programTabBtn"),
  calendarTabBtn: document.getElementById("calendarTabBtn"),
  programTabPanel: document.getElementById("programTabPanel"),
  calendarTabPanel: document.getElementById("calendarTabPanel"),
  explorerActions: document.getElementById("explorerActions"),
  programFilters: document.getElementById("programFilters"),
  expandAllBtn: document.getElementById("expandAllBtn"),
  collapseAllBtn: document.getElementById("collapseAllBtn"),
  resetSelectionsBtn: document.getElementById("resetSelectionsBtn"),
  saveProfileBtn: document.getElementById("saveProfileBtn"),
  loadProfileInput: document.getElementById("loadProfileInput"),
  addCustomEventBtn: document.getElementById("addCustomEventBtn"),
  customEventFormWrap: document.getElementById("customEventFormWrap"),
  customTitle: document.getElementById("customTitle"),
  customDate: document.getElementById("customDate"),
  customStartTime: document.getElementById("customStartTime"),
  customEndTime: document.getElementById("customEndTime"),
  customPriority: document.getElementById("customPriority"),
  customLocation: document.getElementById("customLocation"),
  customNotes: document.getElementById("customNotes"),
  saveCustomEventBtn: document.getElementById("saveCustomEventBtn"),
  cancelCustomEventBtn: document.getElementById("cancelCustomEventBtn"),
  confirmUndecidedBtn: document.getElementById("confirmUndecidedBtn"),
  removeUndecidedBtn: document.getElementById("removeUndecidedBtn"),
  exportIcsBtn: document.getElementById("exportIcsBtn"),
  statusMessage: document.getElementById("statusMessage"),
  explorerStats: document.getElementById("explorerStats"),
  plannerStats: document.getElementById("plannerStats"),
  dayBoards: document.getElementById("dayBoards"),
  weekCalendar: document.getElementById("weekCalendar"),
  eventDetails: document.getElementById("eventDetails"),
  conferenceEyebrow: document.getElementById("conferenceEyebrow"),
  conferenceTitle: document.getElementById("conferenceTitle"),
  conferenceSubtitle: document.getElementById("conferenceSubtitle"),
};

init();

async function init() {
  bindEvents();
  renderConferenceSelector();
  await loadConference(getInitialConferenceId(), false);
}

function bindEvents() {
  el.programTabBtn.addEventListener("click", () => setActiveTab("program"));
  el.calendarTabBtn.addEventListener("click", () => setActiveTab("calendar"));

  el.searchInput.addEventListener("input", (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    renderAll();
  });

  el.dayFilter.addEventListener("change", (event) => {
    state.filters.day = event.target.value;
    renderAll();
  });

  el.kindFilter.addEventListener("change", (event) => {
    state.filters.kind = event.target.value;
    renderAll();
  });

  el.sessionTagFilter.addEventListener("change", (event) => {
    state.filters.sessionTag = event.target.value;
    renderAll();
  });

  el.priorityFilter.addEventListener("change", (event) => {
    state.filters.priority = event.target.value;
    renderAll();
  });

  if (el.conferenceSelect) {
    el.conferenceSelect.addEventListener("change", async (event) => {
      await loadConference(event.target.value, true);
    });
  }

  el.expandAllBtn.addEventListener("click", () => {
    if (!state.data) return;
    for (const session of getVisibleSessions()) {
      if (!canExpandSessionCard(session)) continue;
      state.expandedSessionIds.add(session.id);
    }
    renderDayBoards();
  });

  el.collapseAllBtn.addEventListener("click", () => {
    state.expandedSessionIds.clear();
    renderDayBoards();
  });

  el.resetSelectionsBtn.addEventListener("click", () => {
    state.priorities.sessions = {};
    state.priorities.papers = {};
    state.decisions = {};
    state.activeCalendarItemId = "";
    persistProfile();
    renderAll();
    setStatus("Cleared all priorities and final decisions.", false);
  });

  el.saveProfileBtn.addEventListener("click", () => {
    if (!state.data) return;
    const profile = buildProfilePayload();
    const fname = `${state.data.conference.id}-profile.json`;
    downloadTextFile(fname, JSON.stringify(profile, null, 2), "application/json;charset=utf-8");
    setStatus("Saved preferences JSON.", false);
  });

  el.loadProfileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      applyProfile(parsed, true);
      setStatus(`Loaded preferences from ${file.name}.`, false);
    } catch (error) {
      setStatus(`Failed to load preferences: ${error.message}`, true);
    }
    event.target.value = "";
  });

  el.addCustomEventBtn.addEventListener("click", () => {
    state.showCustomForm = !state.showCustomForm;
    if (state.showCustomForm) primeCustomEventForm();
    renderCustomEventForm();
  });

  el.cancelCustomEventBtn.addEventListener("click", () => {
    state.showCustomForm = false;
    renderCustomEventForm();
  });

  el.saveCustomEventBtn.addEventListener("click", () => {
    const parsed = readCustomEventFromForm();
    if (!parsed.ok) {
      setStatus(parsed.error, true);
      return;
    }
    state.customEvents.push(parsed.value);
    state.showCustomForm = false;
    persistProfile();
    renderAll();
    setStatus("Added custom event to your calendar.", false);
  });

  el.exportIcsBtn.addEventListener("click", () => {
    const exportItems = getCalendarExportItems();
    if (!exportItems) return;
    const calendarName = `${state.data.conference.name} - Personal Plan`;
    const name = `${state.data.conference.id}-personal-plan.ics`;
    downloadTextFile(name, buildIcs(exportItems, calendarName), "text/calendar;charset=utf-8");
    setStatus(`Exported ${exportItems.length} event(s) as ICS.`, false);
  });

  el.confirmUndecidedBtn.addEventListener("click", () => {
    const items = buildPlanItems();
    const undecided = items.filter((item) => !getDecision(item.id));
    if (!undecided.length) {
      setStatus("No undecided events to confirm.", false);
      return;
    }
    for (const item of undecided) {
      state.decisions[item.id] = "attend";
    }
    persistProfile();
    renderPlanner();
    setStatus(`Confirmed ${undecided.length} undecided event(s) as Attend.`, false);
  });

  el.removeUndecidedBtn.addEventListener("click", () => {
    const items = buildPlanItems();
    const undecided = items.filter((item) => !getDecision(item.id));
    if (!undecided.length) {
      setStatus("No undecided events to remove.", false);
      return;
    }

    for (const item of undecided) {
      if (item.entityType === "paper") {
        const paperId = item.id.slice("paper:".length);
        delete state.priorities.papers[paperId];
      } else if (item.entityType === "session") {
        const sessionId = item.id.slice("session:".length);
        delete state.priorities.sessions[sessionId];
      } else if (item.entityType === "custom") {
        state.customEvents = state.customEvents.filter((custom) => custom.id !== item.id);
      }
      delete state.decisions[item.id];
      delete state.eventNotes[item.id];
    }

    state.activeCalendarItemId = "";
    persistProfile();
    renderAll();
    setStatus(`Removed ${undecided.length} undecided event(s) from the plan.`, false);
  });
}

async function loadConference(conferenceId, updateUrl = true) {
  const resolvedId = resolveConferenceId(conferenceId);
  const source = CONFERENCE_REGISTRY[resolvedId];
  if (!source) return;
  state.activeConferenceId = resolvedId;
  if (el.conferenceSelect && el.conferenceSelect.value !== resolvedId) {
    el.conferenceSelect.value = resolvedId;
  }
  renderBackToLandingLink();
  if (updateUrl) {
    setConferenceInUrl(resolvedId);
  }
  await loadData(source);
}

async function loadData(source) {
  try {
    setStatus(`Loading ${source.label} local dataset...`, false);
    const response = await fetch(source.dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = coerceDataset(await response.json(), source.id);
    validateData(data);
    hydrateState(data, source);
    loadSavedProfile();
    renderFilters();
    renderAll();
    setStatus(
      `Loaded ${data.stats.paperCount} papers across ${data.stats.sessionCount} sessions for ${data.conference.name}. Dataset generated ${fmtDateTime(data.generatedAt)}.`,
      false
    );
  } catch (error) {
    setStatus(
      `Could not load local data for ${source.label} (${error.message}). Run: ${source.loadHint}`,
      true
    );
  }
}

function validateData(data) {
  if (!data || !Array.isArray(data.days) || !Array.isArray(data.sessions) || !Array.isArray(data.papers) || !data.conference) {
    throw new Error("Dataset format invalid.");
  }
}

function hydrateState(data, source) {
  state.data = data;
  state.conferenceUi = resolveConferenceUi(data, source);
  state.sessionMap = new Map(data.sessions.map((session) => [session.id, session]));
  state.paperMap = new Map(data.papers.map((paper) => [paper.id, paper]));
  state.papersBySession = new Map();
  for (const session of data.sessions) {
    state.papersBySession.set(
      session.id,
      (session.paperIds || []).map((id) => state.paperMap.get(id)).filter(Boolean)
    );
  }
  state.priorities.sessions = {};
  state.priorities.papers = {};
  state.decisions = {};
  state.eventNotes = {};
  state.customEvents = [];
  state.expandedSessionIds.clear();
  state.activeCalendarItemId = "";
  state.profileStorageKey = `conference-planner-profile-${data.conference.id}-v${PROFILE_VERSION}`;
  renderConferenceHeader();
}

function getInitialConferenceId() {
  const params = new URLSearchParams(window.location.search);
  return resolveConferenceId(params.get("conference") || DEFAULT_CONFERENCE_ID);
}

function resolveConferenceId(conferenceId) {
  return Object.prototype.hasOwnProperty.call(CONFERENCE_REGISTRY, conferenceId) ? conferenceId : DEFAULT_CONFERENCE_ID;
}

function renderConferenceSelector() {
  if (!el.conferenceSelect) return;
  const options = Object.values(CONFERENCE_REGISTRY).map((source) => ({ value: source.id, label: source.label }));
  fillSelect(el.conferenceSelect, options, state.activeConferenceId);
}

function renderBackToLandingLink() {
  if (!el.backToLandingBtn) return;
  el.backToLandingBtn.href = "./index.html";
}

function setConferenceInUrl(conferenceId) {
  const url = new URL(window.location.href);
  url.searchParams.set("conference", conferenceId);
  window.history.replaceState({}, "", url.toString());
}

function resolveConferenceUi(data, source) {
  const ui = data.ui && typeof data.ui === "object" ? data.ui : {};
  const conferenceName = String(data.conference?.name || source.label || "Conference").trim();
  const trimmedName = conferenceName.replace(/\s+Program$/i, "").trim();
  return {
    eyebrow: String(ui.eyebrow || `${trimmedName} Planner`),
    title: String(ui.title || `Plan Your ${trimmedName} Week`),
    subtitle: String(
      ui.subtitle || "Browse by day and time, mark sessions or papers, and finalize your schedule in calendar view."
    ),
    maxParallelPerRow: Number(ui.maxParallelPerRow) > 0 ? Number(ui.maxParallelPerRow) : DEFAULT_MAX_PARALLEL_PER_ROW,
  };
}

function renderConferenceHeader() {
  if (!state.data || !state.conferenceUi) return;
  el.conferenceEyebrow.textContent = state.conferenceUi.eyebrow;
  el.conferenceTitle.textContent = state.conferenceUi.title;
  el.conferenceSubtitle.textContent = state.conferenceUi.subtitle;
  document.title = `${state.data.conference.name} Planner`;
}

function getMaxParallelPerRow() {
  const configured = Number(state.conferenceUi?.maxParallelPerRow || DEFAULT_MAX_PARALLEL_PER_ROW);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : DEFAULT_MAX_PARALLEL_PER_ROW;
}

function coerceDataset(input, fallbackConferenceId) {
  if (!input || typeof input !== "object") throw new Error("Dataset payload invalid.");

  const source = CONFERENCE_REGISTRY[resolveConferenceId(fallbackConferenceId)];
  const conference = coerceConference(input.conference, source);
  const sessions = coerceSessions(input.sessions, conference);
  const papers = coercePapers(input.papers, conference, sessions);
  hydrateSessionPaperIds(sessions, papers);
  normalizeSessionKinds(conference, sessions, papers);
  const days = coerceDays(input.days, sessions);

  return {
    schemaVersion: String(input.schemaVersion || "1.0"),
    generatedAt: String(input.generatedAt || new Date().toISOString()),
    conference,
    days,
    sessions,
    papers,
    stats: {
      dayCount: days.length,
      sessionCount: sessions.length,
      paperCount: papers.length,
      technicalSessionCount: sessions.filter((session) => session.kind === "technical").length,
      workshopCount: sessions.filter((session) => session.kind === "workshop").length,
    },
    ui: input.ui && typeof input.ui === "object" ? input.ui : {},
  };
}

function coerceConference(rawConference, source) {
  const conference = rawConference && typeof rawConference === "object" ? rawConference : {};
  return {
    id: String(conference.id || source.id),
    name: String(conference.name || source.label),
    year: Number(conference.year || new Date().getFullYear()),
    sourceUrl: String(conference.sourceUrl || ""),
    timezone: String(conference.timezone || "America/Los_Angeles"),
  };
}

function coerceSessions(rawSessions, conference) {
  if (!Array.isArray(rawSessions)) return [];
  const result = [];
  for (const raw of rawSessions) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim();
    if (!id) continue;
    let dayId = String(raw.dayId || "").trim();
    if (!dayId) {
      const date = isoDay(String(raw.start || ""));
      dayId = date ? `day-${date}` : "day-unscheduled";
    }
    result.push({
      id,
      conferenceId: String(raw.conferenceId || conference.id),
      dayId,
      kind: String(raw.kind || "event"),
      sessionCode: String(raw.sessionCode || ""),
      title: String(raw.title || "Untitled session"),
      subtitle: String(raw.subtitle || ""),
      track: String(raw.track || ""),
      start: String(raw.start || ""),
      end: String(raw.end || ""),
      location: String(raw.location || "TBD"),
      sourceUrl: String(raw.sourceUrl || ""),
      details: coerceSessionDetails(raw.details),
      paperIds: Array.isArray(raw.paperIds) ? raw.paperIds.map((idValue) => String(idValue)) : [],
      priority: normalizeLevel(raw.priority || "none"),
    });
  }
  return result;
}

function coerceSessionDetails(rawDetails) {
  const details = rawDetails && typeof rawDetails === "object" ? rawDetails : {};
  const authors = Array.isArray(details.authors)
    ? details.authors
        .map((author) => (typeof author === "string" ? author : author?.name))
        .map((name) => String(name || "").trim())
        .filter(Boolean)
    : [];
  const authorsText = String(details.authorsText || "").trim() || authors.join(", ");
  return {
    abstract: String(details.abstract || ""),
    authors,
    authorsText,
  };
}

function coercePapers(rawPapers, conference, sessions) {
  if (!Array.isArray(rawPapers)) return [];
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const result = [];
  for (const raw of rawPapers) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim();
    const sessionId = String(raw.sessionId || "").trim();
    if (!id || !sessionId) continue;
    const session = sessionById.get(sessionId);
    const dayId = String(raw.dayId || session?.dayId || "");
    result.push({
      id,
      conferenceId: String(raw.conferenceId || conference.id),
      dayId,
      sessionId,
      title: String(raw.title || "Untitled paper"),
      authorsText: String(raw.authorsText || ""),
      authors: Array.isArray(raw.authors)
        ? raw.authors.map((author) => ({
            name: String(author?.name || ""),
            affiliation: String(author?.affiliation || ""),
          }))
        : [],
      abstract: String(raw.abstract || ""),
      detailsUrl: String(raw.detailsUrl || ""),
      paperUrl: String(raw.paperUrl || ""),
      start: String(raw.start || session?.start || ""),
      end: String(raw.end || session?.end || ""),
      location: String(raw.location || session?.location || "TBD"),
      track: String(raw.track || session?.track || ""),
      priority: normalizeLevel(raw.priority || "none"),
    });
  }
  return result;
}

function hydrateSessionPaperIds(sessions, papers) {
  const paperIdsBySession = new Map();
  for (const paper of papers) {
    if (!paperIdsBySession.has(paper.sessionId)) paperIdsBySession.set(paper.sessionId, []);
    paperIdsBySession.get(paper.sessionId).push(paper.id);
  }
  for (const session of sessions) {
    const existing = Array.isArray(session.paperIds) ? session.paperIds : [];
    const fromPapers = paperIdsBySession.get(session.id) || [];
    session.paperIds = uniq([...existing, ...fromPapers]);
  }
}

function normalizeSessionKinds(conference, sessions, papers) {
  const tracksBySession = new Map();
  for (const paper of papers) {
    const track = normalizeTrackLabel(paper.track);
    if (!track) continue;
    if (!tracksBySession.has(paper.sessionId)) tracksBySession.set(paper.sessionId, []);
    tracksBySession.get(paper.sessionId).push(track);
  }

  for (const session of sessions) {
    const currentKind = String(session.kind || "").trim().toLowerCase();
    const sessionTrack = normalizeTrackLabel(session.track);
    const sessionTracks = tracksBySession.get(session.id) || [];
    const candidates = [sessionTrack, ...sessionTracks, session.title].filter(Boolean);
    const derivedKind = pickKindFromCandidates(candidates);

    if (derivedKind) {
      session.kind = derivedKind;
      continue;
    }

    if (currentKind && currentKind !== "technical") {
      session.kind = currentKind;
      continue;
    }

    if ((session.paperIds || []).length > 0) {
      session.kind = "technical";
      continue;
    }

    if (conference?.id === "chi-2026" || hasNonPaperTitleHint(session.title)) {
      session.kind = "event";
      continue;
    }

    session.kind = currentKind || "technical";
  }
}

function pickKindFromCandidates(candidates) {
  const foundKinds = new Set();
  for (const rawCandidate of candidates) {
    const candidate = normalizeTrackLabel(rawCandidate).toLowerCase();
    if (!candidate) continue;
    for (const [kind, keywords] of Object.entries(KIND_KEYWORDS)) {
      if (keywords.some((keyword) => candidate.includes(keyword))) {
        foundKinds.add(kind);
      }
    }
  }
  for (const preferredKind of KIND_PRECEDENCE) {
    if (foundKinds.has(preferredKind)) return preferredKind;
  }
  return "";
}

function normalizeTrackLabel(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBadgeCompareLabel(value) {
  const normalized = normalizeTrackLabel(value).toLowerCase();
  if (!normalized) return "";
  return normalized
    .split(" ")
    .map((token) => BADGE_ALIAS_MAP.get(token) || token)
    .join(" ");
}

function includesAnyKeyword(text, keywords) {
  const lower = String(text || "").toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function isGenericPaperTrack(track) {
  const lower = normalizeTrackLabel(track).toLowerCase();
  return GENERIC_PAPER_TRACKS.has(lower);
}

function isNonPaperTrack(track) {
  const lower = normalizeTrackLabel(track).toLowerCase();
  if (!lower) return false;
  return NON_PAPER_TRACK_HINTS.some((hint) => lower.includes(hint));
}

function isMeetupTrack(track) {
  const lower = normalizeTrackLabel(track).toLowerCase();
  if (!lower) return false;
  return MEETUP_TRACK_HINTS.some((hint) => lower.includes(hint));
}

function hasNonPaperTitleHint(title) {
  return includesAnyKeyword(title, NON_PAPER_TITLE_HINTS);
}

function isPaperLikeTrack(track) {
  const lower = normalizeTrackLabel(track).toLowerCase();
  if (!lower) return false;
  if (isNonPaperTrack(lower)) return false;
  if (GENERIC_PAPER_TRACKS.has(lower)) return true;
  return PAPERLIKE_TRACK_HINTS.some((hint) => lower.includes(hint));
}

function coerceDays(rawDays, sessions) {
  const daysById = new Map();

  if (Array.isArray(rawDays)) {
    for (const raw of rawDays) {
      if (!raw || typeof raw !== "object") continue;
      const id = String(raw.id || "").trim();
      if (!id) continue;
      const date = String(raw.date || id.replace(/^day-/, ""));
      daysById.set(id, {
        id,
        date,
        label: String(raw.label || fmtDay(date)),
        sessionIds: [],
      });
    }
  }

  for (const session of sessions) {
    if (!daysById.has(session.dayId)) {
      const date = session.dayId.replace(/^day-/, "");
      daysById.set(session.dayId, {
        id: session.dayId,
        date,
        label: fmtDay(date),
        sessionIds: [],
      });
    }
    daysById.get(session.dayId).sessionIds.push(session.id);
  }

  return [...daysById.values()].sort((a, b) => {
    const da = String(a.date || "");
    const db = String(b.date || "");
    return da.localeCompare(db);
  });
}

function renderFilters() {
  const dayOptions = [{ value: "all", label: "All days" }, ...state.data.days.map((day) => ({ value: day.id, label: day.label }))];
  fillSelect(el.dayFilter, dayOptions, state.filters.day);

  const kinds = uniq(state.data.sessions.map((session) => session.kind)).sort();
  const kindOptions = [{ value: "all", label: "All types" }, ...kinds.map((kind) => ({ value: kind, label: KIND_LABEL[kind] || kind }))];
  fillSelect(el.kindFilter, kindOptions, state.filters.kind);

  fillSessionTagSelect(el.sessionTagFilter, state.filters.sessionTag);

  state.filters.day = el.dayFilter.value;
  state.filters.kind = el.kindFilter.value;
  state.filters.sessionTag = el.sessionTagFilter.value;
  state.filters.priority = el.priorityFilter.value;
}

function fillSelect(selectEl, options, currentValue) {
  selectEl.textContent = "";
  for (const option of options) {
    const node = document.createElement("option");
    node.value = option.value;
    node.textContent = option.label;
    selectEl.appendChild(node);
  }
  selectEl.value = options.some((option) => option.value === currentValue) ? currentValue : options[0]?.value || "";
}

function fillSessionTagSelect(selectEl, currentValue) {
  const paperTrackToSessionIds = new Map();

  for (const session of state.data.sessions) {
    if (session.kind !== "technical") continue;
    const papers = state.papersBySession.get(session.id) || [];
    const technicalTags = getSessionTagValues(session, papers);
    for (const tag of technicalTags) {
      if (!paperTrackToSessionIds.has(tag)) paperTrackToSessionIds.set(tag, new Set());
      paperTrackToSessionIds.get(tag).add(session.id);
    }
  }

  selectEl.textContent = "";
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All paper sessions";
  selectEl.appendChild(allOption);

  const paperTracks = [...paperTrackToSessionIds.keys()].sort((a, b) => a.localeCompare(b));
  for (const tag of paperTracks) {
    selectEl.appendChild(makeSelectOption(tag, `${tag} (${paperTrackToSessionIds.get(tag)?.size || 0})`));
  }

  const hasCurrent = [...selectEl.options].some((option) => option.value === currentValue);
  selectEl.value = hasCurrent ? currentValue : "all";
}

function makeSelectOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function renderAll() {
  if (!state.data) return;
  renderTabs();
  renderCustomEventForm();
  renderDayBoards();
  renderPlanner();
}

function setActiveTab(tab) {
  state.activeTab = tab === "calendar" ? "calendar" : "program";
  renderTabs();
}

function renderTabs() {
  const isProgram = state.activeTab === "program";
  el.programTabBtn.classList.toggle("active", isProgram);
  el.calendarTabBtn.classList.toggle("active", !isProgram);
  el.programTabBtn.setAttribute("aria-selected", String(isProgram));
  el.calendarTabBtn.setAttribute("aria-selected", String(!isProgram));
  el.programTabPanel.classList.toggle("hidden", !isProgram);
  el.calendarTabPanel.classList.toggle("hidden", isProgram);
}

function renderDayBoards() {
  const visible = getVisibleSessions();
  const byDay = groupSessionsByDay(visible);

  el.dayBoards.textContent = "";
  if (!visible.length) {
    el.dayBoards.appendChild(createEmpty("No sessions match your filters."));
    el.explorerStats.textContent = "0 sessions visible";
    return;
  }

  const selectedSessions = visible.filter((session) => getSessionLevel(session.id) !== "none").length;
  const selectedPapers = visible
    .flatMap((session) => getVisiblePapersForSession(session))
    .filter((paper) => getPaperLevel(paper.id) !== "none").length;
  el.explorerStats.textContent = `${visible.length} sessions visible • ${selectedSessions} session marks • ${selectedPapers} paper marks`;

  for (const day of getVisibleDays()) {
    const sessions = byDay.get(day.id) || [];
    if (state.filters.day === "all" && sessions.length === 0) continue;
    el.dayBoards.appendChild(renderDayBoard(day, sessions));
  }
}

function renderDayBoard(day, sessions) {
  const board = document.createElement("section");
  board.className = "day-board";

  const title = document.createElement("h3");
  title.className = "day-title";
  title.innerHTML = `${escapeHtml(day.label)} <span>${sessions.length} sessions</span>`;
  board.appendChild(title);

  const slotsWrap = document.createElement("div");
  slotsWrap.className = "slots";

  if (sessions.length === 0) {
    slotsWrap.appendChild(createEmpty("No matching sessions for this day."));
    board.appendChild(slotsWrap);
    return board;
  }

  const slots = groupSessionsBySlot(sessions);
  for (const slot of slots) {
    const expandableSessions = slot.sessions.filter((session) => canExpandSessionCard(session));
    const allExpanded = expandableSessions.length > 0 && expandableSessions.every((session) => state.expandedSessionIds.has(session.id));
    const maxParallelPerRow = getMaxParallelPerRow();
    const slotParallelCount = Math.max(1, Math.min(maxParallelPerRow, slot.sessions.length));
    const sessionRows = chunkArray(slot.sessions, maxParallelPerRow);
    for (const [chunkIndex, sessionChunk] of sessionRows.entries()) {
      const row = document.createElement("div");
      row.className = "slot-row";

      const time = document.createElement("div");
      time.className = chunkIndex === 0 ? "slot-time" : "slot-time slot-time-placeholder";
      const slotLabel = document.createElement("p");
      slotLabel.className = "slot-time-label";
      slotLabel.textContent = `${fmtTime(slot.start)}-${fmtTime(slot.end)}`;
      time.appendChild(slotLabel);

      if (chunkIndex === 0) {
        const slotToggle = document.createElement("button");
        slotToggle.type = "button";
        slotToggle.className = "slot-toggle-btn";
        slotToggle.textContent = allExpanded ? "Collapse Slot" : "Expand Slot";
        slotToggle.disabled = expandableSessions.length === 0;
        slotToggle.addEventListener("click", () => {
          if (allExpanded) {
            for (const session of expandableSessions) state.expandedSessionIds.delete(session.id);
          } else {
            for (const session of expandableSessions) {
              state.expandedSessionIds.add(session.id);
            }
          }
          renderDayBoards();
        });
        time.appendChild(slotToggle);
      }

      const lane = document.createElement("div");
      lane.className = "slot-sessions";
      lane.style.setProperty("--parallel-count", String(slotParallelCount));
      for (const session of sessionChunk) {
        lane.appendChild(renderSessionCard(session, getVisiblePapersForSession(session)));
      }

      row.append(time, lane);
      slotsWrap.appendChild(row);
    }
  }

  board.appendChild(slotsWrap);
  return board;
}

function isSessionPaperExpandable(session) {
  return session?.kind === "technical" && (session.paperIds || []).length > 0;
}

function hasSessionDetailsContent(session) {
  const summary = getSessionDetailsText(session);
  const authors = getSessionDetailsAuthors(session);
  const subtitle = String(session?.subtitle || "").trim();
  return Boolean(summary || authors || subtitle);
}

function canExpandSessionCard(session) {
  return isSessionPaperExpandable(session) || isSessionDetailsExpandable(session);
}

function getSessionDetailsText(session) {
  return String(session?.details?.abstract || "").trim();
}

function getSessionDetailsAuthors(session) {
  const authorsText = String(session?.details?.authorsText || "").trim();
  if (authorsText) return authorsText;
  if (Array.isArray(session?.details?.authors)) {
    return session.details.authors
      .map((name) => String(name || "").trim())
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function getSessionDescriptionForPlan(session) {
  const details = getSessionDetailsText(session);
  if (details) return details;
  return String(session?.subtitle || "").trim();
}

function isSessionDetailsExpandable(session) {
  if (!session || isSessionPaperExpandable(session)) return false;
  return hasSessionDetailsContent(session);
}

function toggleSessionExpanded(sessionId) {
  if (state.expandedSessionIds.has(sessionId)) state.expandedSessionIds.delete(sessionId);
  else state.expandedSessionIds.add(sessionId);
}

function shouldShowSessionTrackBadge(session) {
  const track = normalizeTrackLabel(session?.track);
  if (!track) return false;
  const trackCompare = normalizeBadgeCompareLabel(track);
  const kindLabel = normalizeTrackLabel(KIND_LABEL[session?.kind] || session?.kind);
  const kindCompare = normalizeBadgeCompareLabel(kindLabel);
  if (kindCompare && trackCompare === kindCompare) return false;
  if (session?.kind === "technical" && isGenericPaperTrack(track)) return false;
  return true;
}

function renderSessionCard(session, visiblePapers) {
  const card = document.createElement("article");
  card.className = "session-card";
  const shownPapers = Array.isArray(visiblePapers) ? visiblePapers : [];
  const isPaperSession = isSessionPaperExpandable(session);
  const isDetailsSession = isSessionDetailsExpandable(session);
  const hasSourceLink = Boolean(String(session?.sourceUrl || "").trim());
  const isExpanded = state.expandedSessionIds.has(session.id);

  const head = document.createElement("div");
  head.className = "session-head";

  const top = document.createElement("div");
  top.className = "session-top";

  const main = document.createElement("div");
  main.className = "session-main";

  const badges = document.createElement("div");
  badges.className = "badges";
  const totalPapers = session.paperIds?.length || 0;
  const paperBadge = state.filters.search
    ? `${shownPapers.length}/${totalPapers} papers`
    : `${totalPapers} papers`;
  const kindLabel = KIND_LABEL[session.kind] || session.kind;
  badges.innerHTML = [
    badgeHtml(kindLabel),
    shouldShowSessionTrackBadge(session) ? badgeHtml(session.track) : "",
    totalPapers ? badgeHtml(paperBadge) : "",
  ].join("");

  const title = document.createElement("h4");
  title.className = "session-title";
  title.textContent = session.title || "Untitled session";

  const subtitle = document.createElement("p");
  subtitle.className = "session-subtitle";
  subtitle.textContent = session.subtitle || "";

  const meta = document.createElement("p");
  meta.className = "session-meta";
  meta.textContent = `${fmtTime(session.start)}-${fmtTime(session.end)} | ${session.location || "TBD"}`;

  main.append(badges, title);
  if (session.subtitle) main.appendChild(subtitle);
  main.appendChild(meta);

  top.appendChild(main);
  head.appendChild(top);

  const actions = document.createElement("div");
  actions.className = "session-actions";
  actions.appendChild(
    makePriorityGroup(getSessionLevel(session.id), (level) => {
      setSessionLevel(session.id, level);
    })
  );

  if (isPaperSession) {
    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-btn";
    expandBtn.textContent = isExpanded ? "Hide Papers" : "Show Papers";
    expandBtn.addEventListener("click", () => {
      toggleSessionExpanded(session.id);
      renderDayBoards();
    });
    actions.appendChild(expandBtn);
  } else if (isDetailsSession) {
    const expandBtn = document.createElement("button");
    expandBtn.className = "expand-btn";
    expandBtn.textContent = isExpanded ? "Hide Details" : "Show Details";
    expandBtn.addEventListener("click", () => {
      toggleSessionExpanded(session.id);
      renderDayBoards();
    });
    actions.appendChild(expandBtn);
  } else if (hasSourceLink) {
    const sourceAction = document.createElement("a");
    sourceAction.className = "session-details-link";
    sourceAction.href = session.sourceUrl;
    sourceAction.target = "_blank";
    sourceAction.rel = "noreferrer";
    sourceAction.textContent = "Open Session Source";
    actions.appendChild(sourceAction);
  }

  if (!isPaperSession && isDetailsSession && hasSourceLink) {
    const sourceAction = document.createElement("a");
    sourceAction.className = "session-details-link";
    sourceAction.href = session.sourceUrl;
    sourceAction.target = "_blank";
    sourceAction.rel = "noreferrer";
    sourceAction.textContent = "Open Session Source";
    actions.appendChild(sourceAction);
  }

  head.appendChild(actions);
  card.appendChild(head);

  if (isPaperSession) {
    const body = document.createElement("div");
    body.className = `session-body ${isExpanded ? "" : "hidden"}`.trim();
    const papersLabel = document.createElement("p");
    papersLabel.className = "papers-label";
    papersLabel.textContent = "Papers";
    body.appendChild(papersLabel);

    for (const paper of shownPapers) {
      body.appendChild(renderPaperCard(paper, session));
    }
    if (!shownPapers.length) {
      body.appendChild(createEmpty("No papers in this session match the current search/filter."));
    }
    card.appendChild(body);
  } else if (isDetailsSession) {
    const body = document.createElement("div");
    body.className = `session-body ${isExpanded ? "" : "hidden"}`.trim();
    const detailsSummary = getSessionDetailsText(session) || String(session?.subtitle || "").trim();
    const detailsAuthors = getSessionDetailsAuthors(session);
    if (detailsSummary) {
      const detailsText = document.createElement("p");
      detailsText.className = "session-details-text";
      detailsText.textContent = detailsSummary;
      body.appendChild(detailsText);
    }
    if (detailsAuthors) {
      const authorsText = document.createElement("p");
      authorsText.className = "session-details-text";
      authorsText.textContent = detailsAuthors;
      body.appendChild(authorsText);
    }
    card.appendChild(body);
  }

  return card;
}

function renderPaperCard(paper, session) {
  const card = document.createElement("div");
  card.className = "paper-card";
  const presentation = getPaperPresentationWindow(paper, session);
  const authorsData = getPaperAuthorsData(paper);
  const institutionsData = getPaperInstitutionsData(paper);

  const title = document.createElement("h5");
  title.className = "paper-title";
  title.textContent = paper.title;

  const authors = document.createElement("p");
  authors.className = "paper-authors";
  renderCompactListLine(authors, authorsData, "et al.");

  const institutions = document.createElement("p");
  institutions.className = "paper-institutions";
  renderCompactListLine(institutions, institutionsData, `+${institutionsData.remaining} more`);

  const meta = document.createElement("p");
  meta.className = "paper-meta";
  meta.textContent = `${fmtTime(presentation.start)}-${fmtTime(presentation.end)} | ${session.location || "TBD"}`;

  const actions = document.createElement("div");
  actions.className = "paper-actions";
  actions.appendChild(
    makePriorityGroup(getPaperLevel(paper.id), (level) => {
      setPaperLevel(paper.id, level);
    })
  );

  const links = document.createElement("div");
  links.className = "paper-links";
  if (paper.paperUrl) {
    const paperLink = document.createElement("a");
    paperLink.href = paper.paperUrl;
    paperLink.target = "_blank";
    paperLink.rel = "noreferrer";
    paperLink.textContent = "Paper PDF";
    links.appendChild(paperLink);
  }
  if (paper.detailsUrl) {
    const detailsLink = document.createElement("a");
    detailsLink.href = paper.detailsUrl;
    detailsLink.target = "_blank";
    detailsLink.rel = "noreferrer";
    detailsLink.textContent = "Details";
    links.appendChild(detailsLink);
  }
  actions.appendChild(links);

  const abstract = document.createElement("div");
  abstract.className = "abstract";
  const details = document.createElement("details");
  const summary = document.createElement("summary");
  summary.textContent = paper.abstract ? "Show Details" : "Details unavailable";
  details.appendChild(summary);
  const content = document.createElement("div");
  content.className = "abstract-content";
  const abstractText = document.createElement("p");
  abstractText.className = "paper-authors";
  abstractText.textContent = paper.abstract || "No abstract found in source data.";
  content.appendChild(abstractText);
  details.appendChild(content);
  abstract.appendChild(details);

  card.append(title, authors);
  if (institutionsData.fullText) card.appendChild(institutions);
  card.append(meta, actions, abstract);
  return card;
}

function makePriorityGroup(level, onChange) {
  const group = document.createElement("div");
  group.className = "priority-group";
  for (const option of LEVELS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "priority-btn";
    button.textContent = LEVEL_LABEL[option];
    if (option === level) button.classList.add(`active-${option}`);
    button.addEventListener("click", () => onChange(option));
    group.appendChild(button);
  }
  return group;
}

function getVisibleSessions() {
  const sessions = [...state.data.sessions];
  const q = state.filters.search;

  return sessions
    .filter((session) => {
      if (state.filters.day !== "all" && session.dayId !== state.filters.day) return false;
      if (state.filters.kind !== "all" && session.kind !== state.filters.kind) return false;

      const sessionLevel = getSessionLevel(session.id);
      const papers = state.papersBySession.get(session.id) || [];

      if (state.filters.sessionTag !== "all") {
        const tag = state.filters.sessionTag;
        const tags = getSessionTagValues(session, papers);
        const hasTag = tags.includes(tag);
        if (!hasTag) return false;
      }

      const hasSelectedPaper = papers.some((paper) => getPaperLevel(paper.id) !== "none");
      const hasMustPaper = papers.some((paper) => getPaperLevel(paper.id) === "must_go");
      if (state.filters.priority === "selected" && sessionLevel === "none" && !hasSelectedPaper) return false;
      if (state.filters.priority === "must_go" && sessionLevel !== "must_go" && !hasMustPaper) return false;

      if (!q) return true;
      if (sessionMatchesQuery(session, q)) return true;
      return papers.some((paper) => paperMatchesQuery(paper, q));
    })
    .sort(sortByStartThenTitle);
}

function getVisiblePapersForSession(session) {
  const papers = state.papersBySession.get(session.id) || [];
  let result = papers;

  if (state.filters.search) {
    // If the session itself matches, keep all papers visible for context.
    if (!sessionMatchesQuery(session, state.filters.search)) {
      result = result.filter((paper) => paperMatchesQuery(paper, state.filters.search));
    }
  }
  if (state.filters.priority === "selected") {
    result = result.filter((paper) => getPaperLevel(paper.id) !== "none");
  } else if (state.filters.priority === "must_go") {
    result = result.filter((paper) => getPaperLevel(paper.id) === "must_go");
  }
  return result;
}

function paperMatchesQuery(paper, query) {
  return `${paper.title} ${paper.authorsText || ""} ${paper.abstract || ""}`.toLowerCase().includes(query);
}

function sessionMatchesQuery(session, query) {
  return `${session.title} ${session.subtitle || ""} ${session.track || ""} ${session.location || ""}`.toLowerCase().includes(query);
}

function getSessionTagValues(session, papers = []) {
  const tags = [];
  const seen = new Set();

  const addTag = (value) => {
    const tag = normalizeTrackLabel(value);
    if (!tag) return;
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    if (isGenericPaperTrack(tag)) return;
    if (isNonPaperTrack(tag)) return;
    seen.add(key);
    tags.push(tag);
  };

  for (const paper of papers) {
    addTag(paper.track);
  }

  if (!tags.length) {
    addTag(session.track);
  }

  if (!tags.length && session.kind === "technical") {
    const sessionTitle = normalizeTrackLabel(session.title);
    if (sessionTitle && !hasNonPaperTitleHint(sessionTitle)) addTag(sessionTitle);
  }

  return tags;
}

function getPaperAuthorsData(paper, maxAuthors = 3) {
  if (Array.isArray(paper.authors) && paper.authors.length) {
    const names = paper.authors
      .map((author) => String(author?.name || "").trim())
      .filter(Boolean);
    if (names.length) {
      if (names.length <= maxAuthors) {
        const text = names.join(", ");
        return { shortText: text, fullText: text, truncated: false, remaining: 0 };
      }
      return {
        shortText: names.slice(0, maxAuthors).join(", "),
        fullText: names.join(", "),
        truncated: true,
        remaining: names.length - maxAuthors,
      };
    }
  }

  const fallback = String(paper.authorsText || "").trim();
  if (!fallback) return { shortText: "Authors not listed", fullText: "", truncated: false, remaining: 0 };
  if (fallback.length <= 96) return { shortText: fallback, fullText: fallback, truncated: false, remaining: 0 };
  return {
    shortText: fallback.slice(0, 93),
    fullText: fallback,
    truncated: true,
    remaining: 0,
  };
}

function getPaperInstitutionsData(paper, maxInstitutions = 2) {
  if (!Array.isArray(paper.authors) || !paper.authors.length) {
    return { shortText: "", fullText: "", truncated: false, remaining: 0 };
  }
  const institutions = [];
  for (const author of paper.authors) {
    const affiliation = String(author?.affiliation || "").trim();
    if (!affiliation) continue;
    if (!institutions.includes(affiliation)) institutions.push(affiliation);
  }
  if (!institutions.length) return { shortText: "", fullText: "", truncated: false, remaining: 0 };
  if (institutions.length <= maxInstitutions) {
    const text = institutions.join(" • ");
    return { shortText: text, fullText: text, truncated: false, remaining: 0 };
  }
  const remaining = institutions.length - maxInstitutions;
  return {
    shortText: institutions.slice(0, maxInstitutions).join(" • "),
    fullText: institutions.join(" • "),
    truncated: true,
    remaining,
  };
}

function renderCompactListLine(container, data, expandLabel) {
  container.textContent = "";
  if (!data.fullText) return;

  if (!data.truncated) {
    container.textContent = data.shortText;
    return;
  }

  let expanded = false;
  const textNode = document.createElement("span");
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "inline-more-btn";

  const redraw = () => {
    if (expanded) {
      textNode.textContent = data.fullText;
      toggle.textContent = "less";
    } else {
      textNode.textContent = data.shortText;
      toggle.textContent = expandLabel;
    }
  };

  toggle.addEventListener("click", () => {
    expanded = !expanded;
    redraw();
  });

  redraw();
  container.append(textNode, toggle);
}

function renderPlanner() {
  const items = buildPlanItems();
  const mustGoCount = items.filter((item) => item.level === "must_go").length;
  const interestedCount = items.filter((item) => item.level === "interested").length;
  const attendCount = items.filter((item) => getDecision(item.id) === "attend").length;
  const maybeCount = items.filter((item) => getDecision(item.id) === "maybe").length;
  const notGoCount = items.filter((item) => getDecision(item.id) === "not_go").length;
  el.plannerStats.textContent = `${mustGoCount} must-go • ${interestedCount} interested • ${attendCount} attend • ${maybeCount} maybe • ${notGoCount} not-go`;

  if (!items.length) {
    state.activeCalendarItemId = "";
  } else if (!items.some((item) => item.id === state.activeCalendarItemId)) {
    state.activeCalendarItemId = items[0].id;
  }

  renderWeekCalendar(items);
  renderEventDetails(items);
}

function renderWeekCalendar(items) {
  el.weekCalendar.textContent = "";
  const visibleDays = getVisibleDays();
  if (!visibleDays.length) {
    el.weekCalendar.appendChild(createEmpty("No calendar days available."));
    return;
  }
  if (!items.length) {
    el.weekCalendar.appendChild(
      createEmpty("Mark sessions/papers as Interested or Must-Go. Then click events here to review final attendance.")
    );
    return;
  }

  const dayIds = new Set(visibleDays.map((day) => day.id));
  const dayItems = items.filter((item) => dayIds.has(`day-${isoDay(item.start)}`) || dayIds.has(item.dayId));
  const bounds = computeCalendarBounds(visibleDays, dayItems);
  const hourHeight = 72;
  const pxPerMinute = hourHeight / 60;
  const totalHeight = (bounds.endHour - bounds.startHour) * hourHeight;

  const shell = document.createElement("div");
  shell.className = "calendar-shell";

  const header = document.createElement("div");
  header.className = "calendar-header";
  header.style.setProperty("--day-count", String(visibleDays.length));
  const timeHead = document.createElement("div");
  timeHead.className = "head-cell";
  timeHead.textContent = "Time";
  header.appendChild(timeHead);
  for (const day of visibleDays) {
    const cell = document.createElement("div");
    cell.className = "head-cell";
    cell.textContent = day.label;
    header.appendChild(cell);
  }
  shell.appendChild(header);

  const scroll = document.createElement("div");
  scroll.className = "calendar-scroll";
  const body = document.createElement("div");
  body.className = "calendar-body";

  const timeAxis = document.createElement("div");
  timeAxis.className = "time-axis";
  timeAxis.style.height = `${totalHeight}px`;
  for (let hour = bounds.startHour; hour <= bounds.endHour; hour += 1) {
    const label = document.createElement("p");
    label.className = "time-label";
    label.style.top = `${(hour - bounds.startHour) * hourHeight}px`;
    label.textContent = formatHourLabel(hour);
    timeAxis.appendChild(label);
  }
  body.appendChild(timeAxis);

  const daysGrid = document.createElement("div");
  daysGrid.className = "days-grid";
  daysGrid.style.setProperty("--day-count", String(visibleDays.length));
  for (const day of visibleDays) {
    const col = document.createElement("div");
    col.className = "day-column";
    col.style.height = `${totalHeight}px`;
    col.style.setProperty("--hour-height", `${hourHeight}px`);
    const itemsForDay = dayItems.filter((item) => `day-${isoDay(item.start)}` === day.id).sort(sortPlanItems);
    const laidOut = assignDayLanes(itemsForDay);

    for (const item of laidOut) {
      const startMin = minutesOfDay(item.start);
      const endMin = Math.max(minutesOfDay(item.end), startMin + 1);
      const top = (startMin - bounds.startMinute) * pxPerMinute;
      const height = Math.max((endMin - startMin) * pxPerMinute, 24);
      const laneWidth = 100 / item.laneCount;
      const leftPct = item.lane * laneWidth + 1;
      const widthPct = Math.max(laneWidth - 2, 20);

      const event = document.createElement("div");
      const decision = getDecision(item.id);
      const decisionClass = decision || "undecided";
      event.className = `calendar-event level-${item.level} decision-${decisionClass}${
        item.id === state.activeCalendarItemId ? " selected" : ""
      }`;
      event.style.top = `${top}px`;
      event.style.height = `${height}px`;
      event.style.left = `${leftPct}%`;
      event.style.width = `${widthPct}%`;
      event.tabIndex = 0;
      event.setAttribute("role", "button");
      event.setAttribute("aria-label", `${item.title}, ${fmtTime(item.start)} to ${fmtTime(item.end)}`);
      event.title = `Open details: ${item.title}`;
      event.addEventListener("click", () => {
        state.activeCalendarItemId = item.id;
        renderPlanner();
      });
      event.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          state.activeCalendarItemId = item.id;
          renderPlanner();
        }
      });

      const title = document.createElement("p");
      title.className = "calendar-event-title";
      title.textContent = `${item.level === "must_go" ? "[Must-Go] " : ""}${item.title}`;
      const meta = document.createElement("p");
      meta.className = "calendar-event-meta";
      if (item.entityType === "paper") {
        meta.textContent = `${item.sessionTitle || "Paper Session"} • ${DECISION_LABEL[decision] || "Undecided"}`;
      } else if (item.entityType === "custom") {
        meta.textContent = `Custom Event • ${DECISION_LABEL[decision] || "Undecided"}`;
      } else {
        meta.textContent = `${KIND_LABEL[item.kind] || "Session"} • ${DECISION_LABEL[decision] || "Undecided"}`;
      }
      event.append(title, meta);
      col.appendChild(event);
    }
    daysGrid.appendChild(col);
  }
  body.appendChild(daysGrid);
  scroll.appendChild(body);
  shell.appendChild(scroll);
  el.weekCalendar.appendChild(shell);
}

function renderEventDetails(items) {
  el.eventDetails.textContent = "";
  if (!items.length) {
    el.eventDetails.appendChild(createEmpty("Select items to open detailed event review."));
    return;
  }

  const active = items.find((item) => item.id === state.activeCalendarItemId) || items[0];
  if (!active) {
    el.eventDetails.appendChild(createEmpty("No active event."));
    return;
  }

  const session = active.sessionId ? state.sessionMap.get(active.sessionId) : null;
  const paper = active.entityType === "paper" ? state.paperMap.get(active.id.slice("paper:".length)) : null;
  const decision = getDecision(active.id);
  const dayLabel = fmtDay(isoDay(active.start));

  const card = document.createElement("article");
  card.className = "details-card";

  const title = document.createElement("h3");
  title.className = "details-title";
  title.textContent = active.title;

  const meta = document.createElement("p");
  meta.className = "details-meta";
  meta.textContent = `${dayLabel} • ${fmtTime(active.start)}-${fmtTime(active.end)} • ${active.location || "TBD"}`;

  const list = document.createElement("div");
  list.className = "details-list";
  const typeLabel =
    active.entityType === "paper"
      ? "Paper"
      : active.entityType === "custom"
      ? "Custom Event"
      : `Session (${KIND_LABEL[active.kind] || active.kind})`;
  list.appendChild(detailRow("Type", typeLabel));
  list.appendChild(detailRow("Priority", LEVEL_LABEL[active.level] || active.level));
  if (session?.track) list.appendChild(detailRow("Topic", session.track));
  if (active.entityType === "custom" && active.description) list.appendChild(detailRow("Notes", active.description));
  if (active.entityType === "paper") {
    list.appendChild(detailRow("Session", active.sessionTitle || session?.title || "Session"));
  } else {
    const summary = getSessionDescriptionForPlan(session);
    if (summary) list.appendChild(detailRow("Session Detail", summary));
    const authors = getSessionDetailsAuthors(session);
    if (authors) {
      const authorsText = document.createElement("p");
      authorsText.className = "details-row";
      authorsText.textContent = authors;
      list.appendChild(authorsText);
    }
  }

  const decisionGroup = document.createElement("div");
  decisionGroup.className = "decision-group";
  for (const option of DECISIONS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "decision-btn";
    btn.textContent = DECISION_LABEL[option];
    if (option === decision) btn.classList.add(`active-${option}`);
    btn.addEventListener("click", () => {
      setDecision(active.id, option);
    });
    decisionGroup.appendChild(btn);
  }

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "btn secondary details-action-btn";
  clearBtn.textContent = "Clear Decision";
  clearBtn.addEventListener("click", () => {
    clearDecision(active.id);
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "btn secondary details-action-btn details-remove";
  removeBtn.textContent = active.entityType === "custom" ? "Delete Event" : "Remove From Plan";
  removeBtn.addEventListener("click", () => {
    removeItemFromPlan(active);
  });

  const linkRow = document.createElement("div");
  linkRow.className = "details-linkrow";
  if (active.paperUrl) {
    const paperLinkBtn = document.createElement("a");
    paperLinkBtn.className = "btn secondary details-action-btn details-action-link";
    paperLinkBtn.href = active.paperUrl;
    paperLinkBtn.target = "_blank";
    paperLinkBtn.rel = "noreferrer";
    paperLinkBtn.textContent = "Open Paper PDF";
    linkRow.appendChild(paperLinkBtn);
  }
  if (active.detailsUrl) {
    const detailsLinkBtn = document.createElement("a");
    detailsLinkBtn.className = "btn secondary details-action-btn details-action-link";
    detailsLinkBtn.href = active.detailsUrl;
    detailsLinkBtn.target = "_blank";
    detailsLinkBtn.rel = "noreferrer";
    detailsLinkBtn.textContent = active.entityType === "paper" ? "Open Paper Details" : "Open Session Source";
    linkRow.appendChild(detailsLinkBtn);
  }

  const abstractWrap = document.createElement("div");
  abstractWrap.className = "details-abstract";
  const abstractTitle = document.createElement("p");
  abstractTitle.className = "details-row";
  abstractTitle.innerHTML = "<strong>Abstracts</strong>";
  const abstract = document.createElement("p");
  abstract.textContent = paper?.abstract || active.description || getSessionDescriptionForPlan(session) || "No additional details.";
  abstractWrap.append(abstractTitle, abstract);

  const noteWrap = document.createElement("div");
  noteWrap.className = "details-note-wrap";
  const noteLabel = document.createElement("p");
  noteLabel.className = "details-row";
  noteLabel.innerHTML = "<strong>Personal Note</strong>";
  const noteInput = document.createElement("textarea");
  noteInput.className = "details-note-input";
  noteInput.rows = 4;
  noteInput.placeholder = "Add your note for this event...";
  noteInput.value = getEventNote(active.id);
  const noteActions = document.createElement("div");
  noteActions.className = "details-note-actions";
  const saveNoteBtn = document.createElement("button");
  saveNoteBtn.type = "button";
  saveNoteBtn.className = "btn secondary details-action-btn";
  saveNoteBtn.textContent = "Save Note";
  saveNoteBtn.addEventListener("click", () => {
    setEventNote(active.id, noteInput.value);
    setStatus("Saved note for this event.", false);
  });
  const clearNoteBtn = document.createElement("button");
  clearNoteBtn.type = "button";
  clearNoteBtn.className = "btn secondary details-action-btn";
  clearNoteBtn.textContent = "Clear Note";
  clearNoteBtn.addEventListener("click", () => {
    noteInput.value = "";
    setEventNote(active.id, "");
    setStatus("Cleared note for this event.", false);
  });
  noteActions.append(saveNoteBtn, clearNoteBtn);
  noteWrap.append(noteLabel, noteInput, noteActions);

  const actionRow = document.createElement("div");
  actionRow.className = "details-action-row";
  actionRow.append(clearBtn, removeBtn);

  const bottomActions = document.createElement("div");
  bottomActions.className = "details-bottom-actions";
  bottomActions.append(decisionGroup, actionRow);

  card.append(title, meta, list, bottomActions, noteWrap);
  card.appendChild(abstractWrap);
  if (linkRow.childElementCount > 0) card.appendChild(linkRow);
  el.eventDetails.appendChild(card);
}

function detailRow(label, value) {
  const row = document.createElement("p");
  row.className = "details-row";
  row.innerHTML = `<strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || "N/A")}`;
  return row;
}

function computeCalendarBounds(days, items) {
  const daySet = new Set(days.map((day) => day.id));
  const mins = [];
  for (const session of state.data.sessions) {
    if (!daySet.has(session.dayId)) continue;
    mins.push(minutesOfDay(session.start), minutesOfDay(session.end));
  }
  for (const item of items) {
    mins.push(minutesOfDay(item.start), minutesOfDay(item.end));
  }
  const valid = mins.filter((value) => Number.isFinite(value) && value >= 0);
  const minMinute = valid.length ? Math.min(...valid) : 8 * 60;
  const maxMinute = valid.length ? Math.max(...valid) : 18 * 60;
  const startHour = Math.max(6, Math.floor(minMinute / 60) - 1);
  const endHour = Math.min(23, Math.ceil(maxMinute / 60) + 1);
  return {
    startHour,
    endHour: Math.max(endHour, startHour + 8),
    startMinute: startHour * 60,
  };
}

function assignDayLanes(items) {
  const sorted = [...items].sort(sortPlanItems);
  if (!sorted.length) return sorted;

  const groups = [];
  let currentGroup = [];
  let currentGroupMaxEnd = -1;

  for (const item of sorted) {
    const start = minutesOfDay(item.start);
    const end = Math.max(minutesOfDay(item.end), start + 1);

    if (!currentGroup.length || start < currentGroupMaxEnd) {
      currentGroup.push(item);
      currentGroupMaxEnd = Math.max(currentGroupMaxEnd, end);
      continue;
    }

    groups.push(currentGroup);
    currentGroup = [item];
    currentGroupMaxEnd = end;
  }
  if (currentGroup.length) groups.push(currentGroup);

  const laidOut = [];
  for (const group of groups) laidOut.push(...layoutLaneGroup(group));
  return laidOut;
}

function layoutLaneGroup(group) {
  const active = [];
  let maxLane = 1;

  for (const item of group) {
    const start = minutesOfDay(item.start);
    active.splice(
      0,
      active.length,
      ...active.filter((entry) => entry.end > start)
    );
    const used = new Set(active.map((entry) => entry.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;

    const end = Math.max(minutesOfDay(item.end), start + 1);
    active.push({ lane, end });
    item.lane = lane;
    maxLane = Math.max(maxLane, lane + 1);
  }

  for (const item of group) item.laneCount = maxLane;
  return group;
}

function buildPlanItems() {
  const items = [];

  for (const paper of state.data.papers) {
    const level = getPaperLevel(paper.id);
    if (level === "none") continue;
    const session = state.sessionMap.get(paper.sessionId);
    const presentation = getPaperPresentationWindow(paper, session);
    items.push({
      id: `paper:${paper.id}`,
      entityType: "paper",
      level,
      title: paper.title,
      sessionId: paper.sessionId,
      sessionTitle: session?.title || "Session",
      kind: "technical",
      location: paper.location || session?.location || "TBD",
      start: presentation.start,
      end: presentation.end,
      detailsUrl: paper.detailsUrl || "",
      paperUrl: paper.paperUrl || "",
      description: paper.abstract || "",
      userNote: getEventNote(`paper:${paper.id}`),
      dayId: paper.dayId,
    });
  }

  for (const session of state.data.sessions) {
    const level = getSessionLevel(session.id);
    if (level === "none") continue;

    let includeSession = true;
    if (session.kind === "technical") {
      const paperLevels = (session.paperIds || []).map((paperId) => getPaperLevel(paperId)).filter((l) => l !== "none");
      if (paperLevels.length > 0) {
        const highestPaperLevel = paperLevels.reduce((max, current) =>
          LEVEL_WEIGHT[current] > LEVEL_WEIGHT[max] ? current : max
        );
        includeSession = LEVEL_WEIGHT[level] > LEVEL_WEIGHT[highestPaperLevel];
      }
    }
    if (!includeSession) continue;

    items.push({
      id: `session:${session.id}`,
      entityType: "session",
      level,
      title: session.title,
      sessionId: session.id,
      sessionTitle: session.title,
      kind: session.kind,
      location: session.location || "TBD",
      start: session.start,
      end: session.end,
      detailsUrl: session.sourceUrl || "",
      paperUrl: "",
      description: getSessionDescriptionForPlan(session),
      userNote: getEventNote(`session:${session.id}`),
      dayId: session.dayId,
    });
  }

  for (const custom of state.customEvents) {
    items.push({
      id: custom.id,
      entityType: "custom",
      level: normalizeLevel(custom.level || "interested"),
      title: custom.title,
      sessionId: "",
      sessionTitle: "Custom Event",
      kind: "event",
      location: custom.location || "TBD",
      start: custom.start,
      end: custom.end,
      detailsUrl: "",
      paperUrl: "",
      description: custom.notes || "",
      userNote: getEventNote(custom.id),
      dayId: `day-${isoDay(custom.start)}`,
      track: "Custom",
      authorsText: "",
    });
  }

  return items.sort(sortPlanItems);
}

function removeItemFromPlan(item) {
  if (item.entityType === "paper") {
    const paperId = item.id.slice("paper:".length);
    delete state.priorities.papers[paperId];
  } else if (item.entityType === "session") {
    const sessionId = item.id.slice("session:".length);
    delete state.priorities.sessions[sessionId];
  } else if (item.entityType === "custom") {
    state.customEvents = state.customEvents.filter((custom) => custom.id !== item.id);
  }
  delete state.decisions[item.id];
  delete state.eventNotes[item.id];
  state.activeCalendarItemId = "";
  persistProfile();
  renderAll();
}

function renderCustomEventForm() {
  el.customEventFormWrap.classList.toggle("hidden", !state.showCustomForm);
  el.addCustomEventBtn.textContent = state.showCustomForm ? "Close Custom Event" : "Add Custom Event";
}

function primeCustomEventForm() {
  const day = getVisibleDays()[0] || state.data.days[0];
  const date = (day?.date || isoDay(new Date().toISOString())).slice(0, 10);
  el.customDate.value = date;
  el.customStartTime.value = "12:00";
  el.customEndTime.value = "12:30";
  el.customPriority.value = "interested";
  el.customTitle.value = "";
  el.customLocation.value = "";
  el.customNotes.value = "";
}

function readCustomEventFromForm() {
  const title = (el.customTitle.value || "").trim();
  const date = (el.customDate.value || "").trim();
  const startTime = (el.customStartTime.value || "").trim();
  const endTime = (el.customEndTime.value || "").trim();
  const level = normalizeLevel(el.customPriority.value || "interested");
  const location = (el.customLocation.value || "").trim();
  const notes = (el.customNotes.value || "").trim();

  if (!title) return { ok: false, error: "Custom event title is required." };
  if (!date || !startTime || !endTime) return { ok: false, error: "Custom event date/start/end are required." };

  const start = `${date}T${startTime}:00`;
  const end = `${date}T${endTime}:00`;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false, error: "Custom event time is invalid." };
  }
  if (endDate.getTime() <= startDate.getTime()) {
    return { ok: false, error: "Custom event end time must be after start time." };
  }

  const id = `custom:${slug(`${date}-${startTime}-${title}-${Date.now()}`)}`;
  return {
    ok: true,
    value: {
      id,
      title,
      start: toLocalIso(startDate),
      end: toLocalIso(endDate),
      location,
      notes,
      level,
    },
  };
}

function normalizeCustomEvent(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" && raw.id.startsWith("custom:") ? raw.id : `custom:${slug(`${raw.title || "event"}-${raw.start || ""}`)}`;
  const title = String(raw.title || "").trim();
  const start = String(raw.start || "").trim();
  const end = String(raw.end || "").trim();
  if (!title || !start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) return null;
  return {
    id,
    title,
    start: toLocalIso(startDate),
    end: toLocalIso(endDate),
    location: String(raw.location || "").trim(),
    notes: String(raw.notes || "").trim(),
    level: normalizeLevel(raw.level || "interested"),
  };
}

function groupSessionsByDay(sessions) {
  const map = new Map();
  for (const session of sessions) {
    if (!map.has(session.dayId)) map.set(session.dayId, []);
    map.get(session.dayId).push(session);
  }
  for (const [dayId, group] of map.entries()) {
    map.set(dayId, group.sort(sortByStartThenTitle));
  }
  return map;
}

function getPaperPresentationWindow(paper, session) {
  const fallbackStart = paper.start || session?.start || "";
  const fallbackEnd = paper.end || session?.end || "";

  if (!session || !Array.isArray(session.paperIds) || !session.paperIds.length) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const index = session.paperIds.indexOf(paper.id);
  if (index < 0) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const sessionStart = new Date(session.start);
  if (Number.isNaN(sessionStart.getTime())) {
    return { start: fallbackStart, end: fallbackEnd };
  }

  const sessionEnd = new Date(session.end);
  const hasValidEnd = !Number.isNaN(sessionEnd.getTime()) && sessionEnd.getTime() > sessionStart.getTime();

  let startMs = sessionStart.getTime() + index * PAPER_SLOT_MINUTES * 60 * 1000;
  if (hasValidEnd && startMs >= sessionEnd.getTime()) {
    startMs = Math.max(sessionStart.getTime(), sessionEnd.getTime() - PAPER_SLOT_MINUTES * 60 * 1000);
  }

  let endMs = startMs + PAPER_SLOT_MINUTES * 60 * 1000;
  if (hasValidEnd) {
    endMs = Math.min(endMs, sessionEnd.getTime());
    if (endMs <= startMs) {
      endMs = Math.min(sessionEnd.getTime(), startMs + 5 * 60 * 1000);
    }
  }

  return {
    start: toLocalIso(new Date(startMs)),
    end: toLocalIso(new Date(endMs)),
  };
}

function groupSessionsBySlot(sessions) {
  const map = new Map();
  for (const session of sessions) {
    const key = `${session.start}|${session.end}`;
    if (!map.has(key)) map.set(key, { start: session.start, end: session.end, sessions: [] });
    map.get(key).sessions.push(session);
  }
  return [...map.values()]
    .map((slot) => ({
      ...slot,
      sessions: slot.sessions.sort((a, b) => {
        const kindCompare = (KIND_LABEL[a.kind] || a.kind).localeCompare(KIND_LABEL[b.kind] || b.kind);
        if (kindCompare !== 0) return kindCompare;
        return (a.title || "").localeCompare(b.title || "");
      }),
    }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function sortByStartThenTitle(a, b) {
  const ta = new Date(a.start).getTime();
  const tb = new Date(b.start).getTime();
  if (ta !== tb) return ta - tb;
  return (a.title || "").localeCompare(b.title || "");
}

function sortPlanItems(a, b) {
  const ta = new Date(a.start).getTime();
  const tb = new Date(b.start).getTime();
  if (ta !== tb) return ta - tb;
  if (LEVEL_WEIGHT[a.level] !== LEVEL_WEIGHT[b.level]) return LEVEL_WEIGHT[b.level] - LEVEL_WEIGHT[a.level];
  return (a.title || "").localeCompare(b.title || "");
}

function getVisibleDays() {
  const base = [...state.data.days];
  const existing = new Set(base.map((day) => day.id));
  for (const custom of state.customEvents) {
    const date = isoDay(custom.start);
    const id = `day-${date}`;
    if (!date || existing.has(id)) continue;
    base.push({
      id,
      date,
      label: fmtDay(date),
      sessionIds: [],
    });
    existing.add(id);
  }
  base.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (state.filters.day === "all") return base;
  return base.filter((day) => day.id === state.filters.day);
}

function getSessionLevel(sessionId) {
  return normalizeLevel(state.priorities.sessions[sessionId] || "none");
}

function getPaperLevel(paperId) {
  return normalizeLevel(state.priorities.papers[paperId] || "none");
}

function getDecision(itemId) {
  return normalizeDecision(state.decisions[itemId] || "");
}

function getEventNote(itemId) {
  return String(state.eventNotes[itemId] || "");
}

function setSessionLevel(sessionId, level) {
  const normalized = normalizeLevel(level);
  if (normalized === "none") delete state.priorities.sessions[sessionId];
  else state.priorities.sessions[sessionId] = normalized;
  persistProfile();
  renderAll();
}

function setPaperLevel(paperId, level) {
  const normalized = normalizeLevel(level);
  if (normalized === "none") delete state.priorities.papers[paperId];
  else state.priorities.papers[paperId] = normalized;
  persistProfile();
  renderAll();
}

function normalizeLevel(level) {
  return LEVELS.includes(level) ? level : "none";
}

function normalizeDecision(decision) {
  return DECISIONS.includes(decision) ? decision : "";
}

function setDecision(itemId, decision) {
  const normalized = normalizeDecision(decision);
  if (!normalized) delete state.decisions[itemId];
  else state.decisions[itemId] = normalized;
  persistProfile();
  renderPlanner();
}

function clearDecision(itemId) {
  delete state.decisions[itemId];
  persistProfile();
  renderPlanner();
}

function setEventNote(itemId, note) {
  const normalized = String(note || "").trim();
  if (!normalized) delete state.eventNotes[itemId];
  else state.eventNotes[itemId] = normalized;
  persistProfile();
}

function loadSavedProfile() {
  if (!state.profileStorageKey) return;
  try {
    const parsed = JSON.parse(localStorage.getItem(state.profileStorageKey) || "null");
    if (!parsed) return;
    applyProfile(parsed, false);
  } catch {
    state.priorities.sessions = {};
    state.priorities.papers = {};
    state.decisions = {};
    state.eventNotes = {};
    state.customEvents = [];
  }
}

function applyProfile(profile, persistAfterApply) {
  const nextSessions = {};
  const nextPapers = {};
  const nextDecisions = {};
  const nextNotes = {};
  const nextCustomEvents = [];
  const sourceSessions = profile?.sessionPriorities || {};
  const sourcePapers = profile?.paperPriorities || {};
  const sourceDecisions = profile?.finalDecisions || {};
  const sourceNotes = profile?.eventNotes || {};
  const sourceCustomEvents = Array.isArray(profile?.customEvents) ? profile.customEvents : [];

  for (const [sessionId, level] of Object.entries(sourceSessions)) {
    if (!state.sessionMap.has(sessionId)) continue;
    const normalized = normalizeLevel(level);
    if (normalized !== "none") nextSessions[sessionId] = normalized;
  }

  for (const [paperId, level] of Object.entries(sourcePapers)) {
    if (!state.paperMap.has(paperId)) continue;
    const normalized = normalizeLevel(level);
    if (normalized !== "none") nextPapers[paperId] = normalized;
  }

  for (const [itemId, decision] of Object.entries(sourceDecisions)) {
    const normalized = normalizeDecision(decision);
    if (!normalized) continue;
    nextDecisions[itemId] = normalized;
  }

  for (const [itemId, note] of Object.entries(sourceNotes)) {
    const normalized = String(note || "").trim();
    if (!normalized) continue;
    nextNotes[itemId] = normalized;
  }

  for (const custom of sourceCustomEvents) {
    const parsed = normalizeCustomEvent(custom);
    if (parsed) nextCustomEvents.push(parsed);
  }

  state.priorities.sessions = nextSessions;
  state.priorities.papers = nextPapers;
  state.decisions = nextDecisions;
  state.eventNotes = nextNotes;
  state.customEvents = nextCustomEvents;
  state.activeCalendarItemId = "";
  if (persistAfterApply) persistProfile();
  renderAll();
}

function persistProfile() {
  if (!state.profileStorageKey) return;
  localStorage.setItem(state.profileStorageKey, JSON.stringify(buildProfilePayload()));
}

function buildProfilePayload() {
  return {
    version: PROFILE_VERSION,
    conferenceId: state.data.conference.id,
    savedAt: new Date().toISOString(),
    sessionPriorities: state.priorities.sessions,
    paperPriorities: state.priorities.papers,
    finalDecisions: state.decisions,
    eventNotes: state.eventNotes,
    customEvents: state.customEvents,
  };
}

function getCalendarExportItems() {
  const items = buildPlanItems();
  if (!items.length) {
    setStatus("Select at least one paper/session before exporting calendar.", true);
    return null;
  }
  const hasFinalDecisions = items.some((item) => DECISIONS.includes(getDecision(item.id)));
  const exportItems = hasFinalDecisions
    ? items.filter((item) => {
        const decision = getDecision(item.id);
        return decision === "attend" || decision === "maybe";
      })
    : items;
  if (!exportItems.length) {
    setStatus("No Attend/Maybe events to export. Update final decisions first.", true);
    return null;
  }
  return exportItems;
}

function buildIcs(items, calendarName) {
  const conferenceId = state.data?.conference?.id || "conference";
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${escapeIcs(conferenceId)} Planner//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  const stamp = toIcsDate(new Date(), false);

  for (const item of items) {
    const startDate = new Date(item.start);
    const endDate = new Date(item.end);
    const safeEnd = Number.isNaN(endDate.getTime()) ? new Date(startDate.getTime() + 60 * 60 * 1000) : endDate;
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${escapeIcs(item.id)}-${Date.now()}@conference-planner`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toIcsDate(startDate, true)}`);
    lines.push(`DTEND:${toIcsDate(safeEnd, true)}`);
    lines.push(`SUMMARY:${escapeIcs(`${item.level === "must_go" ? "[Must-Go] " : ""}${item.title}`)}`);
    lines.push(`LOCATION:${escapeIcs(item.location || "TBD")}`);
    const descriptionParts = [item.sessionTitle, item.description].filter(Boolean);
    if (item.userNote) descriptionParts.push(`Note: ${item.userNote}`);
    lines.push(`DESCRIPTION:${escapeIcs(descriptionParts.join(" | "))}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function toIcsDate(date, floating) {
  const year = floating ? date.getFullYear() : date.getUTCFullYear();
  const month = floating ? date.getMonth() + 1 : date.getUTCMonth() + 1;
  const day = floating ? date.getDate() : date.getUTCDate();
  const hour = floating ? date.getHours() : date.getUTCHours();
  const minute = floating ? date.getMinutes() : date.getUTCMinutes();
  const second = floating ? date.getSeconds() : date.getUTCSeconds();
  const base = `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}${pad2(second)}`;
  return floating ? base : `${base}Z`;
}

function escapeIcs(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function downloadTextFile(name, contents, mimeType) {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function setStatus(message, isError) {
  el.statusMessage.textContent = message;
  el.statusMessage.style.color = isError ? "#a83f1a" : "#3f6050";
}

function createEmpty(text) {
  const node = document.createElement("p");
  node.className = "empty";
  node.textContent = text;
  return node;
}

function fmtDateRange(start, end) {
  if (!start) return "Time TBD";
  const sd = new Date(start);
  const ed = end ? new Date(end) : null;
  const day = sd.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const st = sd.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const et = ed ? ed.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "TBD";
  return `${day} ${st}-${et}`;
}

function fmtDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || "");
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtTime(value) {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(isoDate) {
  if (!isoDate) return "Unknown day";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

function formatHourLabel(hour24) {
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = ((hour24 + 11) % 12) + 1;
  return `${hour12}:00 ${period}`;
}

function minutesOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getHours() * 60 + date.getMinutes();
}

function toLocalIso(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(
    date.getMinutes()
  )}:${pad2(date.getSeconds())}`;
}

function isoDay(isoDateTime) {
  return typeof isoDateTime === "string" ? isoDateTime.slice(0, 10) : "";
}

function badgeHtml(text) {
  return `<span class="badge">${escapeHtml(text)}</span>`;
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function uniq(values) {
  return [...new Set(values)];
}

function chunkArray(values, size) {
  const normalizedSize = Math.max(1, Math.floor(size || 1));
  const chunks = [];
  for (let index = 0; index < values.length; index += normalizedSize) {
    chunks.push(values.slice(index, index + normalizedSize));
  }
  return chunks;
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
