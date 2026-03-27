# AFL AI Tipper — Design Spec

**Date:** 2026-03-27
**Status:** Implemented

## Overview

A local web app that fetches the current AFL fixture from the Squiggle API, aggregates configurable data sources (RSS feeds, APIs, URLs), and uses an AI agent (defaulting to Claude) to generate tips for each game. Tips are persisted in SQLite with full history and updated with actual results after games are played. The active AI provider and model can be switched at runtime via the dashboard.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Bun |
| Server/Router | Hono |
| Frontend interactivity | HTMX |
| Templating | Hono JSX (server-side) |
| Styling | Tailwind CSS (Play CDN) |
| Database | SQLite via `bun:sqlite` |
| AI providers | Claude (Anthropic SDK), OpenAI |
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
│   │   ├── client.ts             # SQLite connection singleton (WAL mode)
│   │   └── schema.ts             # Table definitions + migrations + default seed data
│   ├── services/
│   │   ├── squiggle.ts           # Squiggle API client (fixtures, results, model tips)
│   │   ├── data-fetcher.ts       # Fetches/parses RSS, URL, API, squiggle-tips sources
│   │   ├── log-stream.ts         # Global pub/sub singleton for terminal SSE streaming
│   │   ├── runtime-config.ts     # Reads/writes active AI provider+model from settings table
│   │   ├── tipper.ts             # Orchestrates: fetch sources → call AI → persist tip
│   │   └── ai/
│   │       ├── provider.ts       # AIProvider interface + TipResult + GameContext types
│   │       ├── claude.ts         # Claude implementation (streaming)
│   │       ├── openai.ts         # OpenAI implementation (streaming)
│   │       └── index.ts          # Factory — returns configured provider from config
│   ├── routes/
│   │   ├── dashboard.tsx         # GET / and GET /rounds/:year/:round
│   │   ├── fixtures.tsx          # POST /fixtures/sync — refresh from Squiggle
│   │   ├── sources.tsx           # GET/POST/DELETE /sources — CRUD data sources
│   │   ├── tips.tsx              # generate (single + bulk), SSE stream, reasoning view
│   │   ├── results.tsx           # POST /results/sync — pull scores from Squiggle
│   │   └── settings.tsx          # GET /settings/ai/models, POST /settings/ai
│   └── views/
│       ├── layout.tsx            # Base HTML shell with nav, terminal bottom sheet, SSE client
│       ├── dashboard.tsx         # Full dashboard page shell
│       ├── round-view.tsx        # Round content partial (nav + grid + action buttons)
│       ├── sources-page.tsx      # Data sources management page
│       └── components/
│           ├── fixture-card.tsx  # Single game card (upcoming / in-progress / tipped / complete)
│           ├── tip-detail.tsx    # Expanded reasoning/summary panel (HTMX swap)
│           ├── round-nav.tsx     # Prev/next round navigation with hx-push-url
│           ├── round-summary.tsx # X/Y correct, percentage for a round
│           └── source-row.tsx    # Single source row in management table
├── specs/
│   └── 2026-03-27-afl-tipper-design.md
├── .env
├── package.json
├── tsconfig.json
└── bun.lock
```

## Startup Behaviour

On `bun run src/index.ts`:
1. `schema.ts` runs `CREATE TABLE IF NOT EXISTS` for all tables (idempotent migrations)
2. Default data sources inserted with `INSERT OR IGNORE` keyed on `url` (idempotent seed)
3. Current round detected from Squiggle (see Round Detection below)
4. If no fixtures exist for the detected round, auto-fetch from Squiggle
5. HTTP server starts on `PORT` (default 3000)

## Round Detection

The `?q=games;upcoming=1` Squiggle endpoint is unreliable (consistently times out). The actual implementation:

1. Calculate a week-based round estimate from the current date
2. Scan rounds sequentially from that estimate (backwards then forwards) using `?q=games;year=YYYY;round=X`
3. The first round with at least one game where `complete < 100` is selected as current
4. A singleton promise prevents duplicate detection races on concurrent requests
5. Result cached in memory; refreshed when fixtures are synced

## Fixture Staleness

Fixtures for the current round are considered stale when:
- No fixtures exist in the DB for the detected current round, OR
- The most recently synced fixture for the current round has `synced_at` older than 1 hour

All timestamps use `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')` (explicit UTC ISO 8601) to avoid SQLite timezone ambiguity.

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
| complete | INTEGER | 0–100 progress from Squiggle; used for in-progress state |
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

