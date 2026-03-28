# Suggested Improvements

## Data Sources

### ~~Bookmaker Odds (The Odds API)~~ ✓ Done
~~Use theodds-api.com (free tier, 500 req/month). Fetches head-to-head prices from Sportsbet, TAB, Ladbrokes etc. for all upcoming AFL games. Convert to implied probabilities so the AI sees market consensus directly. One complication: team name normalisation (18-entry mapping table between Odds API full names and Squiggle short names).~~

Implemented: `src/services/odds.ts` fetches h2h odds (au region, 1hr cache), normalises team names, computes average implied probability across bookmakers, injects into AI prompt and lazy-loads onto each fixture card via HTMX.

### BOM Weather
Fetch conditions at the game venue from the Bureau of Meteorology. Wind speed/direction and rainfall are meaningful for kicking-heavy teams (Geelong, Brisbane) and wet-weather specialists. Requires a static mapping of AFL venues to their nearest BOM weather station ID, then one API call per game. Complexity is low once the mapping is written.

### Multi-year H2H History
The structured pre-processing currently only includes H2H from the current season. Fetching 2–3 prior seasons from Squiggle (`?q=games;year=Y`) and including historical H2H win rates and venue-specific records would strengthen this signal, particularly early in the season when current-year data is sparse.

### AFL.com.au Team Pages (URL scrape)
Each club page (e.g. `afl.com.au/club/collingwood`) lists the selected squad, recent form, and injury news updated close to game day. Would require dynamic URL construction from team names but team→slug mapping is simple.

### Champion Data / AFL Official Stats
The AFL's official stats provider has detailed performance metrics (expected score, contested possessions, clearances, pressure acts). Mostly paywalled but some aggregated stats surface on afl.com.au and can be scraped.

---

## Confidence & Accuracy

### Historical Accuracy Tracking
Store tip results vs actual outcomes after each round completes. Track accuracy per provider/model, per team, per venue. Surface accuracy stats in the UI and use them to calibrate displayed confidence (e.g. if the model has historically over-tipped home teams, apply a correction factor).

### Confidence Calibration
Current confidence scores are the model's self-assessed certainty, which tends to be poorly calibrated. After enough history is collected, apply Platt scaling or isotonic regression to map raw confidence → calibrated probability.

### ~~Explicit Signal Weighting in Prompt~~ ✓ Done
~~Instruct the AI to weight signals in a defined order: bookmaker odds > model consensus (Squiggle tips) > recent form > H2H > historical base rates. Currently nothing guides relative weighting and the model may over-index on recency or news.~~

Implemented: added a "Signal weighting" section to `SYSTEM_PROMPT` in both `src/services/ai/claude.ts` and `src/services/ai/openai.ts` (5-point ordered hierarchy with a hard rule to justify any tip that disagrees with the bookmaker favourite). Added a matching reminder to `SYNTHESIS_SYSTEM_PROMPT` in `src/services/ai/multi.ts` so the panel chair also uses the hierarchy when arbitrating analyst disagreements.

### Ensemble Prompting
Run 3+ prompts per game with different analytical frames (recent form only, H2H only, expert model consensus only) and aggregate by majority vote. Disagreement across frames is a reliable signal of genuine uncertainty.

---

## Multi-Model

### Configurable Model Pairing
Currently Multi mode hardcodes Claude Opus + GPT-4o. Allow the user to choose which models participate (e.g. Claude Sonnet + GPT-4o-mini for a cheaper option).

### More Than Two Analysts
Extend the debate to 3+ models (e.g. Claude, GPT-4o, Gemini). With an odd number, majority vote resolves disagreements cleanly without a separate synthesis call.

### Synthesis Model Selection
Currently the synthesis call always uses Claude Opus. Allow the user to choose a cheaper model for synthesis since it's summarising existing reasoning rather than generating new analysis.

---

## UX / UI

### Round Accuracy Summary
Show a per-round scorecard at the top of the round view: X/9 correct, average confidence, and a breakdown of which games were correctly/incorrectly tipped. Currently you have to scan individual cards.

### Tip Confidence vs Actual Win Rate Chart
A simple chart plotting confidence buckets (50–60%, 60–70%, etc.) against actual win rate for that bucket. A well-calibrated model should produce a roughly diagonal line. Useful for judging whether to trust high-confidence tips.

### Bulk Re-tip
A "Re-tip All" button for the round that regenerates all tips sequentially, rather than clicking each game individually.

### Export
CSV export of all tips with outcomes, confidence, and model used — useful for manual analysis outside the app.

### Tip Diff
When re-tipping a game, show what changed vs the previous tip (team changed? confidence shifted by how much?).

---

## Infrastructure

### Multi-year Support
The AFL Tables seed URL is hardcoded to 2026. Should auto-generate from the current year so it doesn't need updating each season.

### Source Health Dashboard
Show last-fetch status, response size, and error rate for each source so it's easy to spot when a feed goes down or returns junk.

### Per-source Character Limit Control
Currently `PER_SOURCE_LIMIT` is a global 3,000-char constant. Structured Game Context and Squiggle Tips are more reliable signals than a URL scrape — a per-source configurable limit would let high-value sources use more of the token budget.

### Scheduled Auto-tipping
Automatically generate tips for the current round at a configurable time (e.g. Thursday evening after teams are announced). Could use the existing cron infrastructure in Bun.
