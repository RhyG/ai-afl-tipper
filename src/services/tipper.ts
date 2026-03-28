import { getDb } from "../db/client";
import { config as envConfig } from "../config";
import { getAISettings } from "./runtime-config";
import { getAIProvider } from "./ai";
import { fetchAllSources } from "./data-fetcher";
import { emit } from "./log-stream";
import {
  fetchAllGamesForYear,
  buildLadder,
  getRecentForm,
  getH2HHistory,
  type SquiggleGame,
} from "./squiggle";
import { fetchAFLOdds, findGameOdds, formatOddsForPrompt } from "./odds";
import type { GameContext } from "./ai/provider";

export interface Fixture {
  id: number;
  squiggle_id: number;
  round: number;
  year: number;
  home_team: string;
  away_team: string;
  venue: string;
  game_date: string;
  home_score: number | null;
  away_score: number | null;
  winner: string | null;
  is_complete: number;
  complete: number; // 0–100 from Squiggle
  synced_at: string;
}

export interface Tip {
  id: number;
  fixture_id: number;
  tip: string;
  confidence: number;
  reasoning: string;
  data_summary: string;
  key_factors: string;
  player_availability: string;
  ai_provider: string;
  model: string;
  created_at: string;
}

function pad(n: number, width: number) {
  return String(n).padStart(width);
}

function buildStructuredContext(
  allGames: SquiggleGame[],
  fixture: Fixture
): { name: string; type: string; content: string } {
  const { home_team, away_team, round, year } = fixture;

  const lines: string[] = [];

  // ── Ladder ────────────────────────────────────────────────────────────────
  const priorGames = allGames.filter((g) => g.round < round);
  const ladder = buildLadder(priorGames);

  lines.push(`=== ${year} AFL LADDER (after Round ${round - 1}) ===`);
  if (ladder.length === 0) {
    lines.push("No completed games yet this season");
  } else {
    for (const r of ladder) {
      const record = `${r.wins}W-${r.losses}L${r.draws > 0 ? `-${r.draws}D` : ""}`;
      const isMatchTeam = r.team === home_team || r.team === away_team;
      const marker = isMatchTeam ? " ◄" : "";
      lines.push(
        `#${pad(r.rank, 2)} ${r.team.padEnd(26)} ${record.padEnd(12)} Pts:${String(r.points).padStart(2)}  %:${r.pct}${marker}`
      );
    }
  }

  // ── Home team form ────────────────────────────────────────────────────────
  const homeForm = getRecentForm(allGames, home_team, round, 5);
  lines.push(`\n=== ${home_team.toUpperCase()} RECENT FORM ===`);
  if (homeForm.length === 0) {
    lines.push("No completed games yet this season");
  } else {
    for (const g of homeForm) {
      const res = g.won ? "W" : "L";
      const margin = g.margin > 0 ? `+${g.margin}` : String(g.margin);
      const venue = g.atHome ? "(H)" : "(A)";
      lines.push(
        `  R${g.round} ${res} ${margin.padStart(4)}: ${home_team} ${g.score} def${g.won ? "" : "d by"} ${g.opponent} ${g.opponentScore} ${venue}`
      );
    }
    const homeWins = homeForm.filter((g) => g.won).length;
    const homeAvg = homeForm.reduce((s, g) => s + g.margin, 0) / homeForm.length;
    lines.push(
      `  Summary: ${homeWins}W-${homeForm.length - homeWins}L, avg margin ${homeAvg > 0 ? "+" : ""}${homeAvg.toFixed(1)}`
    );
  }

  // ── Away team form ────────────────────────────────────────────────────────
  const awayForm = getRecentForm(allGames, away_team, round, 5);
  lines.push(`\n=== ${away_team.toUpperCase()} RECENT FORM ===`);
  if (awayForm.length === 0) {
    lines.push("No completed games yet this season");
  } else {
    for (const g of awayForm) {
      const res = g.won ? "W" : "L";
      const margin = g.margin > 0 ? `+${g.margin}` : String(g.margin);
      const venue = g.atHome ? "(H)" : "(A)";
      lines.push(
        `  R${g.round} ${res} ${margin.padStart(4)}: ${away_team} ${g.score} def${g.won ? "" : "d by"} ${g.opponent} ${g.opponentScore} ${venue}`
      );
    }
    const awayWins = awayForm.filter((g) => g.won).length;
    const awayAvg = awayForm.reduce((s, g) => s + g.margin, 0) / awayForm.length;
    lines.push(
      `  Summary: ${awayWins}W-${awayForm.length - awayWins}L, avg margin ${awayAvg > 0 ? "+" : ""}${awayAvg.toFixed(1)}`
    );
  }

  // ── Head-to-head ──────────────────────────────────────────────────────────
  const h2h = getH2HHistory(allGames, home_team, away_team, round, 5);
  lines.push(`\n=== HEAD-TO-HEAD (${year} season) ===`);
  if (h2h.length === 0) {
    lines.push("No meetings between these teams yet this season");
  } else {
    for (const m of h2h) {
      lines.push(
        `  R${m.round}: ${m.winner} won — ${m.homeTeam} ${m.homeScore} vs ${m.awayTeam} ${m.awayScore}`
      );
    }
    const homeH2HWins = h2h.filter((m) => m.winner === home_team).length;
    lines.push(`  ${year} H2H: ${home_team} ${homeH2HWins}–${h2h.length - homeH2HWins} ${away_team}`);
  }

  return {
    name: "Structured Game Context",
    type: "structured",
    content: lines.join("\n"),
  };
}

