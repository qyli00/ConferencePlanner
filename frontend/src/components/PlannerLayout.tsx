import React from "react";

export function PlannerLayout() {
  return (
    <>
      <div className="bg bg-a"></div>
      <div className="bg bg-b"></div>

      <header className="hero">
        <div className="hero-top">
          <p id="conferenceEyebrow" className="eyebrow">
            Conference Planner
          </p>
          <a id="backToLandingBtn" className="btn secondary hero-back-link" href="./index.html">
            Back to Conference Selection
          </a>
        </div>
        <h1 id="conferenceTitle">Plan Your Conference Week</h1>
        <p id="conferenceSubtitle" className="subtitle">
          Browse by day and time, mark sessions or papers, and finalize your schedule in calendar view.
        </p>
      </header>

      <main className="layout">
        <div className="view-switcher">
          <div className="view-tabs" role="tablist" aria-label="Main views">
            <button
              id="programTabBtn"
              className="tab-btn active"
              type="button"
              role="tab"
              aria-selected="true"
              aria-controls="programTabPanel"
            >
              Program by Day
            </button>
            <button
              id="calendarTabBtn"
              className="tab-btn"
              type="button"
              role="tab"
              aria-selected="false"
              aria-controls="calendarTabPanel"
            >
              Calendar View
            </button>
          </div>
        </div>

        <section id="programTabPanel" className="panel explorer" role="tabpanel" aria-labelledby="programTabBtn">
          <div id="programControlsWrap" className="program-controls-wrap">
            <div id="programPanelHead" className="panel-head">
              <h2 id="programPanelTitle">Program by Day</h2>
              <p id="explorerStats"></p>
              <div id="explorerActions" className="explorer-actions">
                <button id="expandAllBtn" className="btn secondary">
                  Expand All Sessions
                </button>
                <button id="collapseAllBtn" className="btn secondary">
                  Collapse All Sessions
                </button>
                <button id="resetSelectionsBtn" className="btn secondary">
                  Reset Selections
                </button>
                <button id="saveProfileBtn" className="btn secondary">
                  Save Preferences
                </button>
                <label className="file-btn">
                  Load Preferences
                  <input id="loadProfileInput" type="file" accept=".json,application/json" />
                </label>
              </div>
            </div>
            <div id="programFilters" className="program-filters">
              <div className="toolbar">
                <div className="field grow">
                  <label htmlFor="searchInput">Search sessions, papers, authors, abstracts</label>
                  <input id="searchInput" type="search" placeholder="e.g., fuzzing, rowhammer, privacy..." />
                </div>
                <div className="field">
                  <label htmlFor="dayFilter">Day</label>
                  <select id="dayFilter"></select>
                </div>
                <div className="field">
                  <label htmlFor="kindFilter">Type</label>
                  <select id="kindFilter"></select>
                </div>
                <div className="field">
                  <label htmlFor="sessionTagFilter">Paper Session Tag</label>
                  <select id="sessionTagFilter"></select>
                </div>
                <div className="field">
                  <label htmlFor="priorityFilter">Priority</label>
                  <select id="priorityFilter">
                    <option value="all">All</option>
                    <option value="selected">Interested + Must-Go</option>
                    <option value="must_go">Must-Go Only</option>
                  </select>
                </div>
              </div>
              <p id="statusMessage" className="status">
                Loading local dataset...
              </p>
            </div>
          </div>
          <div id="dayBoards" className="day-boards"></div>
        </section>

        <section
          id="calendarTabPanel"
          className="panel planner hidden"
          role="tabpanel"
          aria-labelledby="calendarTabBtn"
        >
          <div id="calendarControlsWrap" className="calendar-controls-wrap">
            <div className="panel-head">
              <h2>Week Calendar Review</h2>
              <p id="plannerStats"></p>
              <div className="planner-actions">
                <div className="planner-action-row planner-main-actions">
                  <div className="planner-left-actions">
                    <button id="addCustomEventBtn" className="btn secondary">
                      Add Custom Event
                    </button>
                    <button id="confirmUndecidedBtn" className="btn secondary">
                      Confirm Undecided
                    </button>
                    <button id="removeUndecidedBtn" className="btn secondary">
                      Remove Undecided
                    </button>
                    <button id="exportIcsBtn" className="btn secondary export-btn">
                      Export ICS
                    </button>
                  </div>
                  <button id="shareScheduleBtn" className="btn secondary export-btn share-schedule-btn">
                    <svg className="btn-icon-share" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M15 8l-6 3.5M15 16l-6-3.5M17 6.5a2.5 2.5 0 1 0-.001 5.001A2.5 2.5 0 0 0 17 6.5Zm-10 5a2.5 2.5 0 1 0-.001 5.001A2.5 2.5 0 0 0 7 11.5Zm10 5a2.5 2.5 0 1 0-.001 5.001A2.5 2.5 0 0 0 17 16.5Z" />
                    </svg>
                    <span>Share Schedule</span>
                  </button>
                </div>
              </div>
            </div>
            <div id="customEventFormWrap" className="custom-event-form hidden">
              <div className="field grow">
                <label htmlFor="customTitle">Title</label>
                <input id="customTitle" type="text" placeholder="Coffee chat, hallway meeting, side event..." />
              </div>
              <div className="field">
                <label htmlFor="customDate">Date</label>
                <input id="customDate" type="date" />
              </div>
              <div className="field">
                <label htmlFor="customStartTime">Start</label>
                <input id="customStartTime" type="time" />
              </div>
              <div className="field">
                <label htmlFor="customEndTime">End</label>
                <input id="customEndTime" type="time" />
              </div>
              <div className="field">
                <label htmlFor="customPriority">Priority</label>
                <select id="customPriority">
                  <option value="interested">Interested</option>
                  <option value="must_go">Must-Go</option>
                </select>
              </div>
              <div className="field grow">
                <label htmlFor="customLocation">Location</label>
                <input id="customLocation" type="text" placeholder="Lobby, Room 201..." />
              </div>
              <div className="field grow">
                <label htmlFor="customNotes">Notes</label>
                <input id="customNotes" type="text" placeholder="Person/topic/etc." />
              </div>
              <div className="custom-form-actions">
                <button id="saveCustomEventBtn" className="btn primary">
                  Save Event
                </button>
                <button id="cancelCustomEventBtn" className="btn secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
          <div className="review-layout">
            <div id="weekCalendar" className="week-calendar"></div>
            <aside id="eventDetails" className="event-details"></aside>
          </div>
        </section>
      </main>

      <div
        id="shareComposerModal"
        className="modal hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shareComposerTitle"
      >
        <div className="modal-card share-modal">
          <div className="modal-head">
            <h3 id="shareComposerTitle">Share Schedule</h3>
            <button
              id="closeShareComposerBtn"
              className="modal-close-btn"
              type="button"
              aria-label="Close share composer"
            >
              Close
            </button>
          </div>
          <p className="modal-subtitle">Pick events in calendar view, edit shared details, then generate a share link.</p>
          <div className="share-settings">
            <div className="field grow">
              <label htmlFor="shareNameInput">Share name</label>
              <input id="shareNameInput" type="text" placeholder="e.g., Alice's CHI meetings" />
            </div>
            <div className="field">
              <label htmlFor="shareExpiryMode">Link expiry</label>
              <select id="shareExpiryMode">
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div id="shareExpiryCustomWrap" className="field hidden">
              <label htmlFor="shareExpiryCustomInput">Custom expiry</label>
              <input id="shareExpiryCustomInput" type="datetime-local" />
            </div>
            <div className="share-mask-group">
              <label className="share-notes-toggle">
                <input id="shareIncludeNotes" type="checkbox" />
                Include personal notes
              </label>
              <label className="share-notes-toggle">
                <input id="shareMaskLocation" type="checkbox" />
                Mask locations
              </label>
              <label className="share-notes-toggle">
                <input id="shareMaskSession" type="checkbox" />
                Mask session names
              </label>
              <label className="share-notes-toggle">
                <input id="shareMaskDescription" type="checkbox" />
                Mask descriptions
              </label>
              <label className="share-notes-toggle">
                <input id="shareMaskLinks" type="checkbox" />
                Mask links
              </label>
              <div className="share-list-actions">
                <button id="shareIncludeAllBtn" className="btn secondary" type="button">
                  Include All
                </button>
                <button id="shareExcludeAllBtn" className="btn secondary" type="button">
                  Exclude All
                </button>
              </div>
            </div>
          </div>
          <p id="shareComposerStatus" className="status"></p>
          <div id="shareCalendarWrap" className="share-calendar-wrap"></div>
          <div id="shareEventEditorWrap" className="share-event-editor-wrap"></div>
          <div className="share-publish-row">
            <button id="publishShareBtn" className="btn primary" type="button">
              Generate Share Link
            </button>
          </div>
          <div
            id="shareResultWrap"
            className="modal hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="shareResultTitle"
          >
            <div className="modal-card share-result-card">
              <div className="modal-head">
                <h3 id="shareResultTitle">Share Link Ready</h3>
                <button
                  id="closeShareResultBtn"
                  className="modal-close-btn"
                  type="button"
                  aria-label="Close share result"
                >
                  Close
                </button>
              </div>
              <p className="modal-subtitle">Copy the link or share it directly on social platforms.</p>
              <label htmlFor="shareUrlOutput">Share URL</label>
              <input id="shareUrlOutput" type="text" readOnly />
              <div className="share-action-row">
                <button id="copyShareLinkBtn" className="btn secondary" type="button">
                  Copy Link
                </button>
                <button
                  id="shareOnXBtn"
                  className="btn secondary share-social-btn share-social-x"
                  type="button"
                  aria-label="Share on X"
                  title="Share on X"
                >
                  <svg className="share-social-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 4h4.7l4.1 5.4L17.5 4H20l-6 6.8L20 20h-4.7l-4.4-5.8L5.8 20H3.3l6.3-7.2zM7.2 5.8h.9l8.7 12.4h-.9z" />
                  </svg>
                </button>
                <button
                  id="shareOnFacebookBtn"
                  className="btn secondary share-social-btn share-social-facebook"
                  type="button"
                  aria-label="Share on Facebook"
                  title="Share on Facebook"
                >
                  <svg className="share-social-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M13.9 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.5-1.5h1.4V5c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3V11H9.2v3h2.5v7z" />
                  </svg>
                </button>
                <button
                  id="shareOnLinkedInBtn"
                  className="btn secondary share-social-btn share-social-linkedin"
                  type="button"
                  aria-label="Share on LinkedIn"
                  title="Share on LinkedIn"
                >
                  <svg className="share-social-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7.1 8.4A1.4 1.4 0 1 1 7.1 5.6a1.4 1.4 0 0 1 0 2.8M5.9 9.7h2.4V18H5.9zM9.8 9.7H12v1.1h0c.3-.6 1.1-1.3 2.3-1.3 2.4 0 2.9 1.6 2.9 3.7V18h-2.4v-3.9c0-.9 0-2.1-1.3-2.1s-1.5 1-1.5 2V18H9.8z" />
                  </svg>
                </button>
                <button
                  id="shareOnBlueskyBtn"
                  className="btn secondary share-social-btn share-social-bluesky"
                  type="button"
                  aria-label="Share on Bluesky"
                  title="Share on Bluesky"
                >
                  <svg className="share-social-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 11.6c1.7-2.6 4.2-4 7.5-4.2-1 2.8-2.7 4.8-5.1 6 2-.1 4.1.7 6.2 2.4-2.9.7-5.4.2-7.5-1.5a1 1 0 0 0-1.2 0c-2.1 1.7-4.6 2.2-7.5 1.5 2.1-1.7 4.2-2.5 6.2-2.4-2.4-1.2-4.1-3.2-5.1-6 3.3.2 5.8 1.6 7.5 4.2z" />
                  </svg>
                </button>
              </div>
              <p id="shareExpiryText" className="status"></p>
            </div>
          </div>
        </div>
      </div>

      <div
        id="sharedImportModal"
        className="modal hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sharedImportTitle"
      >
        <div className="modal-card shared-import-modal">
          <div className="modal-head">
            <h3 id="sharedImportTitle">Merge Shared Schedule</h3>
            <button
              id="closeSharedImportBtn"
              className="modal-close-btn"
              type="button"
              aria-label="Close shared import"
            >
              Close
            </button>
          </div>
          <p className="modal-subtitle">
            Compare incoming shared events with your current plan, then load all or import selected events only.
          </p>
          <p id="sharedImportStatus" className="status"></p>
          <div id="sharedImportSummary" className="shared-import-summary"></div>
          <div id="sharedImportPreview" className="shared-import-preview"></div>
          <div className="shared-import-actions">
            <button id="sharedImportLoadAllBtn" className="btn primary" type="button">
              Load Entire Schedule
            </button>
            <button id="sharedImportChooseBtn" className="btn secondary" type="button">
              Select Specific Events
            </button>
            <button id="sharedImportCancelBtn" className="btn secondary" type="button">
              Keep Current Calendar
            </button>
          </div>
          <div id="sharedImportSelectionWrap" className="shared-import-selection hidden">
            <div className="shared-import-selection-head">
              <button id="sharedImportSelectAllBtn" className="btn secondary" type="button">
                Select All
              </button>
              <button id="sharedImportSelectNoneBtn" className="btn secondary" type="button">
                Select None
              </button>
            </div>
            <div id="sharedImportList" className="shared-import-list"></div>
            <div className="shared-import-footer">
              <button id="sharedImportApplyBtn" className="btn primary" type="button">
                Add Selected to Calendar
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
