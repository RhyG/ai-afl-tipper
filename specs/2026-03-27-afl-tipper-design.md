# AFL AI Tipper — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

A local web app that fetches the current AFL fixture from the Squiggle API, aggregates configurable data sources (RSS feeds, APIs, URLs), and uses an AI agent (defaulting to Claude) to generate tips for each game. Tips are persisted in SQLite with full history and updated with actual results after games are played.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Server/Router | Hono |
| Frontend interactivity | HTMX |
| Templating | Hono JSX (server-side) |
| Styling | Tailwind CSS (Play CDN) |
| Database | SQLite via `bun:sqlite` |
| AI (default) | Claude via Anthropic SDK |
| Validation | Zod |
| RSS parsing | `rss-parser` |

Deployment: local only.

## Project Structure

```
afl-tipper/
├── src/
│   ├── index.ts                  # Bun entry point, Hono app bootstrap + startup tasks
│   ├── config.ts                 # Config from env (API keys, AI provider)
│   ├── db/
│   │   ├── client.ts             # SQLite connection singleton
│   │   └── schema.ts             # Table definitions + migrations + default seed data
│   ├── services/
│   │   ├── squiggle.ts           # Squiggle API client (fixtures, results, model tips)
│   │   ├── data-fetcher.ts       # Fetches/parses RSS, URL, API, squiggle-tips sources
│   │   ├── ai/
│   │   │   ├── provider.ts       # AIProvider interface + TipResult + GameContext types
│   │   │   ├── claude.ts         # Claude implementation of AIProvider
│   │   │   └── index.ts          # Factory — returns configured provider from config
│   │   └── tipper.ts             # Orchestrates: fetch sources → call AI → persist tip
│   ├── routes/
│   │   ├── dashboard.ts          # GET / — main dashboard page
│   │   ├── fixtures.ts           # POST /fixtures/sync — refresh from Squiggle
│   │   ├── sources.ts            # GET/POST/DELETE /sources — CRUD data sources
│   │   ├── tips.ts               # POST /tips/generate/:fixtureId, POST /tips/generate/bulk, GET /tips/:id
│   │   └── results.ts            # POST /results/sync — pull results from Squiggle
│   └── views/
│       ├── layout.tsx            # Base HTML shell with nav
│       ├── dashboard.tsx         # Full dashboard page (This Round + History tabs)
│       ├── sources-page.tsx      # Data sources management page
│       └── components/
│           ├── fixture-card.tsx  # Single game card (untipped / tipped / result states)
│           ├── tip-detail.tsx    # Expanded reasoning/summary panel (HTMX swap)
│           ├── source-row.tsx    # Single source row in management table
│           ├── history-list.tsx  # Past rounds browsable list
│           └── round-summary.tsx # X/Y correct, percentage for a round
├── .env                          # ANTHROPIC_API_KEY, AI_PROVIDER=claude
├── package.json
└── bunfig.toml
```

## Startup Behaviour

On `bun run src/index.ts`:
1. `schema.ts` runs `CREATE TABLE IF NOT EXISTS` for all tables (idempotent migrations)
2. Default data sources inserted with `INSERT OR IGNORE` keyed on `url` (idempotent seed)
3. Current round detected from Squiggle (see Round Detection below)
4. If no fixtures exist for the detected round, auto-fetch from Squiggle
5. HTTP server starts on `PORT` (default 3000)

## Round Detection

The canonical source of "current round" is Squiggle. On startup and on each dashboard load:
1. Call `https://api.squiggle.com.au/?q=games;upcoming=1` to get the next unplayed game
2. Extract `round` and `year` from that response — this is the current round
3. Cache this in memory for the duration of the server session; refreshed when fixtures are synced
4. All Squiggle queries for fixtures and tips use this round/year pair

## Fixture Staleness

Fixtures for the current round are considered stale when:
- No fixtures exist in the DB for the detected current round, OR
- The most recently synced fixture for the current round has `synced_at` older than 1 hour

When stale, fixtures are auto-fetched on dashboard load. The "Refresh Fixtures" button bypasses the staleness check and always re-fetches.

## Database Schema

