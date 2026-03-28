// The Odds API v4 integration — sport-agnostic
// Free tier: 500 requests/month — responses are cached for 1 hour per sport

import type { SportConfig } from "../sports";

const API_BASE = "https://api.the-odds-api.com/v4";
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface OddsOutcome {
  name: string;
  price: number;
}

interface OddsMarket {
  key: string;
  outcomes: OddsOutcome[];
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: OddsMarket[];
}

interface OddsEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  bookmakers: OddsBookmaker[];
}

export interface BookmakerLine {
  name: string;
  homeOdds: number;
  awayOdds: number;
}

export interface GameOdds {
  homeTeam: string; // normalized to canonical team name
  awayTeam: string;
  bookmakers: BookmakerLine[];
  avgHomeOdds: number | null;
  avgAwayOdds: number | null;
  homeImpliedPct: number | null;
  awayImpliedPct: number | null;
}

// Per-sport odds cache
const _oddsCache = new Map<string, { games: GameOdds[]; fetchedAt: number }>();

function normalizeTeam(name: string, sport: SportConfig): string {
  if (sport.teamNameMap[name]) return sport.teamNameMap[name];
  // Substring fallback for unexpected name variants
  for (const canonical of Object.values(sport.teamNameMap)) {
    if (name.toLowerCase().includes(canonical.toLowerCase())) return canonical;
  }
  return name;
}

function decimalToImplied(odds: number): number {
  return Math.round((100 / odds) * 10) / 10;
}

export async function fetchOdds(sport: SportConfig): Promise<GameOdds[]> {
  const cached = _oddsCache.get(sport.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) return cached.games;

  const apiKey = process.env.THE_ODDS_API_KEY ?? "";
  if (!apiKey) return [];

  const url = new URL(`${API_BASE}/sports/${sport.oddsKey}/odds/`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "au");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "AFL-NRL-AI-Tipper/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Odds API HTTP ${res.status}`);

  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) console.log(`[odds:${sport.id}] ${remaining} API requests remaining this month`);

  const events = (await res.json()) as OddsEvent[];

  const games: GameOdds[] = events.map((event) => {
    const homeTeam = normalizeTeam(event.home_team, sport);
    const awayTeam = normalizeTeam(event.away_team, sport);

    const bookmakers: BookmakerLine[] = [];
    for (const bk of event.bookmakers) {
      const market = bk.markets.find((m) => m.key === "h2h");
      if (!market) continue;
      const homeOut = market.outcomes.find((o) => o.name === event.home_team);
      const awayOut = market.outcomes.find((o) => o.name === event.away_team);
      if (homeOut && awayOut) {
        bookmakers.push({ name: bk.title, homeOdds: homeOut.price, awayOdds: awayOut.price });
      }
    }

    let avgHomeOdds: number | null = null;
    let avgAwayOdds: number | null = null;
    if (bookmakers.length > 0) {
      const sumHome = bookmakers.reduce((s, b) => s + b.homeOdds, 0);
      const sumAway = bookmakers.reduce((s, b) => s + b.awayOdds, 0);
      avgHomeOdds = Math.round((sumHome / bookmakers.length) * 100) / 100;
      avgAwayOdds = Math.round((sumAway / bookmakers.length) * 100) / 100;
    }

    return {
      homeTeam,
      awayTeam,
      bookmakers,
      avgHomeOdds,
      avgAwayOdds,
      homeImpliedPct: avgHomeOdds ? decimalToImplied(avgHomeOdds) : null,
      awayImpliedPct: avgAwayOdds ? decimalToImplied(avgAwayOdds) : null,
    };
  });

  _oddsCache.set(sport.id, { games, fetchedAt: Date.now() });
  return games;
}

export function findGameOdds(
  games: GameOdds[],
  homeTeam: string,
  awayTeam: string
): GameOdds | null {
  let match = games.find((g) => g.homeTeam === homeTeam && g.awayTeam === awayTeam);
  if (match) return match;
  // Try reversed — Odds API may have home/away swapped
  match = games.find((g) => g.homeTeam === awayTeam && g.awayTeam === homeTeam);
  return match ?? null;
}

export function formatOddsForPrompt(
  odds: GameOdds,
  homeTeam: string,
  awayTeam: string
): string {
  const lines: string[] = ["=== BOOKMAKER ODDS (market average across bookmakers) ==="];
  if (odds.avgHomeOdds && odds.avgAwayOdds) {
    lines.push(
      `  ${homeTeam}: $${odds.avgHomeOdds.toFixed(2)} avg (${odds.homeImpliedPct}% implied probability)`
    );
    lines.push(
      `  ${awayTeam}: $${odds.avgAwayOdds.toFixed(2)} avg (${odds.awayImpliedPct}% implied probability)`
    );
    const favored =
      (odds.homeImpliedPct ?? 0) > (odds.awayImpliedPct ?? 0) ? homeTeam : awayTeam;
    lines.push(`  Market favourite: ${favored}`);
  }
  if (odds.bookmakers.length > 0) {
    lines.push(`  Sources: ${odds.bookmakers.map((b) => b.name).join(", ")}`);
  }
  return lines.join("\n");
}

