import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { detectCurrentRound, fetchFixtures } from "../services/squiggle";
import { getDb } from "../db/client";
import { getFixturesForRound, getTipForFixture } from "../services/tipper";
import type { Fixture, Tip } from "../services/tipper";
import { getAISettings } from "../services/runtime-config";
import { isValidating } from "../services/startup-state";
import { Dashboard } from "../views/dashboard";
import { RoundView } from "../views/round-view";

const app = new Hono();

const MAX_ROUND = 24;
// How many rounds ahead of current to allow browsing
const UPCOMING_ROUNDS = 2;

export function buildTipsMap(fixtures: Fixture[]): Map<number, Tip> {
  const map = new Map<number, Tip>();
  for (const f of fixtures) {
    const tip = getTipForFixture(f.id);
    if (tip) map.set(f.id, tip);
  }
  return map;
}

function isStale(fixtures: Fixture[]): boolean {
  if (fixtures.length === 0) return true;
  const latest = fixtures.reduce((a, b) =>
    new Date(a.synced_at) > new Date(b.synced_at) ? a : b
  );
  const age = Date.now() - new Date(latest.synced_at).getTime();
  return age > 60 * 60 * 1000;
}

export async function syncFixtures(round: number, year: number) {
  const db = getDb();
  const games = await fetchFixtures(round, year);

  const upsert = db.prepare(`
    INSERT INTO fixtures
      (squiggle_id, round, year, home_team, away_team, venue, game_date, home_score, away_score, winner, is_complete, complete, synced_at)
    VALUES ($squiggle_id, $round, $year, $home_team, $away_team, $venue, $game_date, $home_score, $away_score, $winner, $is_complete, $complete, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ON CONFLICT(squiggle_id) DO UPDATE SET
      home_score = excluded.home_score,
      away_score = excluded.away_score,
      winner     = excluded.winner,
      is_complete = excluded.is_complete,
      complete   = excluded.complete,
      venue      = excluded.venue,
      synced_at  = excluded.synced_at
  `);

  for (const game of games) {
    upsert.run({
      $squiggle_id: game.id,
      $round: game.round,
      $year: game.year,
      $home_team: game.hteam,
      $away_team: game.ateam,
      $venue: game.venue ?? "",
      $game_date: game.date,
      $home_score: game.hscore ?? null,
      $away_score: game.ascore ?? null,
      $winner: game.winner ?? null,
      $is_complete: game.complete === 100 ? 1 : 0,
      $complete: game.complete,
    });
  }
}

async function getRoundData(round: number, year: number) {
  let fixtures = getFixturesForRound(round, year);
  if (isStale(fixtures)) {
    try {
      await syncFixtures(round, year);
      fixtures = getFixturesForRound(round, year);
    } catch (err) {
      console.error(`Auto-sync failed for round ${round}:`, err);
    }
  }
  const tips = buildTipsMap(fixtures);
  const lastSyncedAt = fixtures[0]?.synced_at
    ? new Date(fixtures[0].synced_at).toLocaleString("en-AU")
    : undefined;
  return { fixtures, tips, lastSyncedAt };
}

// Startup validation overlay status — polled by HTMX on every page
app.get("/status/startup", (c) => {
  if (isValidating()) {
    return c.html(
      `<div id="startup-overlay"
            hx-get="/status/startup"
            hx-trigger="every 2s"
            hx-swap="outerHTML"
            class="fixed inset-0 z-[200] bg-gray-950/90 backdrop-blur-sm flex items-center justify-center">
        <div class="text-center">
          <div style="width:2.5rem;height:2.5rem;border:3px solid #3b82f6;border-top-color:transparent;border-radius:9999px;animation:spin 0.8s linear infinite;margin:0 auto 1rem"></div>
          <p class="text-white text-lg font-semibold">Verifying sources…</p>
          <p class="text-gray-400 text-sm mt-1">Please wait — startup checks are running</p>
        </div>
      </div>`
    );
  }
  return c.html(`<div id="startup-overlay"></div>`);
});

// Main dashboard — always shows current round
app.get("/", async (c) => {
  const current = await detectCurrentRound();
  const { fixtures, tips, lastSyncedAt } = await getRoundData(current.round, current.year);
  const maxRound = Math.min(MAX_ROUND, current.round + UPCOMING_ROUNDS);

  const aiSettings = getAISettings();
  const page = (
    <Dashboard
      round={current.round}
      year={current.year}
      currentRound={current.round}
      currentYear={current.year}
      maxRound={maxRound}
      fixtures={fixtures}
      tips={tips}
      lastSyncedAt={lastSyncedAt}
      aiProvider={aiSettings.provider}
      aiModel={aiSettings.model}
    />
  );
  return c.html("<!DOCTYPE html>" + renderToString(page as any));
});

// Round browser — returns partial (HTMX) or full page
app.get("/rounds/:year/:round", async (c) => {
  const round = parseInt(c.req.param("round"), 10);
  const year = parseInt(c.req.param("year"), 10);
  const current = await detectCurrentRound();
  const maxRound = Math.min(MAX_ROUND, current.round + UPCOMING_ROUNDS);

  if (isNaN(round) || isNaN(year) || round < 1 || round > MAX_ROUND) {
    return c.redirect("/");
  }

  const { fixtures, tips, lastSyncedAt } = await getRoundData(round, year);
  const isHtmx = c.req.header("HX-Request") === "true";
  const roundViewProps = {
    round, year,
    currentRound: current.round,
    currentYear: current.year,
    maxRound,
    fixtures,
    tips,
    lastSyncedAt,
  };

  if (isHtmx) {
    return c.html(renderToString((<RoundView {...roundViewProps} />) as any));
  }

  const aiSettings = getAISettings();
  const page = (
    <Dashboard {...roundViewProps} aiProvider={aiSettings.provider} aiModel={aiSettings.model} />
  );
  return c.html("<!DOCTYPE html>" + renderToString(page as any));
});

export { app as dashboardRouter };
