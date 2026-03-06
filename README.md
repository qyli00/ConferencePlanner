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
- `Hide Controls` toggle in Program view to collapse action/filter rows

## Run the UI

From this directory:

```bash
python3 -m http.server 8000
```

Open:

- `http://localhost:8000`

Conference selection happens on the landing page dropdown.  
You can also deep-link directly:

- `http://localhost:8000/?conference=ndss-2026`
- `http://localhost:8000/?conference=chi-2026`
- `http://localhost:8000/planner.html?conference=ndss-2026`
- `http://localhost:8000/planner.html?conference=chi-2026`

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