### `data_sources`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | Display name |
| type | TEXT | `rss`, `api`, `url`, `squiggle-tips` |
| url | TEXT UNIQUE | Endpoint/feed URL — used as idempotent seed key |
| description | TEXT | What this source provides |
| enabled | INTEGER | 0 or 1, default 1 |
| created_at | TEXT | ISO timestamp |

### `fixtures`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| squiggle_id | INTEGER UNIQUE | Squiggle game ID |
| round | INTEGER | |
| year | INTEGER | |
| home_team | TEXT | |
| away_team | TEXT | |
| venue | TEXT | |
| game_date | TEXT | ISO timestamp |
| home_score | INTEGER | NULL until played |
| away_score | INTEGER | NULL until played |
| winner | TEXT | NULL until played |
| is_complete | INTEGER | 0 or 1, default 0 |
| synced_at | TEXT | ISO timestamp of last Squiggle sync |

### `tips`
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| fixture_id | INTEGER FK UNIQUE | → fixtures.id; UNIQUE enforces one tip per game |
| tip | TEXT | Tipped team name |
| confidence | INTEGER | 0–100 |
| reasoning | TEXT | Full AI reasoning paragraphs |
| data_summary | TEXT | Newline-separated bullets: `- [Source]: [signal]` |
| key_factors | TEXT | Newline-separated bullets: 3–5 decisive factors |
| ai_provider | TEXT | e.g. `claude` |
| model | TEXT | e.g. `claude-opus-4-6` |
| created_at | TEXT | ISO timestamp |

Re-generating a tip for an already-tipped game uses `INSERT OR REPLACE` (keyed on `fixture_id`), replacing the previous tip.

## Data Flow

### Fixture Sync
1. On dashboard load, detect current round via Squiggle (see Round Detection)
2. If fixtures are stale (see Fixture Staleness), auto-fetch from `?q=games;year=YYYY;round=X`
3. Upsert into `fixtures` table using `INSERT OR REPLACE` on `squiggle_id`
4. "Refresh Fixtures" button triggers `POST /fixtures/sync` → HTMX swaps fixture grid

### Tip Generation (single game)
1. `POST /tips/generate/:fixtureId` — triggered by per-game button
2. `tipper.ts` fetches all enabled data sources in parallel (see Source Fetching below)
3. Builds prompt with game context + source content (see Context Window Strategy)
4. Calls AI provider, validates response with Zod
5. Upserts tip into `tips` table (INSERT OR REPLACE on fixture_id)
6. Returns HTMX partial — fixture card swapped to tipped state

### Tip Generation (bulk)
1. `POST /tips/generate/bulk` — triggered by "Generate All Tips" button
2. Fetches all untipped fixtures for the current round
3. Calls single-game tip generation sequentially for each fixture (to avoid rate limits)
4. Each card updated via HTMX out-of-band swap as tips complete
5. Returns final state of all fixture cards

### Result Sync
1. `POST /results/sync` — triggered by "Update Results" button
2. Fetches completed games from Squiggle `?q=games;complete=100;year=YYYY;round=X`
3. Updates matching `fixtures` rows: home_score, away_score, winner, is_complete=1
4. HTMX swaps affected cards to show result + correct/incorrect badge

## Source Fetching

`data-fetcher.ts` handles four source types:

- **`rss`:** Parsed via `rss-parser`. Returns up to 10 most recent items as `{ title, summary, pubDate }`.
- **`url`:** Fetched via `fetch()`, HTML stripped to plain text via regex.
- **`api`:** Fetched via `fetch()`, response JSON stringified and included as-is.
- **`squiggle-tips`:** Special type. Before fetching, the current round and year are appended to the URL: `?q=tips;year=YYYY;round=X`. Response parsed and formatted as human-readable tip list.

Fetch failures are non-fatal: log the error, include `"[Source Name]: unavailable"` in the prompt so the AI knows to skip it.

## Context Window Strategy

Total source content is capped at **60,000 characters** across all sources. Sources are included in this priority order:
1. `squiggle-tips` sources (most signal-dense)
2. `rss` sources sorted by `pubDate` descending (newest first)
3. `api` sources
4. `url` sources

Each individual source is truncated to a maximum of **3,000 characters** before the global cap is applied. If the global cap is hit, lower-priority sources are dropped entirely (not truncated further).

