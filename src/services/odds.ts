// Odds API v4 integration for AFL bookmaker prices
// Free tier: 500 requests/month — responses are cached for 1 hour

const SPORT = "aussierules_afl";
const API_BASE = "https://api.the-odds-api.com/v4";

// Mapping from Odds API full team names → Squiggle short names (18 clubs)
const ODDS_TO_SQUIGGLE: Record<string, string> = {
  "Adelaide Crows": "Adelaide",
  "Brisbane Lions": "Brisbane",
  "Carlton Blues": "Carlton",
  "Collingwood Magpies": "Collingwood",
  "Essendon Bombers": "Essendon",
  "Fremantle Dockers": "Fremantle",
  "Geelong Cats": "Geelong",
  "Gold Coast Suns": "Gold Coast",
  "Greater Western Sydney Giants": "GWS Giants",
  "GWS Giants": "GWS Giants",
  "Hawthorn Hawks": "Hawthorn",
  "Melbourne Demons": "Melbourne",
  "North Melbourne Kangaroos": "North Melbourne",
  "North Melbourne": "North Melbourne",
  "Port Adelaide Power": "Port Adelaide",
  "Richmond Tigers": "Richmond",
  "St Kilda Saints": "St Kilda",
  "Sydney Swans": "Sydney",
  "West Coast Eagles": "West Coast",
  "Western Bulldogs": "Western Bulldogs",
};

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
  homeTeam: string; // Squiggle-normalized
  awayTeam: string;
  bookmakers: BookmakerLine[];
  avgHomeOdds: number | null; // mean across all bookmakers
  avgAwayOdds: number | null;
  homeImpliedPct: number | null; // implied probability from average odds
  awayImpliedPct: number | null;
}

let oddsCache: { games: GameOdds[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function normalizeTeam(name: string): string {
  if (ODDS_TO_SQUIGGLE[name]) return ODDS_TO_SQUIGGLE[name];
  // Substring fallback for unexpected name variants
  for (const squiggleName of Object.values(ODDS_TO_SQUIGGLE)) {
    if (name.toLowerCase().includes(squiggleName.toLowerCase())) return squiggleName;
  }
  return name;
}

function decimalToImplied(odds: number): number {
  // Round to 1 decimal place, e.g. 1.85 → 54.1
  return Math.round((100 / odds) * 10) / 10;
}

export async function fetchAFLOdds(): Promise<GameOdds[]> {
  if (oddsCache && Date.now() - oddsCache.fetchedAt < CACHE_TTL) {
    return oddsCache.games;
  }

  const apiKey = process.env.THE_ODDS_API_KEY ?? "";
  if (!apiKey) return [];

  const url = new URL(`${API_BASE}/sports/${SPORT}/odds/`);
  url.searchParams.set("apiKey", apiKey);
  url.searchParams.set("regions", "au");
  url.searchParams.set("markets", "h2h");
  url.searchParams.set("oddsFormat", "decimal");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "AFL-AI-Tipper/1.0" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) throw new Error(`Odds API HTTP ${res.status}`);

  const remaining = res.headers.get("x-requests-remaining");
  if (remaining) console.log(`[odds] ${remaining} API requests remaining this month`);

  const events = (await res.json()) as OddsEvent[];

  const games: GameOdds[] = events.map((event) => {
    const homeTeam = normalizeTeam(event.home_team);
    const awayTeam = normalizeTeam(event.away_team);

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
      // Round to 2 decimal places
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

  oddsCache = { games, fetchedAt: Date.now() };
  return games;
}

export function findGameOdds(
  games: GameOdds[],
  homeTeam: string,
  awayTeam: string
): GameOdds | null {
  // Try exact match first (home/away as-is)
  let match = games.find((g) => g.homeTeam === homeTeam && g.awayTeam === awayTeam);
  if (match) return match;
  // Try reversed — Odds API may have home/away swapped vs Squiggle
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