Re-generating a tip uses `INSERT OR REPLACE` (keyed on `fixture_id`), replacing the previous tip.

### `settings`
| Column | Type | Notes |
|---|---|---|
| key | TEXT PK | Setting name (e.g. `ai_provider`, `ai_model`) |
| value | TEXT | Setting value |

Used to persist the active AI provider and model across restarts. Falls back to env config when not set.

## Data Flow

### Fixture Sync
1. On dashboard load, detect current round (see Round Detection)
2. If fixtures are stale, auto-fetch from `?q=games;year=YYYY;round=X`
3. Upsert into `fixtures` table using `INSERT OR REPLACE` on `squiggle_id`
4. "Refresh Fixtures" button triggers `POST /fixtures/sync` → HTMX swaps fixture grid

### Tip Generation (single game)
1. `POST /tips/generate/:fixtureId` — triggered by per-game button
2. Terminal auto-opens via `htmx:beforeRequest` listener
3. `tipper.ts` fetches all enabled data sources in parallel (see Source Fetching)
4. Builds prompt with game context + source content (see Context Window Strategy)
5. Calls AI provider with streaming; tokens emitted to log-stream in real time
6. Validates response with Zod; retries once with stricter prompt on parse failure
7. Upserts tip into `tips` table (INSERT OR REPLACE on fixture_id)
8. Returns HTMX partial — fixture card swapped to tipped state

### Tip Generation (bulk)
1. `POST /tips/generate/bulk` — triggered by "Generate All Tips" button
2. Note: `/generate/bulk` must be registered before `/generate/:fixtureId` in Hono to avoid "bulk" being captured as a fixture ID
3. Fetches all untipped, incomplete fixtures for the current round
4. Calls single-game tip generation sequentially for each fixture (to avoid rate limits)
5. Returns full updated fixture grid HTML

### Result Sync
1. `POST /results/sync` — triggered by "Update Results" button
2. Fetches ALL games from Squiggle `?q=games;year=YYYY;round=X` (not just `complete=100`) to capture in-progress scores
3. Updates matching `fixtures` rows only where `complete` value has increased or game is now finished
4. HTMX swaps affected cards to show live score / result + correct/incorrect badge

### Runtime AI Settings
1. Nav dropdowns send `POST /settings/ai` with provider+model on Save
2. Model dropdown repopulates via `GET /settings/ai/models?provider=X` (HTMX swap) on provider change
3. Settings persisted to `settings` table, read by `runtime-config.ts` at tip-generation time

## Source Fetching

`data-fetcher.ts` handles four source types:

- **`rss`:** Parsed via `rss-parser`. Returns up to 10 most recent items as `{ title, summary, pubDate }`.
- **`url`:** Fetched via `fetch()`, HTML stripped to plain text via regex.
- **`api`:** Fetched via `fetch()`, response JSON stringified and included as-is.
- **`squiggle-tips`:** Special type. Before fetching, the current round and year are appended to the URL: `?q=tips;year=YYYY;round=X`. Response parsed and formatted as human-readable tip list grouped by game.

Fetch failures are non-fatal: error emitted to log-stream, `"[unavailable]"` content included so the AI knows to skip the source.

## Context Window Strategy

Total source content is capped at **60,000 characters** across all sources. Sources are included in this priority order:
1. `squiggle-tips` sources (most signal-dense)
2. `rss` sources
3. `api` sources
4. `url` sources

