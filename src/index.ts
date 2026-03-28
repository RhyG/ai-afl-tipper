import { Hono } from "hono";
import { logger } from "hono/logger";
import { config } from "./config";
import { runMigrations } from "./db/schema";
import { detectCurrentRound } from "./services/squiggle";
import { getFixturesForRound } from "./services/tipper";
import { dashboardRouter, syncFixtures } from "./routes/dashboard.tsx"; // syncFixtures used in startup
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
console.log("🏈 AFL AI Tipper starting up...");

// Kick off round detection immediately (non-blocking) so it's warm before first request
(async () => {
  try {
    const round = await detectCurrentRound();
    console.log(`📅 Current round: Round ${round.round}, ${round.year}`);

    const fixtures = getFixturesForRound(round.round, round.year);
    if (fixtures.length === 0) {
      console.log("📥 No fixtures — syncing from Squiggle...");
      await syncFixtures(round.round, round.year);
      const synced = getFixturesForRound(round.round, round.year);
      console.log(`✅ Synced ${synced.length} fixtures`);
    } else {
      console.log(`✅ ${fixtures.length} fixtures cached`);
    }
  } catch (err) {
    console.error("❌ Startup task failed:", err);
  }
})();

Bun.serve({
  port,
  fetch: app.fetch,
  idleTimeout: 60,
});

console.log(`🚀 Server running at http://localhost:${port}`);