export async function generateTipForFixture(fixtureId: number): Promise<Tip> {
  const db = getDb();

  const fixture = db
    .query<Fixture, [number]>("SELECT * FROM fixtures WHERE id = ?")
    .get(fixtureId);

  if (!fixture) throw new Error(`Fixture ${fixtureId} not found`);

  emit({ type: "info", text: `\n── ${fixture.home_team} vs ${fixture.away_team} ──\n` });

  const sources = db
    .query<
      { id: number; name: string; type: string; url: string; description: string; enabled: number },
      []
    >("SELECT * FROM data_sources WHERE enabled = 1")
    .all();

  emit({ type: "fetch", text: `Fetching ${sources.length} data source(s)...\n` });
  const fetchedSources = await fetchAllSources(sources);
  const available = fetchedSources.filter((s) => s.content !== "[unavailable]");
  emit({ type: "fetch", text: `${available.length}/${fetchedSources.length} sources ready\n` });

  // ── Structured pre-processing ─────────────────────────────────────────────
  let allSources = fetchedSources;
  try {
    emit({ type: "fetch", text: `Building structured game context...\n` });
    const allGames = await fetchAllGamesForYear(fixture.year);
    const structuredContext = buildStructuredContext(allGames, fixture);
    allSources = [structuredContext, ...fetchedSources];
    emit({ type: "fetch", text: `  ✓ Structured Game Context (${structuredContext.content.length} chars)\n` });
  } catch (err) {
    emit({ type: "error", text: `  ✗ Structured context unavailable: ${err}\n` });
  }

  // ── Bookmaker odds ─────────────────────────────────────────────────────────
  if (process.env.THE_ODDS_API_KEY) {
    try {
      emit({ type: "fetch", text: `Fetching bookmaker odds...\n` });
      const allOdds = await fetchAFLOdds();
      const gameOdds = findGameOdds(allOdds, fixture.home_team, fixture.away_team);
      if (gameOdds && gameOdds.bookmakers.length > 0) {
        const oddsContent = formatOddsForPrompt(gameOdds, fixture.home_team, fixture.away_team);
        const oddsSource = { name: "Bookmaker Odds", type: "odds", content: oddsContent };
        // Insert right after structured context (index 0) so it appears early in the prompt
        const [first, ...rest] = allSources;
        allSources = first ? [first, oddsSource, ...rest] : [oddsSource, ...rest];
        emit({
          type: "fetch",
          text: `  ✓ Bookmaker Odds (${gameOdds.bookmakers.length} bookmaker${gameOdds.bookmakers.length === 1 ? "" : "s"})\n`,
        });
      } else {
        emit({ type: "fetch", text: `  - No odds listed yet for this game\n` });
      }
    } catch (err) {
      emit({ type: "error", text: `  ✗ Bookmaker odds unavailable: ${err}\n` });
    }
  }

  const gameContext: GameContext = {
    homeTeam: fixture.home_team,
    awayTeam: fixture.away_team,
    venue: fixture.venue,
    gameDate: fixture.game_date,
    round: fixture.round,
    year: fixture.year,
  };

  const aiSettings = getAISettings();
  const provider = getAIProvider({ ...envConfig, aiProvider: aiSettings.provider, aiModel: aiSettings.model });
  emit({ type: "info", text: `Calling ${provider.providerName}/${provider.modelName}...\n\n` });
  const result = await provider.generateTip(gameContext, allSources);

  // Upsert tip
  db.run(
    `INSERT OR REPLACE INTO tips
      (fixture_id, tip, confidence, reasoning, data_summary, key_factors, player_availability, ai_provider, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
    [
      fixtureId,
      result.tip,
      result.confidence,
      result.reasoning,
      result.dataSummary,
      result.keyFactors,
      result.playerAvailability,
      provider.providerName,
      provider.modelName,
    ]
  );

  const tip = db
    .query<Tip, [number]>("SELECT * FROM tips WHERE fixture_id = ?")
    .get(fixtureId);

  if (!tip) throw new Error("Failed to retrieve tip after insert");
  emit({ type: "done", text: `\n✓ Tipped: ${result.tip} (${result.confidence}% confidence)\n` });
  return tip;
}

export function getFixturesForRound(round: number, year: number): Fixture[] {
  return getDb()
    .query<Fixture, [number, number]>(
      "SELECT * FROM fixtures WHERE round = ? AND year = ? ORDER BY game_date ASC"
    )
    .all(round, year);
}

export function getTipForFixture(fixtureId: number): Tip | null {
  return getDb()
    .query<Tip, [number]>("SELECT * FROM tips WHERE fixture_id = ?")
    .get(fixtureId);
}

export function getAvailableRounds(): Array<{ round: number; year: number }> {
  return getDb()
    .query<{ round: number; year: number }, []>(
      "SELECT DISTINCT round, year FROM fixtures ORDER BY year DESC, round DESC"
    )
    .all();
}
