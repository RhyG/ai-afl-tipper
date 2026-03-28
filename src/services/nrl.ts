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
    round: Math.max(1, parseInt(event.intRound ?? "1", 10) || 1),
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
  const request = fetch(url, { headers: { "User-Agent": USER_AGENT } }).then(async (res) => {
    if (!res.ok) throw new Error(`TheSportsDB API error: ${res.status} ${res.statusText}`);
    return res.json() as TsdbResponse;
  });
  return Promise.race([
    request,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("TheSportsDB request timed out")), 5000)
    ),
  ]);
}

// ── Round detection ───────────────────────────────────────────────────────────

let _currentRound: { round: number; year: number } | null = null;
let _detectPromise: Promise<{ round: number; year: number }> | null = null;

function _weekGuess(): { round: number; year: number } {
  const year = new Date().getFullYear();
  const now = new Date();
  const weekOfYear = Math.floor(
    (now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );
  // NRL season starts ~week 9 (early Mar); subtract 8 to estimate round number
  return { round: Math.max(1, Math.min(27, weekOfYear - 8)), year };
}

export async function detectCurrentNRLRound(): Promise<{ round: number; year: number }> {
  if (_currentRound) return _currentRound;
  // Fire detection in the background; never block the caller
  if (!_detectPromise) {
    _detectPromise = _doDetect().finally(() => { _detectPromise = null; });
  }
  return _weekGuess();
}

async function _doDetect(): Promise<{ round: number; year: number }> {
  const year = new Date().getFullYear();

  // Try season endpoint — free tier may return null, in which case fall back to week guess
  try {
    const allGames = await fetchAllNRLGamesForYear(year);
    if (allGames.length > 0) {
      // Cap at round 30 — TheSportsDB uses large IDs (e.g. 500+) for pre-season/exhibition games
      const regularSeason = allGames.filter((g) => g.round >= 1 && g.round <= 30);
      const incomplete = regularSeason.filter((g) => g.complete < 100);
      if (incomplete.length > 0) {
        const round = Math.min(...incomplete.map((g) => g.round));
        _currentRound = { round, year };
        console.log(`[nrl] Round detected via season data: ${round}`);
        return _currentRound;
      }
      const lastRound = regularSeason.length > 0
        ? Math.max(...regularSeason.map((g) => g.round))
        : _weekGuess().round;
      _currentRound = { round: lastRound, year };
      console.log(`[nrl] Season complete, using last round: ${lastRound}`);
      return _currentRound;
    }
  } catch (err) {
    console.warn(`[nrl] Season data unavailable: ${err}`);
  }

  // Fall back to week-based calculation — no slow multi-round scan
  _currentRound = _weekGuess();
  console.log(`[nrl] Using week-based round estimate: ${_currentRound.round}`);
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
