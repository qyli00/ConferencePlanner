# Conference Planner

Browser-based planner for conference schedules with a shared data model across conferences.

## Supported conferences

- NDSS 2026
- CHI 2026

## What the app does

- Landing page conference picker (`index.html`) and planner view (`planner.html`)
- Program-by-day board with parallel sessions rendered in lanes
- Multi-row rendering for high-parallel slots (for example CHI blocks with ~26 concurrent sessions)
- Equal-width session cards across rows within the same time slot
- Expand/collapse sessions to browse papers
- Search + filters (day, type, paper-session tag, priority)
- Session and paper priorities: `None`, `Interested`, `Must-Go`
- Calendar review with final decision status: `Attend`, `Maybe`, `Not Go`
- Custom events and `.ics` export
- Save/load preferences JSON per conference
- Schedule sharing with per-event editable share copy and social share actions (`Copy Link`, `X`, `Facebook`, `LinkedIn`, `Bluesky`)
- `Hide Controls` toggle in Program view to collapse action/filter rows

## Frontend structure

- `app.js`: core planner logic (data load, filters, day board, calendar, profile/ics).
- `share-controller.js`: isolated share feature controller (share modal state, share link generation, social actions).
- `share-view.js`: read-only rendering for public share links (`/s/:shareId`).

## Run the UI

From this directory:

```bash
python3 server.py --host 127.0.0.1 --port 8000
```

Open:

- `http://localhost:8000`

Conference selection happens on the landing page dropdown.  
You can also deep-link directly:

- `http://localhost:8000/?conference=ndss-2026`
- `http://localhost:8000/?conference=chi-2026`
- `http://localhost:8000/planner.html?conference=ndss-2026`
- `http://localhost:8000/planner.html?conference=chi-2026`
- Shared schedule links are served at `http://localhost:8000/s/<shareId>`

## Share API

- `POST /api/shares`: create immutable share link.
  - Request body: `{ version, conferenceId, expiresAt?, events[] }`
  - Default expiry: 7 days from creation.
  - Maximum expiry: 90 days from creation.
  - Response: `{ shareId, shareUrl, expiresAt }`
- `GET /api/shares/:shareId`: fetch shared schedule payload.
  - `200`: active share link.
  - `404`: missing share ID.
  - `410`: expired share link.
- Share snapshot storage path: `backend/userdata/snapshots.json` (legacy `backend/shares/snapshots.json` is migrated automatically on startup).

## Datasets

Bundled dataset files:

- NDSS normalized dataset: `data/ndss2026/ndss-2026.json`
- CHI normalized dataset: `data/chi2026/chi-2026.json`
- CHI raw/session/content caches under `data/chi2026/raw/`

## Normalized data shape

Each conference JSON includes:

- `conference`: id, name, year, source URL, timezone
- `days[]`: date/label + ordered `sessionIds`
- `sessions[]`: `id`, `dayId`, `start`, `end`, `title`, `track`, `kind`, `paperIds`, etc.
- `papers[]`: `id`, `sessionId`, `title`, `authors`, `abstract`, `track`, links
- `stats`: day/session/paper counts and generated summary
- `ui`: conference-specific display hints (`eyebrow`, `title`, `subtitle`, `maxParallelPerRow`)

`kind` is derived from schedule metadata and keywords (for example Papers, Meet-Up, Workshop, Keynote, Awards, Panel, Journal, SRC, Logistics, Event), so the UI type filter is conference-agnostic.