## AI Provider Abstraction

```typescript
// src/services/ai/provider.ts

interface GameContext {
  homeTeam: string;
  awayTeam: string;
  venue: string;
  gameDate: string;
  round: number;
  year: number;
}

interface SourceContent {
  name: string;
  type: string;
  content: string; // pre-trimmed text
}

interface TipResult {
  tip: string;           // tipped team name (must match homeTeam or awayTeam exactly)
  confidence: number;    // 0–100
  reasoning: string;     // full written reasoning paragraphs
  dataSummary: string;   // newline-separated bullets: "- [Source Name]: [key signal]"
  keyFactors: string;    // newline-separated bullets: 3–5 decisive factors
}

interface AIProvider {
  generateTip(gameContext: GameContext, sources: SourceContent[]): Promise<TipResult>;
}
```

`claude.ts` implements `AIProvider`. The system prompt instructs Claude to:
- Act as an expert AFL tipping analyst
- Return a JSON object matching the `TipResult` shape exactly
- For `dataSummary`: one bullet per source consulted, format `- [Source Name]: [key signal or "no relevant info"]`
- For `keyFactors`: 3–5 bullets summarising the decisive factors, format `- [factor]`
- Set `tip` to exactly one of the two team names provided in the game context

`index.ts` exports a factory `getAIProvider(config): AIProvider`. Adding OpenAI/Gemini later = new implementation file + new case in the factory.

## Default Data Sources (pre-seeded)

| Name | Type | URL |
|---|---|---|
| Squiggle Model Tips | squiggle-tips | `https://api.squiggle.com.au/` |
| AFL.com.au News | rss | `https://www.afl.com.au/rss` |
| Fox Footy | rss | `https://www.foxsports.com.au/rss/afl` |
| Zero Hanger | rss | `https://www.zerohanger.com/feed/` |
| The Roar AFL | rss | `https://www.theroar.com.au/afl/feed/` |
| Sporting News AU | rss | `https://www.sportingnews.com/au/afl/rss` |
| Real Footy (Age) | rss | `https://www.theage.com.au/rss/sport/afl.xml` |
| AFL Tables | url | `https://afltables.com/afl/seas/2026.html` |

## Dashboard UI

### This Round Tab
- 2-column card grid (1-col mobile)
- **Untipped card:** teams, venue, date, "Generate Tip" button
- **Tipped card:** tip badge with team name, confidence progress bar, "Show Reasoning" expander (HTMX swap)
- **Completed card:** result score, green ✓ / red ✗ tip correctness badge overlaid on card

### Expanded Tip Panel (HTMX inline swap on same card)
- "We tipped: [Team] — 72% confidence"
- **Data Analysed:** rendered from `data_summary` (newline-separated bullets from DB)
- **Reasoning:** rendered from `reasoning` (full paragraphs from DB)
- **Key Factors:** rendered from `key_factors` (newline-separated bullets from DB)

### History Tab
- Round selector (prev/next arrows + dropdown)
- Same card grid for past rounds, all tips with results shown
- Round summary bar: X/Y correct (e.g. 5/9 — 56%)

### Data Sources Page (`/sources`)
- Table: name, type badge, URL, enabled toggle, delete button
- "Add Source" inline form: name, type dropdown (`rss`, `api`, `url`, `squiggle-tips`), URL, description — HTMX submit appends new row

## Config

`.env` file:
```
ANTHROPIC_API_KEY=sk-ant-...
AI_PROVIDER=claude          # extensible: openai, gemini, ollama
AI_MODEL=claude-opus-4-6    # overridable
PORT=3000
```

## Error Handling

- Data source fetch failures: non-fatal, logged, source marked unavailable in prompt
- AI call failures: fixture card shows error state with retry button; error message displayed
- Squiggle API failures: show last-cached fixtures with "last synced X ago" indicator
- DB operations: synchronous via `bun:sqlite`, no async error surface needed
- Invalid AI response (Zod parse failure): retry once with stricter prompt; if still invalid, surface error on card

## Out of Scope

- Authentication (local only)
- Multiple users
- Push notifications
- Automated scheduling (manual trigger only)
- Mobile app
