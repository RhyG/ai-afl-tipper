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

// ── AFL startup (blocking — needed before server is ready) ───────────────────
(async () => {
  try {
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

    // Preload surrounding rounds (prev + next 2) so initial navigation is instant
    const aflSurrounding = [-1, 1, 2]
      .map((o) => aflRound.round + o)
      .filter((r) => r >= 1 && r <= 24);
    for (const r of aflSurrounding) {
      if (getFixturesForRound(r, aflRound.year, "afl").length === 0) {
        console.log(`📥 AFL: preloading Round ${r}...`);
        await syncFixtures(r, aflRound.year, "afl");
      }
    }

    // ── Source validation ───────────────────────────────────────────────────
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
    console.error("❌ AFL startup task failed:", err);
    setValidating(false);
  }
})();

// ── NRL startup (fire-and-forget — does not block AFL or server readiness) ────
(async () => {
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

    // Preload surrounding rounds (prev + next 2)
    const nrlSurrounding = [-1, 1, 2]
      .map((o) => nrlRound.round + o)
      .filter((r) => r >= 1 && r <= 27);
    for (const r of nrlSurrounding) {
      if (getFixturesForRound(r, nrlRound.year, "nrl").length === 0) {
        console.log(`📥 NRL: preloading Round ${r}...`);
        await syncFixtures(r, nrlRound.year, "nrl");
      }
    }
  } catch (err) {
    console.warn(`⚠️  NRL startup skipped: ${err}`);
  }
})();

Bun.serve({
  port,
  fetch: app.fetch,
  idleTimeout: 60,
});

console.log(`🚀 Server running at http://localhost:${port}`);
