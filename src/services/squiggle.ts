const BASE_URL = "https://api.squiggle.com.au/";
const USER_AGENT = "AFL-AI-Tipper/1.0 (contact: local-app)";

export interface SquiggleGame {
  id: number;
  round: number;
  year: number;
  hteam: string;
  ateam: string;
  venue: string;
  date: string;
  hscore: number | null;
  ascore: number | null;
  winner: string | null;
  complete: number; // 0-100, 100 = complete
}

export interface SquiggleTip {
  gameid: number;
  sourcename: string;
  tip: string;
  tipteamid: number;
  confidence: number | null;
  hteam: string;
  ateam: string;
}

let _currentRound: { round: number; year: number } | null = null;
let _detectPromise: Promise<{ round: number; year: number }> | null = null;

async function squiggleFetch(query: string): Promise<unknown> {
  const url = `${BASE_URL}?${query}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Squiggle API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function detectCurrentRound(): Promise<{ round: number; year: number }> {
  if (_currentRound) return _currentRound;
  if (_detectPromise) return _detectPromise;
  _detectPromise = _doDetect();
  const result = await _detectPromise;
  _detectPromise = null;
  return result;
}

async function _doDetect(): Promise<{ round: number; year: number }> {

  const year = new Date().getFullYear();

  // Try upcoming=1 first (fastest when it works)
  try {
    const data = (await squiggleFetch("q=games;upcoming=1")) as { games: SquiggleGame[] };
    if (data.games && data.games.length > 0) {
      const game = data.games[0];
      _currentRound = { round: game.round, year: game.year };
      console.log(`Round detected via upcoming: ${game.round}`);
      return _currentRound;
    }
  } catch {
    // Timeout or error — fall through to scan approach
  }

  // Fallback: scan rounds 1-30 to find the first round with any incomplete game.
  // AFL typically has ~24 rounds, start from a week-based guess.
  const now = new Date();
  const startOfYear = new Date(year, 0, 1);
  const weekOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (7 * 24 * 60 * 60 * 1000));
  // Season starts around week 10 (mid-March), each round ~1 week
  const guessRound = Math.max(1, Math.min(24, weekOfYear - 9));

  console.log(`Scanning rounds from guess ${guessRound}...`);

  // Check rounds from guessRound back to 1, then forward to 24
  const roundsToCheck: number[] = [];
  for (let r = guessRound; r >= 1; r--) roundsToCheck.push(r);
  for (let r = guessRound + 1; r <= 24; r++) roundsToCheck.push(r);

  for (const round of roundsToCheck) {
    try {
      const data = (await squiggleFetch(`q=games;year=${year};round=${round}`)) as {
        games: SquiggleGame[];
      };
      if (!data.games || data.games.length === 0) continue;
      const hasIncomplete = data.games.some((g) => g.complete < 100);
      if (hasIncomplete) {
        _currentRound = { round, year };
        console.log(`Current round found by scan: ${round}`);
        return _currentRound;
      }
    } catch {
      continue;
    }
  }

  // Last resort: use the guess
  _currentRound = { round: guessRound, year };
  console.log(`Using guessed round: ${guessRound}`);
  return _currentRound;
}

// ── All-games cache (15-min TTL, used for structured pre-processing) ──────────

const _allGamesCache = new Map<number, { games: SquiggleGame[]; fetchedAt: number }>();
const ALL_GAMES_TTL_MS = 15 * 60 * 1000;

export async function fetchAllGamesForYear(year: number): Promise<SquiggleGame[]> {
  const cached = _allGamesCache.get(year);
  if (cached && Date.now() - cached.fetchedAt < ALL_GAMES_TTL_MS) return cached.games;
  const data = (await squiggleFetch(`q=games;year=${year}`)) as { games: SquiggleGame[] };
  const games = data.games ?? [];
  _allGamesCache.set(year, { games, fetchedAt: Date.now() });
  return games;
}

// ── Stats helpers ─────────────────────────────────────────────────────────────

export interface LadderRow {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  draws: number;
  points: number;
  pct: number;
}

export function buildLadder(games: SquiggleGame[]): LadderRow[] {
  const completed = games.filter((g) => g.complete === 100 && g.winner != null);
  const stats = new Map<string, { wins: number; losses: number; draws: number; for: number; against: number }>();

  const ensure = (t: string) => {
    if (!stats.has(t)) stats.set(t, { wins: 0, losses: 0, draws: 0, for: 0, against: 0 });
  };

  for (const g of completed) {
    ensure(g.hteam);
    ensure(g.ateam);
    const h = stats.get(g.hteam)!;
    const a = stats.get(g.ateam)!;
    h.for += g.hscore ?? 0;
    h.against += g.ascore ?? 0;
    a.for += g.ascore ?? 0;
    a.against += g.hscore ?? 0;
    if (g.winner === g.hteam) { h.wins++; a.losses++; }
    else if (g.winner === g.ateam) { a.wins++; h.losses++; }
    else { h.draws++; a.draws++; }
  }

  const rows: LadderRow[] = Array.from(stats.entries()).map(([team, s]) => ({
    team,
    wins: s.wins,
    losses: s.losses,
    draws: s.draws,
    points: s.wins * 4 + s.draws * 2,
    pct: s.against > 0 ? Math.round((s.for / s.against) * 1000) / 10 : 0,
    rank: 0,
  }));

  rows.sort((a, b) => b.points - a.points || b.pct - a.pct);
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export interface FormEntry {
  round: number;
  opponent: string;
  score: number;
  opponentScore: number;
  won: boolean;
  margin: number;
  atHome: boolean;
}

export function getRecentForm(
  games: SquiggleGame[],
  teamName: string,
  beforeRound: number,
  count: number
): FormEntry[] {
  return games
    .filter(
      (g) =>
        g.complete === 100 &&
        g.round < beforeRound &&
        (g.hteam === teamName || g.ateam === teamName)
    )
    .sort((a, b) => b.round - a.round || b.id - a.id)
    .slice(0, count)
    .map((g) => {
      const atHome = g.hteam === teamName;
      const myScore = atHome ? (g.hscore ?? 0) : (g.ascore ?? 0);
      const theirScore = atHome ? (g.ascore ?? 0) : (g.hscore ?? 0);
      return {
        round: g.round,
        opponent: atHome ? g.ateam : g.hteam,
        score: myScore,
        opponentScore: theirScore,
        won: g.winner === teamName,
        margin: myScore - theirScore,
        atHome,
      };
    });
}

export interface H2HEntry {
  round: number;
  year: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
}

export function getH2HHistory(
  games: SquiggleGame[],
  team1: string,
  team2: string,
  beforeRound: number,
  count: number
): H2HEntry[] {
  return games
    .filter(
      (g) =>
        g.complete === 100 &&
        g.round < beforeRound &&
        ((g.hteam === team1 && g.ateam === team2) || (g.hteam === team2 && g.ateam === team1))
    )
    .sort((a, b) => b.round - a.round)
    .slice(0, count)
    .map((g) => ({
      round: g.round,
      year: g.year,
      homeTeam: g.hteam,
      awayTeam: g.ateam,
      homeScore: g.hscore ?? 0,
      awayScore: g.ascore ?? 0,
      winner: g.winner ?? "Unknown",
    }));
}

export function getCachedRound(): { round: number; year: number } | null {
  return _currentRound;
}

export function invalidateCachedRound() {
  _currentRound = null;
  _detectPromise = null;
}

export async function fetchFixtures(round: number, year: number): Promise<SquiggleGame[]> {
  const data = (await squiggleFetch(`q=games;year=${year};round=${round}`)) as {
    games: SquiggleGame[];
  };
  return data.games ?? [];
}

export async function fetchCompletedGames(round: number, year: number): Promise<SquiggleGame[]> {
  const data = (await squiggleFetch(
    `q=games;complete=100;year=${year};round=${round}`
  )) as { games: SquiggleGame[] };
  return data.games ?? [];
}

export async function fetchSquiggleTips(round: number, year: number): Promise<SquiggleTip[]> {
  const data = (await squiggleFetch(`q=tips;year=${year};round=${round}`)) as {
    tips: SquiggleTip[];
  };
  return data.tips ?? [];
}
