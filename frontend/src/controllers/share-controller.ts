// @ts-nocheck
import { normalizeLocalDateTimeText } from "./time-utils";

const SHARE_VERSION = "1";
const SHARE_DEFAULT_EXPIRY_DAYS = 7;
const SHARE_MAX_EXPIRY_DAYS = 90;
const MAX_SOCIAL_TAGS = 3;
const DEFAULT_FIELD_MASK = {
  location: false,
  sessionTitle: false,
  description: false,
  links: false,
};
const SOCIAL_TAGS_BY_CONFERENCE = {
  "ndss-2026": ["#NDSS2026", "#CyberSecurity", "#InfoSec"],
  "chi-2026": ["#CHI2026", "#HCI"],
};

export function createShareController(deps) {
    const {
      state,
      el,
      buildPlanItems,
      setStatus,
      createEmpty,
      fmtDay,
      fmtTime,
      fmtDateTime,
      toDatetimeLocal,
      isoDay,
    } = deps || {};

    if (!state || !el || typeof buildPlanItems !== "function") {
      throw new Error("Share controller dependencies are incomplete.");
    }

    function createInitialShareState() {
      return {
        isOpen: false,
        shareName: "",
        includeNotes: false,
        fieldMask: { ...DEFAULT_FIELD_MASK },
        expiryMode: String(SHARE_DEFAULT_EXPIRY_DAYS),
        expiryCustomValue: "",
        events: [],
        activeEventId: "",
        published: null,
        status: "",
        statusError: false,
      };
    }

    function bindEvents() {
      el.shareScheduleBtn.addEventListener("click", () => {
        openComposer();
      });

      el.closeShareComposerBtn.addEventListener("click", () => {
        closeComposer();
      });

      el.shareComposerModal.addEventListener("click", (event) => {
        if (event.target === el.shareComposerModal) closeComposer();
      });

      el.shareNameInput.addEventListener("input", (event) => {
        state.share.shareName = String(event.target.value || "").trimStart();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && state.share?.isOpen) {
          closeComposer();
        }
      });

      el.shareExpiryMode.addEventListener("change", (event) => {
        const nextMode = String(event.target.value || "").trim();
        state.share.expiryMode =
          nextMode === "custom" || nextMode === "3" || nextMode === "7" || nextMode === "14"
            ? nextMode
            : String(SHARE_DEFAULT_EXPIRY_DAYS);
        if (state.share.expiryMode === "custom" && !state.share.expiryCustomValue) {
          state.share.expiryCustomValue = toDatetimeLocal(
            new Date(Date.now() + SHARE_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
          );
        }
        renderComposer();
      });

      el.shareExpiryCustomInput.addEventListener("change", (event) => {
        state.share.expiryCustomValue = String(event.target.value || "").trim();
      });

      el.shareIncludeNotes.addEventListener("change", (event) => {
        state.share.includeNotes = Boolean(event.target.checked);
        renderComposer();
      });

      el.shareMaskLocation.addEventListener("change", (event) => {
        state.share.fieldMask.location = Boolean(event.target.checked);
        renderComposerBody();
      });

      el.shareMaskSession.addEventListener("change", (event) => {
        state.share.fieldMask.sessionTitle = Boolean(event.target.checked);
        renderComposerBody();
      });

      el.shareMaskDescription.addEventListener("change", (event) => {
        state.share.fieldMask.description = Boolean(event.target.checked);
        renderComposerBody();
      });

      el.shareMaskLinks.addEventListener("change", (event) => {
        state.share.fieldMask.links = Boolean(event.target.checked);
        renderComposerBody();
      });

      el.shareIncludeAllBtn.addEventListener("click", () => {
        for (const event of state.share.events) event.include = true;
        renderComposerBody();
      });

      el.shareExcludeAllBtn.addEventListener("click", () => {
        for (const event of state.share.events) event.include = false;
        renderComposerBody();
      });

      el.publishShareBtn.addEventListener("click", async () => {
        await publishShareLink();
      });

      el.closeShareResultBtn.addEventListener("click", () => {
        dismissPublishedShare();
      });

      el.shareResultWrap.addEventListener("click", (event) => {
        if (event.target === el.shareResultWrap) dismissPublishedShare();
      });

      window.addEventListener("resize", () => {
        if (state.share?.published?.shareUrl) positionPublishedShareCard();
      });

      el.copyShareLinkBtn.addEventListener("click", async () => {
        await copyPublishedShareLink();
      });

      el.shareOnXBtn.addEventListener("click", () => openPublishedShare("x"));
      el.shareOnFacebookBtn.addEventListener("click", () => openPublishedShare("facebook"));
      el.shareOnLinkedInBtn.addEventListener("click", () => openPublishedShare("linkedin"));
      el.shareOnBlueskyBtn.addEventListener("click", () => openPublishedShare("bluesky"));
    }

    function openComposer() {
      const items = buildPlanItems();
      if (!items.length) {
        setStatus("Select at least one event in the planner before sharing.", true);
        return;
      }
      state.share.isOpen = true;
      state.share.shareName = defaultShareName();
      state.share.includeNotes = false;
      state.share.fieldMask = { ...DEFAULT_FIELD_MASK };
      state.share.expiryMode = String(SHARE_DEFAULT_EXPIRY_DAYS);
      state.share.expiryCustomValue = toDatetimeLocal(new Date(Date.now() + SHARE_DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000));
      state.share.events = buildShareDraftEvents(items);
      state.share.activeEventId = state.share.events[0]?.sourceEventId || "";
      state.share.published = null;
      setComposerStatus("", false);
      renderComposer();
    }

    function closeComposer() {
      state.share.isOpen = false;
      renderComposer();
    }

    function buildShareDraftEvents(items) {
      return items.map((item, index) => ({
        sourceEventId: item.id,
        entityType: item.entityType,
        include: true,
        sortOrder: index,
        title: item.title || "",
        start: toDatetimeLocal(new Date(item.start)),
        end: toDatetimeLocal(new Date(item.end)),
        location: item.location || "",
        description: item.description || "",
        sessionTitle: item.sessionTitle || "",
        links: {
          paperUrl: item.paperUrl || "",
          detailsUrl: item.detailsUrl || "",
        },
        notes: item.userNote || "",
      }));
    }

    function renderComposer() {
      el.shareComposerModal.classList.toggle("hidden", !state.share?.isOpen);
      if (!state.share?.isOpen) return;

      el.shareNameInput.value = state.share.shareName || "";
      el.shareExpiryMode.value = state.share.expiryMode;
      const showCustomExpiry = state.share.expiryMode === "custom";
      el.shareExpiryCustomWrap.classList.toggle("hidden", !showCustomExpiry);
      el.shareExpiryCustomInput.value = state.share.expiryCustomValue || "";
      el.shareIncludeNotes.checked = state.share.includeNotes;
      el.shareMaskLocation.checked = Boolean(state.share.fieldMask?.location);
      el.shareMaskSession.checked = Boolean(state.share.fieldMask?.sessionTitle);
      el.shareMaskDescription.checked = Boolean(state.share.fieldMask?.description);
      el.shareMaskLinks.checked = Boolean(state.share.fieldMask?.links);

      renderComposerBody();
      renderShareResult();
    }

    function defaultShareName() {
      const conferenceName = String(state.data?.conference?.name || "Conference").trim();
      const dayLabel = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `${conferenceName} - ${dayLabel}`;
    }

    function renderComposerBody() {
      renderShareCalendar();
      renderShareEventEditor();
    }

    function renderShareCalendar() {
      el.shareCalendarWrap.textContent = "";
      if (!state.share.events.length) {
        el.shareCalendarWrap.appendChild(createEmpty("No events available in the current planner state."));
        return;
      }

      const includedCount = state.share.events.filter((event) => event.include).length;
      const summary = document.createElement("p");
      summary.className = "status";
      summary.textContent = `${includedCount}/${state.share.events.length} events selected for sharing`;
      el.shareCalendarWrap.appendChild(summary);

      const dayGroups = new Map();
      for (const shareEvent of state.share.events) {
        const dayKey = isoDay(shareEvent.start) || "unscheduled";
        if (!dayGroups.has(dayKey)) dayGroups.set(dayKey, []);
        dayGroups.get(dayKey).push(shareEvent);
      }

      const days = [...dayGroups.keys()].sort((a, b) => a.localeCompare(b));
      const daysWrap = document.createElement("div");
      daysWrap.className = "share-calendar-days";

      for (const dayKey of days) {
        const dayColumn = document.createElement("section");
        dayColumn.className = "share-calendar-day";

        const dayTitle = document.createElement("h4");
        dayTitle.className = "share-calendar-day-title";
        dayTitle.textContent = dayKey === "unscheduled" ? "Unscheduled" : fmtDay(dayKey);
        dayColumn.appendChild(dayTitle);

        const eventsWrap = document.createElement("div");
        eventsWrap.className = "share-calendar-events";

        const events = (dayGroups.get(dayKey) || []).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        for (const shareEvent of events) {
          const eventCard = document.createElement("button");
          eventCard.type = "button";
          eventCard.className = `share-calendar-event${shareEvent.include ? "" : " excluded"}${
            shareEvent.sourceEventId === state.share.activeEventId ? " active" : ""
          }`;
          eventCard.addEventListener("click", () => {
            state.share.activeEventId = shareEvent.sourceEventId;
            renderComposerBody();
          });

          const row = document.createElement("div");
          row.className = "share-calendar-event-row";
          const include = document.createElement("input");
          include.type = "checkbox";
          include.checked = Boolean(shareEvent.include);
          include.addEventListener("click", (event) => event.stopPropagation());
          include.addEventListener("change", () => {
            shareEvent.include = include.checked;
            renderComposerBody();
          });
          const eventTitle = document.createElement("p");
          eventTitle.className = "share-calendar-event-title";
          eventTitle.textContent = shareEvent.title || "Untitled event";
          row.append(include, eventTitle);

          const eventMeta = document.createElement("p");
          eventMeta.className = "share-calendar-event-meta";
          eventMeta.textContent = `${fmtTime(shareEvent.start)}-${fmtTime(shareEvent.end)} • ${shareEvent.location || "TBD"}`;

          const kind = document.createElement("p");
          kind.className = "share-calendar-event-kind";
          kind.textContent = shareEvent.entityType;

          eventCard.append(row, eventMeta, kind);
          eventsWrap.appendChild(eventCard);
        }
        dayColumn.appendChild(eventsWrap);
        daysWrap.appendChild(dayColumn);
      }

      el.shareCalendarWrap.appendChild(daysWrap);
    }

    function renderShareEventEditor() {
      el.shareEventEditorWrap.textContent = "";
      if (!state.share.events.length) return;

      let shareEvent = state.share.events.find((event) => event.sourceEventId === state.share.activeEventId);
      if (!shareEvent) {
        shareEvent = state.share.events[0];
        state.share.activeEventId = shareEvent.sourceEventId;
      }

      const card = document.createElement("article");
      card.className = "share-event-editor";

      const head = document.createElement("div");
      head.className = "share-event-editor-head";
      const title = document.createElement("h4");
      title.className = "session-title";
      title.textContent = "Edit Selected Event Details";
      head.append(title);
      card.appendChild(head);

      const fields = document.createElement("div");
      fields.className = "share-event-fields";
      fields.appendChild(
        makeShareField("Title", "text", shareEvent.title, (value) => {
          shareEvent.title = value;
          renderShareCalendar();
        })
      );
      fields.appendChild(
        makeShareField("Start", "datetime-local", shareEvent.start, (value) => {
          shareEvent.start = value;
          renderShareCalendar();
        })
      );
      fields.appendChild(
        makeShareField("End", "datetime-local", shareEvent.end, (value) => {
          shareEvent.end = value;
          renderShareCalendar();
        })
      );
      fields.appendChild(
        makeShareField("Location", "text", shareEvent.location, (value) => {
          shareEvent.location = value;
          renderShareCalendar();
        }, Boolean(state.share.fieldMask?.location))
      );
      fields.appendChild(
        makeShareField("Session", "text", shareEvent.sessionTitle, (value) => {
          shareEvent.sessionTitle = value;
        }, Boolean(state.share.fieldMask?.sessionTitle))
      );
      fields.appendChild(
        makeShareField("Description", "textarea", shareEvent.description, (value) => {
          shareEvent.description = value;
        }, Boolean(state.share.fieldMask?.description))
      );
      fields.appendChild(
        makeShareField("Paper URL", "url", shareEvent.links.paperUrl, (value) => {
          shareEvent.links.paperUrl = value;
        }, Boolean(state.share.fieldMask?.links))
      );
      fields.appendChild(
        makeShareField("Details URL", "url", shareEvent.links.detailsUrl, (value) => {
          shareEvent.links.detailsUrl = value;
        }, Boolean(state.share.fieldMask?.links))
      );
      fields.appendChild(
        makeShareField(
          "Notes",
          "textarea",
          shareEvent.notes,
          (value) => {
            shareEvent.notes = value;
          },
          !state.share.includeNotes
        )
      );
      card.appendChild(fields);
      el.shareEventEditorWrap.appendChild(card);
    }

    function makeShareField(label, type, value, onChange, disabled = false) {
      const field = document.createElement("label");
      field.className = "share-field";
      const title = document.createElement("span");
      title.textContent = label;
      field.appendChild(title);

      const normalizedType = type === "textarea" ? "textarea" : "input";
      const input = document.createElement(normalizedType);
      if (normalizedType === "input") {
        input.type = type;
      } else {
        input.rows = 2;
      }
      input.value = value || "";
      input.disabled = Boolean(disabled);
      input.addEventListener("input", () => onChange(String(input.value || "")));
      field.appendChild(input);
      return field;
    }

    function renderShareResult() {
      const published = state.share.published;
      const hasPublished = Boolean(published?.shareUrl);
      el.shareResultWrap.classList.toggle("hidden", !hasPublished);
      if (!hasPublished) return;
      el.shareUrlOutput.value = published.shareUrl;
      el.shareExpiryText.textContent = `Link expires ${fmtDateTime(published.expiresAt)}.`;
      positionPublishedShareCard();
    }

    function dismissPublishedShare() {
      state.share.published = null;
      renderShareResult();
    }

    function positionPublishedShareCard() {
      const card = el.shareResultWrap.querySelector(".share-result-card");
      if (!card) return;

      const triggerRect = el.publishShareBtn.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const spacing = 12;
      const viewportPadding = 12;

      let left = triggerRect.right - cardRect.width;
      left = Math.max(viewportPadding, Math.min(left, window.innerWidth - cardRect.width - viewportPadding));

      let top = triggerRect.top - cardRect.height - spacing;
      if (top < viewportPadding) {
        top = Math.min(
          triggerRect.bottom + spacing,
          window.innerHeight - cardRect.height - viewportPadding
        );
      }

      card.style.left = `${Math.round(left)}px`;
      card.style.top = `${Math.round(top)}px`;
    }

    function setComposerStatus(message, isError) {
      state.share.status = message;
      state.share.statusError = Boolean(isError);
      el.shareComposerStatus.textContent = message;
      el.shareComposerStatus.style.color = isError ? "#a83f1a" : "#3f6050";
    }

    async function publishShareLink() {
      try {
        const payload = buildSharePayload();
        setComposerStatus("Publishing share link...", false);
        const response = await fetch("/api/shares", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
          setComposerStatus(body.error || `Failed to publish (HTTP ${response.status}).`, true);
          return;
        }
        state.share.published = body;
        renderShareResult();
        setComposerStatus(`Share link ready (${payload.events.length} events).`, false);
      } catch (error) {
        setComposerStatus(error.message || "Failed to publish share link.", true);
      }
    }

    function buildSharePayload() {
      const expiresAt = resolveShareExpiryIso();
      const events = state.share.events
        .filter((event) => event.include)
        .map((event, index) => {
          const title = String(event.title || "").trim();
          if (!title) throw new Error("Every included event needs a title.");

          const startLocal = normalizeShareEventDateTime(event.start);
          const endLocal = normalizeShareEventDateTime(event.end);
          if (new Date(endLocal).getTime() <= new Date(startLocal).getTime()) {
            throw new Error(`End time must be after start time for "${title}".`);
          }

          const fieldMask = state.share.fieldMask || DEFAULT_FIELD_MASK;
          const normalizedEvent = {
            sourceEventId: event.sourceEventId,
            entityType: event.entityType,
            title,
            start: startLocal,
            end: endLocal,
            location: fieldMask.location ? "" : String(event.location || "").trim(),
            description: fieldMask.description ? "" : String(event.description || "").trim(),
            sessionTitle: fieldMask.sessionTitle ? "" : String(event.sessionTitle || "").trim(),
            links: {
              paperUrl: fieldMask.links ? "" : String(event.links?.paperUrl || "").trim(),
              detailsUrl: fieldMask.links ? "" : String(event.links?.detailsUrl || "").trim(),
            },
            sortOrder: index,
          };

          const notes = String(event.notes || "").trim();
          if (state.share.includeNotes && notes) normalizedEvent.notes = notes;
          return normalizedEvent;
        });

      if (!events.length) {
        throw new Error("Include at least one event before publishing.");
      }

      return {
        version: SHARE_VERSION,
        shareName: String(state.share.shareName || "").trim(),
        conferenceId: state.data.conference.id,
        conferenceTimezone: String(state.data?.conference?.timezone || "").trim(),
        expiresAt,
        events,
      };
    }

    function resolveShareExpiryIso() {
      const now = new Date();
      let expiryDate;

      if (state.share.expiryMode === "custom") {
        const customValue = String(state.share.expiryCustomValue || "").trim();
        if (!customValue) throw new Error("Select a custom expiry date/time.");
        expiryDate = new Date(customValue);
        if (Number.isNaN(expiryDate.getTime())) throw new Error("Custom expiry date/time is invalid.");
      } else {
        const presetDays = Number(state.share.expiryMode || SHARE_DEFAULT_EXPIRY_DAYS);
        if (!Number.isFinite(presetDays) || presetDays <= 0) {
          throw new Error("Invalid expiry preset.");
        }
        expiryDate = new Date(now.getTime() + presetDays * 24 * 60 * 60 * 1000);
      }

      if (expiryDate.getTime() <= now.getTime()) {
        throw new Error("Expiry must be in the future.");
      }
      const maxAllowed = new Date(now.getTime() + SHARE_MAX_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
      if (expiryDate.getTime() > maxAllowed.getTime()) {
        throw new Error(`Expiry cannot be more than ${SHARE_MAX_EXPIRY_DAYS} days from now.`);
      }
      return expiryDate.toISOString();
    }

    function normalizeShareEventDateTime(value) {
      const normalized = normalizeLocalDateTimeText(value);
      if (!normalized) throw new Error("Event time is invalid.");
      return normalized;
    }

    async function copyPublishedShareLink() {
      const published = state.share.published;
      if (!published?.shareUrl) {
        setComposerStatus("Publish a share link first.", true);
        return;
      }
      try {
        await navigator.clipboard.writeText(published.shareUrl);
        setComposerStatus("Share URL copied.", false);
      } catch {
        el.shareUrlOutput.focus();
        el.shareUrlOutput.select();
        setComposerStatus("Copy failed. Use Cmd/Ctrl+C on the selected URL.", true);
      }
    }

    function openPublishedShare(platform) {
      const published = state.share.published;
      if (!published?.shareUrl) {
        setComposerStatus("Publish a share link first.", true);
        return;
      }
      const shareUrl = published.shareUrl;
      const shareText = buildSocialPostText(shareUrl);
      const platformUrl = buildShareIntentUrl(platform, shareUrl, shareText);
      if (!platformUrl) return;
      if (platform === "facebook") {
        if (navigator.clipboard?.writeText && window.isSecureContext) {
          navigator.clipboard.writeText(shareText).then(
            () => setComposerStatus("Opened Facebook share.", false),
            () => {
              window.prompt("Copy this Facebook post message and paste it into Facebook:", shareText);
              setComposerStatus("Opened Facebook share.", false);
            }
          );
        } else {
          window.prompt("Copy this Facebook post message and paste it into Facebook:", shareText);
          setComposerStatus("Opened Facebook share.", false);
        }
      }
      window.open(platformUrl, "_blank", "noopener,noreferrer");
    }

    function buildSocialPostText(shareUrl) {
      const conferenceName = String(state.data?.conference?.name || "this conference");
      const conferenceId = String(state.data?.conference?.id || "").toLowerCase();
      const presetTags = SOCIAL_TAGS_BY_CONFERENCE[conferenceId] || [];
      const fallbackTag = buildFallbackTag(conferenceName);
      const tags = [...new Set([...presetTags, fallbackTag, "#ConferencePlanner"])].filter(Boolean).slice(0, MAX_SOCIAL_TAGS);
      const tagsSuffix = tags.length ? ` ${tags.join(" ")}` : "";
      return `Here is my schedule for ${conferenceName}: ${shareUrl}. Come and meet me there!${tagsSuffix}`;
    }

    function buildFallbackTag(conferenceName) {
      const compact = String(conferenceName || "")
        .replace(/[^A-Za-z0-9]+/g, "")
        .trim();
      if (!compact) return "";
      return `#${compact}`;
    }

    function buildShareIntentUrl(platform, shareUrl, shareText) {
      const encodedUrl = encodeURIComponent(shareUrl);
      const encodedText = encodeURIComponent(shareText);
      if (platform === "x") {
        return `https://twitter.com/intent/tweet?text=${encodedText}`;
      }
      if (platform === "facebook") {
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
      }
      if (platform === "linkedin") {
        return `https://www.linkedin.com/feed/?shareActive=true&text=${encodedText}`;
      }
      if (platform === "bluesky") {
        return `https://bsky.app/intent/compose?text=${encodedText}`;
      }
      return "";
    }

    return {
      bindEvents,
      createInitialShareState,
      openComposer,
      closeComposer,
      renderComposer,
    };
}
