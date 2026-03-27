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
