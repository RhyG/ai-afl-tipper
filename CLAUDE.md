# AFL AI Tipper — Claude Instructions

## Commits

**Commit after every discrete piece of work.** Each logical change (new feature, bug fix, refactor) should be its own commit before moving on. Do not batch unrelated changes into one commit.

When a task produces multiple separable changes (e.g. a feature + a bug fix discovered along the way), commit them as separate commits in order.

## Spec updates

After implementing an item from `specs/suggested-improvements.md`, mark it done inline:
- Strike through the heading and body with `~~...~~`
- Add a brief "Implemented: ..." line summarising where the code lives

## Project overview

Bun + Hono + HTMX local web app for AI-powered AFL tipping.

- **DB**: SQLite via `bun:sqlite` — `src/db/`
- **AI**: Claude / OpenAI / multi-model debate — `src/services/ai/`
- **Data sources**: Squiggle API, RSS feeds, URL scrapes, bookmaker odds — `src/services/`
- **UI**: Server-rendered JSX with HTMX for interactivity — `src/views/`
- **Routes**: Hono routers mounted in `src/index.ts`

## Key conventions

- Idempotent DB migrations via `try/catch ALTER TABLE` in `src/db/schema.ts`
- New data sources added to `seedDefaultSources()` in `src/db/schema.ts`
- Non-fatal source failures: log and continue, never throw from `fetchAllSources`
- HTMX responses return HTML fragments (not full pages); check `HX-Request` header for full-page fallback
- All timestamps stored as ISO 8601 UTC via `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`
