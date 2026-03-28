// NRL fixture service using TheSportsDB free API
// League: Australian National Rugby League — ID 4416
// To verify: https://www.thesportsdb.com/api/v1/json/3/all_leagues.php
// Update NRL_LEAGUE_ID below if needed.

import type { GameRecord } from "./game-record";

const TSDB_BASE = "https://www.thesportsdb.com/api/v1/json/3";
const NRL_LEAGUE_ID = 4416; // Australian National Rugby League
const USER_AGENT = "AFL-NRL-AI-Tipper/1.0 (contact: local-app)";

interface TsdbEvent {
  idEvent: string;
  intRound: string | null;
  strHomeTeam: string;
  strAwayTeam: string;
  strVenue: string | null;
  dateEvent: string | null;
  strTime: string | null;
  strTimestamp: string | null;
  intHomeScore: string | null;
  intAwayScore: string | null;
  strStatus: string | null;
}

interface TsdbResponse {
  events: TsdbEvent[] | null;
}

function mapEvent(event: TsdbEvent): GameRecord {
  const homeStr = event.intHomeScore;
  const awayStr = event.intAwayScore;
  const home = homeStr != null ? parseInt(homeStr, 10) : NaN;
  const away = awayStr != null ? parseInt(awayStr, 10) : NaN;
  const hasScores = !isNaN(home) && !isNaN(away);

  const status = (event.strStatus ?? "NS").toUpperCase();
  const isComplete =
    status === "FT" ||
    status === "AET" ||
    status === "FT_PEN" ||
    status === "FINISHED" ||
    status === "MATCH FINISHED" ||
    status === "AFTER EXTRA TIME" ||
    status === "AFTER PENALTIES";
  const isLive =
    !isComplete &&
    status !== "NS" &&
    status !== "NOT STARTED" &&
    status !== "" &&
    status !== "PPD" &&
    status !== "POSTPONED";

  const complete = isComplete ? 100 : isLive ? 50 : 0;

  let winner: string | null = null;
  if (isComplete && hasScores) {
    if (home > away) winner = event.strHomeTeam;
    else if (away > home) winner = event.strAwayTeam;
    // draw: winner stays null
  }

  // Build a datetime string
  let date = event.dateEvent ?? "";
  if (event.strTimestamp) {
    date = event.strTimestamp;
  } else if (event.strTime && event.strTime !== "null" && event.dateEvent) {
    date = `${event.dateEvent}T${event.strTime}+10:00`;
  }

  const yearRaw = event.dateEvent?.split("-")[0];
  const year = yearRaw ? parseInt(yearRaw, 10) : new Date().getFullYear();

  return {
    id: parseInt(event.idEvent, 10),
    round: parseInt(event.intRound ?? "1", 10),
    year,
    hteam: event.strHomeTeam,
    ateam: event.strAwayTeam,
    venue: event.strVenue ?? "",
    date,
    hscore: hasScores ? home : null,
    ascore: hasScores ? away : null,
    winner,
    complete,
  };
}

async function tsdFetch(endpoint: string): Promise<TsdbResponse> {
  const url = `${TSDB_BASE}/${endpoint}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`TheSportsDB API error: ${res.status} ${res.statusText}`);
  return res.json() as Promise<TsdbResponse>;
}

// ── Round detection ───────────────────────────────────────────────────────────

let _currentRound: { round: number; year: number } | null = null;
let _detectPromise: Promise<{ round: number; year: number }> | null = null;

export async function detectCurrentNRLRound(): Promise<{ round: number; year: number }> {
  if (_currentRound) return _currentRound;
  if (_detectPromise) return _detectPromise;
  _detectPromise = _doDetect();
  const result = await _detectPromise;
  _detectPromise = null;
  return result;
}

async function _doDetect(): Promise<{ round: number; year: number }> {
  const year = new Date().getFullYear();

  // Use season data to find current round — more reliable than team-based next-events endpoint
  try {
    const allGames = await fetchAllNRLGamesForYear(year);
    if (allGames.length > 0) {
      // Earliest round that still has incomplete games
      const incomplete = allGames.filter((g) => g.complete < 100);
      if (incomplete.length > 0) {
        const round = Math.min(...incomplete.map((g) => g.round));
        _currentRound = { round, year };
        console.log(`[nrl] Round detected via season data: ${round}`);
        return _currentRound;
      }
      // All games complete — return the final round
      const lastRound = Math.max(...allGames.map((g) => g.round));
      _currentRound = { round: lastRound, year };
      console.log(`[nrl] Season complete, using last round: ${lastRound}`);
      return _currentRound;
    }
  } catch (err) {
    console.warn(`[nrl] Season data unavailable, falling back to scan: ${err}`);
  }

  // Fallback: scan rounds from a week-based guess
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const weekOfYear = Math.floor(
    (now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  // NRL season starts ~week 9 (early Mar); subtract 8 to estimate round number
  const guessRound = Math.max(1, Math.min(27, weekOfYear - 8));

  console.log(`[nrl] Scanning rounds from guess ${guessRound}...`);

  for (let round = Math.max(1, guessRound - 1); round <= 27; round++) {
    try {
      const games = await fetchNRLFixtures(round, year);
      if (games.length === 0) continue;
      const hasIncomplete = games.some((g) => g.complete < 100);
      if (hasIncomplete) {
        _currentRound = { round, year };
        console.log(`[nrl] Current round found by scan: ${round}`);
        return _currentRound;
      }
    } catch {
      continue;
    }
  }

  _currentRound = { round: guessRound, year };
  console.log(`[nrl] Using guessed round: ${guessRound}`);
  return _currentRound;
}

// ── All-games cache (15-min TTL) ──────────────────────────────────────────────

const _allGamesCache = new Map<number, { games: GameRecord[]; fetchedAt: number }>();
const ALL_GAMES_TTL_MS = 15 * 60 * 1000;

export async function fetchAllNRLGamesForYear(year: number): Promise<GameRecord[]> {
  const cached = _allGamesCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < ALL_GAMES_TTL_MS) return cached.games;

  const data = await tsdFetch(`eventsseason.php?id=${NRL_LEAGUE_ID}&s=${year}`);
  const games = (data.events ?? []).map(mapEvent);
  _allGamesCache.set(year, { games, fetchedAt: Date.now() });
  return games;
}

// ── Per-round fetch ───────────────────────────────────────────────────────────

export async function fetchNRLFixtures(round: number, year: number): Promise<GameRecord[]> {
  const data = await tsdFetch(`eventsround.php?id=${NRL_LEAGUE_ID}&r=${round}&s=${year}`);
  return (data.events ?? []).map(mapEvent);
}

export function getCachedNRLRound(): { round: number; year: number } | null {
  return _currentRound;
}

export function invalidateCachedNRLRound(): void {
  _currentRound = null;
  _detectPromise = null;
}
