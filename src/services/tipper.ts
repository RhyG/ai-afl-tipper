import { getDb } from "../db/client";
import { config as envConfig } from "../config";
import { getAISettings } from "./runtime-config";
import { getAIProvider } from "./ai";
import { fetchAllSources } from "./data-fetcher";
import { emit } from "./log-stream";
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
  ai_provider: string;
  model: string;
  created_at: string;
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
  const result = await provider.generateTip(gameContext, fetchedSources);

  // Upsert tip
  db.run(
    `INSERT OR REPLACE INTO tips
      (fixture_id, tip, confidence, reasoning, data_summary, key_factors, ai_provider, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))`,
    [
      fixtureId,
      result.tip,
      result.confidence,
      result.reasoning,
      result.dataSummary,
      result.keyFactors,
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
