import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { detectCurrentRound, fetchFixtures } from "../services/squiggle";
import { detectCurrentNRLRound, fetchNRLFixtures } from "../services/nrl";
import { getDb } from "../db/client";
import { getFixturesForRound, getTipForFixture } from "../services/tipper";
import type { Fixture, Tip } from "../services/tipper";
import { getAISettings } from "../services/runtime-config";
import { isValidating } from "../services/startup-state";
import { Dashboard } from "../views/dashboard";
import { RoundView } from "../views/round-view";
import { RoundNav } from "../views/components/round-nav";
import { SPORTS, parseSport, type SportId } from "../sports";
import type { GameRecord } from "../services/game-record";

const app = new Hono();

// Per-sport explored max round. Starts at currentRound+3 and extends by 3
// each time the user navigates to the edge of the browsable range.
const _exploredMax = new Map<SportId, number>();

function getMaxRound(sport: SportId, currentRound: number, viewedRound: number | null, sportMaxRounds: number): number {
  const floor = currentRound + 3;
  const stored = _exploredMax.get(sport) ?? floor;
  let max = Math.max(stored, floor); // advance with currentRound if it overtakes stored value
  if (viewedRound !== null && viewedRound >= max) {
    max = Math.min(sportMaxRounds, viewedRound + 3);
    _exploredMax.set(sport, max);
  }
  return Math.min(sportMaxRounds, max);
}

export function buildTipsMap(fixtures: Fixture[]): Map<number, Tip> {
  const map = new Map<number, Tip>();
  for (const f of fixtures) {
    const tip = getTipForFixture(f.id);
    if (tip) map.set(f.id, tip);
  }
  return map;
}

export async function syncFixtures(round: number, year: number, sport: SportId = "afl") {
  const db = getDb();

  let games: GameRecord[];
  if (sport === "nrl") {
    games = await fetchNRLFixtures(round, year);
  } else {
    games = await fetchFixtures(round, year);
  }

  const upsert = db.prepare(`
    INSERT INTO fixtures
      (squiggle_id, round, year, home_team, away_team, venue, game_date, home_score, away_score, winner, is_complete, complete, sport, synced_at)
    VALUES ($squiggle_id, $round, $year, $home_team, $away_team, $venue, $game_date, $home_score, $away_score, $winner, $is_complete, $complete, $sport, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    ON CONFLICT(squiggle_id) DO UPDATE SET
      home_score  = excluded.home_score,
      away_score  = excluded.away_score,
      winner      = excluded.winner,
      is_complete = excluded.is_complete,
      complete    = excluded.complete,
      venue       = excluded.venue,
      synced_at   = excluded.synced_at
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
      $sport: sport,
    });
  }
}

async function detectRound(sport: SportId): Promise<{ round: number; year: number }> {
  return sport === "nrl" ? detectCurrentNRLRound() : detectCurrentRound();
}

function getRoundData(round: number, year: number, sport: SportId) {
  const fixtures = getFixturesForRound(round, year, sport);
  const tips = buildTipsMap(fixtures);
  const lastSyncedAt = fixtures[0]?.synced_at
    ? new Date(fixtures[0].synced_at).toLocaleString("en-AU")
    : undefined;
  return { fixtures, tips, lastSyncedAt };
}

// Startup validation overlay — polled by HTMX on every page
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
  c.header("HX-Trigger", "startupComplete");
  return c.html(`<div id="startup-overlay"></div>`);
});

// Main dashboard — always shows current round for the selected sport
app.get("/", async (c) => {
  const sport = parseSport(c.req.query("sport"));
  const sportConfig = SPORTS[sport];
  const current = await detectRound(sport);
  let { fixtures, tips, lastSyncedAt } = getRoundData(current.round, current.year, sport);
  const maxRound = getMaxRound(sport, current.round, null, sportConfig.maxRounds);

  // Startup race: if fixtures haven't been cached yet, sync now
  if (fixtures.length === 0) {
    await syncFixtures(current.round, current.year, sport);
    ({ fixtures, tips, lastSyncedAt } = getRoundData(current.round, current.year, sport));
  }

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
      sport={sport}
    />
  );
  return c.html("<!DOCTYPE html>" + renderToString(page as any));
});

// Round browser — returns partial (HTMX) or full page
app.get("/rounds/:year/:round", async (c) => {
  const round = parseInt(c.req.param("round"), 10);
  const year = parseInt(c.req.param("year"), 10);
  const sport = parseSport(c.req.query("sport"));
  const sportConfig = SPORTS[sport];
  const current = await detectRound(sport);
  const maxRound = getMaxRound(sport, current.round, round, sportConfig.maxRounds);

  if (isNaN(round) || isNaN(year) || round < 1 || round > sportConfig.maxRounds) {
    return c.redirect(`/?sport=${sport}`);
  }

  const { fixtures, tips, lastSyncedAt } = getRoundData(round, year, sport);
  const isHtmx = c.req.header("HX-Request") === "true";

  // Auto-load: if no fixtures cached, show loading state (HTMX) or sync inline (full page)
  if (fixtures.length === 0) {
    if (isHtmx) {
      const navProps = { round, year, currentRound: current.round, currentYear: current.year, maxRound, sport };
      const fragment = (
        <div>
          <div class="mb-6">
            <RoundNav {...navProps} />
          </div>
          <div
            hx-post={`/rounds/${year}/${round}/load?sport=${sport}`}
            hx-target="#round-view"
            hx-swap="innerHTML"
            hx-trigger="load"
            class="text-center py-16"
          >
            <div style="width:2rem;height:2rem;border:3px solid #3b82f6;border-top-color:transparent;border-radius:9999px;animation:spin 0.8s linear infinite;margin:0 auto" />
            <div class="text-lg font-medium text-gray-400 mt-4">Loading fixtures…</div>
            <div class="text-sm mt-1 text-gray-600">Fetching from {sportConfig.label} data source</div>
          </div>
        </div>
      );
      return c.html(renderToString(fragment as any));
    }
    // Full-page: sync inline before rendering
    await syncFixtures(round, year, sport);
  }

  const { fixtures: f2, tips: t2, lastSyncedAt: s2 } = getRoundData(round, year, sport);
  const roundViewProps = {
    round, year,
    currentRound: current.round,
    currentYear: current.year,
    maxRound,
    fixtures: f2,
    tips: t2,
    lastSyncedAt: s2,
    sport,
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

// Auto-load endpoint: syncs fixtures then returns full RoundView for #round-view swap
app.post("/rounds/:year/:round/load", async (c) => {
  const round = parseInt(c.req.param("round"), 10);
  const year = parseInt(c.req.param("year"), 10);
  const sport = parseSport(c.req.query("sport"));
  const sportConfig = SPORTS[sport];

  if (isNaN(round) || isNaN(year) || round < 1 || round > sportConfig.maxRounds) {
    return c.text("Invalid round", 400);
  }

  await syncFixtures(round, year, sport);

  const current = await detectRound(sport);
  const maxRound = getMaxRound(sport, current.round, round, sportConfig.maxRounds);
  const { fixtures, tips, lastSyncedAt } = getRoundData(round, year, sport);

  return c.html(renderToString((<RoundView
    round={round}
    year={year}
    currentRound={current.round}
    currentYear={current.year}
    maxRound={maxRound}
    fixtures={fixtures}
    tips={tips}
    lastSyncedAt={lastSyncedAt}
    sport={sport}
  />) as any));
});

export { app as dashboardRouter };
