export interface GameContext {
  homeTeam: string;
  awayTeam: string;
  venue: string;
  gameDate: string;
  round: number;
  year: number;
}

export interface SourceContent {
  name: string;
  type: string;
  content: string;
}

export interface TipResult {
  tip: string;
  confidence: number;
  reasoning: string;
  dataSummary: string;
  keyFactors: string;
  playerAvailability: string;
}

export interface AIProvider {
  generateTip(gameContext: GameContext, sources: SourceContent[]): Promise<TipResult>;
  readonly providerName: string;
  readonly modelName: string;
}
