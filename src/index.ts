import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config";
import { runMigrations } from "./db/schema";
import { detectCurrentRound } from "./services/squiggle";
import { detectCurrentNRLRound } from "./services/nrl";
import { getFixturesForRound } from "./services/tipper";
import { dashboardRouter, syncFixtures } from "./routes/dashboard.tsx";
import { validateAllSources } from "./services/data-fetcher";
import { setValidating } from "./services/startup-state";
import { fixturesRouter } from "./routes/fixtures.tsx";
import { tipsRouter } from "./routes/tips.tsx";
import { resultsRouter } from "./routes/results.tsx";
import { sourcesRouter } from "./routes/sources.tsx";
import { settingsRouter } from "./routes/settings.tsx";
import { oddsRouter } from "./routes/odds.tsx";

// Bootstrap
runMigrations();

const app = new Hono();

app.use("*", logger());

// Routes
app.route("/", dashboardRouter);
app.route("/fixtures", fixturesRouter);
app.route("/tips", tipsRouter);
app.route("/results", resultsRouter);
app.route("/sources", sourcesRouter);
app.route("/settings", settingsRouter);
app.route("/odds", oddsRouter);

const port = config.port;
console.log("🏈🏉 AI Tipper starting up...");

// Kick off round detection for both sports (non-blocking)
(async () => {
  try {
    // ── AFL startup ──────────────────────────────────────────────────────────
    const aflRound = await detectCurrentRound();
    console.log(`📅 AFL current round: Round ${aflRound.round}, ${aflRound.year}`);

    const aflFixtures = getFixturesForRound(aflRound.round, aflRound.year, "afl");
    if (aflFixtures.length === 0) {
      console.log("📥 AFL: no fixtures cached — syncing...");
      await syncFixtures(aflRound.round, aflRound.year, "afl");
      const synced = getFixturesForRound(aflRound.round, aflRound.year, "afl");
      console.log(`✅ AFL: synced ${synced.length} fixtures`);
    } else {
      console.log(`✅ AFL: ${aflFixtures.length} fixtures cached`);
    }

    // ── NRL startup ──────────────────────────────────────────────────────────
    try {
      const nrlRound = await detectCurrentNRLRound();
      console.log(`📅 NRL current round: Round ${nrlRound.round}, ${nrlRound.year}`);

      const nrlFixtures = getFixturesForRound(nrlRound.round, nrlRound.year, "nrl");
      if (nrlFixtures.length === 0) {
        console.log("📥 NRL: no fixtures cached — syncing...");
        await syncFixtures(nrlRound.round, nrlRound.year, "nrl");
        const synced = getFixturesForRound(nrlRound.round, nrlRound.year, "nrl");
        console.log(`✅ NRL: synced ${synced.length} fixtures`);
      } else {
        console.log(`✅ NRL: ${nrlFixtures.length} fixtures cached`);
      }
    } catch (err) {
      console.warn(`⚠️  NRL startup skipped: ${err}`);
    }

    // ── Source validation (both sports) ─────────────────────────────────────
    console.log("🔍 Validating data sources...");
    setValidating(true);
    try {
      const { ok, errors } = await validateAllSources();
      if (errors > 0) {
        console.warn(`⚠️  Source validation: ${ok} ok, ${errors} failed — check the Sources page`);
      } else {
        console.log(`✅ Source validation: all ${ok} sources ok`);
      }
    } finally {
      setValidating(false);
    }
  } catch (err) {
    console.error("❌ Startup task failed:", err);
    setValidating(false);
  }
})();

Bun.serve({
  port,
  fetch: app.fetch,
  idleTimeout: 60,
});

console.log(`🚀 Server running at http://localhost:${port}`);