Each individual source is truncated to a maximum of **3,000 characters** before the global cap is applied. If the global cap is hit, lower-priority sources are dropped entirely.

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
  content: string;
}

interface TipResult {
  tip: string;           // tipped team name (must match homeTeam or awayTeam exactly)
  confidence: number;    // 0–100
  reasoning: string;     // full written reasoning paragraphs
  dataSummary: string;   // newline-separated bullets: "- [Source Name]: [key signal]"
  keyFactors: string;    // newline-separated bullets: 3–5 decisive factors
}

interface AIProvider {
  readonly providerName: string;
  readonly modelName: string;
  generateTip(gameContext: GameContext, sources: SourceContent[]): Promise<TipResult>;
}
```

Both `claude.ts` and `openai.ts` implement `AIProvider` using streaming APIs. Each token is emitted to `log-stream` as it arrives. Both retry once with a stricter prompt on JSON parse failure.

`index.ts` exports `getAIProvider(config): AIProvider`. The active provider/model is read from `runtime-config.ts` at call time, so changes take effect on the next tip generation without restarting.

## Terminal Bottom Sheet

A macOS-style terminal panel slides up from the bottom of the screen during tip generation.

- **`log-stream.ts`** — global pub/sub singleton. `emit()` broadcasts a `LogLine` to all subscribers and appends to a 500-line in-memory history buffer. Types: `info`, `fetch`, `ai`, `error`, `done`, `clear`.
- **`GET /tips/stream`** — SSE endpoint. On connect, replays history so late-opening terminals aren't blank, then streams live events. Cleans up subscriber on client disconnect via `AbortSignal`.
- **`POST /tips/clear`** — Clears history buffer and emits a `clear` event to connected clients.
- **Client JS** — Native `EventSource` connects on page load. `appendText()` colour-codes lines by type (info=gray, fetch=cyan, ai=green, error=red, done=yellow). Terminal auto-opens when a tip generation request starts via `htmx:beforeRequest`.

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

### Fixture Grid
- 2-column card grid (1-col mobile)
- **Upcoming card:** teams, venue, date, "Generate Tip" button
- **In-progress card:** pulsing red LIVE badge, `X% complete`, current scores
- **Tipped card:** tip badge, confidence progress bar, "Show Reasoning" / "Re-tip" buttons
- **Completed card:** winner side highlighted green, loser muted, W/L labels, margin, tip correctness badge (✓/✗)

### Expanded Tip Panel (HTMX swap)
- "We tipped: [Team] — 72% confidence"
- Same score/result display as completed card
- **Data Analysed:** rendered from `data_summary`
- **Reasoning:** rendered from `reasoning`
- **Key Factors:** rendered from `key_factors`

### Round Navigation
- Prev/next arrows + round label; `hx-push-url` updates browser URL on navigation
- "Generate All Tips", "Update Results", "Refresh Fixtures" action buttons per round

### Data Sources Page (`/sources`)
- Table: name, type badge, URL, enabled toggle, delete button
- "Add Source" inline form: name, type dropdown, URL, description — HTMX submit appends new row

## Config

`.env` file:
```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
AI_PROVIDER=claude          # default provider; overridden at runtime via settings table
AI_MODEL=claude-opus-4-6    # default model; overridden at runtime via settings table
PORT=3000
```

## Error Handling

- Data source fetch failures: non-fatal, logged to terminal, source marked unavailable in prompt
- AI call failures: fixture card shows error state with retry button
- AI JSON parse failure: retry once with stricter prompt; surface error on card if still invalid
- Squiggle API failures: serve cached fixtures with last-synced timestamp
- DB operations: synchronous via `bun:sqlite`, no async error surface needed

## Out of Scope

- Authentication (local only)
- Multiple users
- Push notifications
- Automated scheduling (manual trigger only)
- Mobile app
