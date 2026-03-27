import Anthropic from "@anthropic-ai/sdk";
import { emit } from "../log-stream";
import { ClaudeProvider, TipResultSchema, streamClaudeRaw } from "./claude";
import { OpenAIProvider } from "./openai";
import type { AIProvider, GameContext, SourceContent, TipResult } from "./provider";

const SYNTHESIS_SYSTEM_PROMPT = `You are a senior AFL tipping panel chair. Two independent AI analysts have reviewed the same match data and produced separate analyses.

Your task is to synthesise their findings into a single final verdict.

- If they AGREE on the winner: write a unified case drawing on the strongest arguments from both. Set confidence as the average of theirs plus 5, capped at 95.
- If they DISAGREE: carefully evaluate each argument against the source data. Identify which case has stronger evidential support. Explain what the other analyst missed or over-weighted. Set confidence to reflect the genuine uncertainty.

In your reasoning field, briefly note each analyst's position and key arguments BEFORE presenting your synthesis. This deliberation is what makes the multi-model approach valuable.

You MUST respond with a single valid JSON object in the same format as the individual analysts:
{
  "tip": "<exactly one of the two team names>",
  "confidence": <integer 0-100>,
  "reasoning": "<include brief analyst summaries, then your synthesis, 3-5 paragraphs>",
  "dataSummary": "<newline-separated bullets, one per source>",
  "keyFactors": "<newline-separated bullets, 3-5 decisive factors>",
  "playerAvailability": "<consolidated player availability from both analyses>"
}

Do not include any text outside the JSON object.`;

export class MultiProvider implements AIProvider {
  readonly providerName = "multi";
  readonly modelName = "claude-opus-4-6 + gpt-4o";

  private claude: ClaudeProvider;
  private openai: OpenAIProvider;
  private anthropicClient: Anthropic;

  constructor(anthropicApiKey: string, openaiApiKey: string) {
    this.claude = new ClaudeProvider(anthropicApiKey, "claude-opus-4-6");
    this.openai = new OpenAIProvider(openaiApiKey, "gpt-4o");
    this.anthropicClient = new Anthropic({ apiKey: anthropicApiKey });
  }

  async generateTip(gameContext: GameContext, sources: SourceContent[]): Promise<TipResult> {
    // ── Analyst 1: Claude ────────────────────────────────────────────────────
    emit({ type: "info", text: "\n━━ ANALYST 1: Claude (claude-opus-4-6) ━━\n\n" });
    const result1 = await this.claude.generateTip(gameContext, sources);

    // ── Analyst 2: GPT-4o ────────────────────────────────────────────────────
    emit({ type: "info", text: "\n\n━━ ANALYST 2: OpenAI (gpt-4o) ━━\n\n" });
    const result2 = await this.openai.generateTip(gameContext, sources);

    const agreed = result1.tip === result2.tip;
    const verdict = agreed
      ? `Both analysts agree: ${result1.tip} (${result1.confidence}% vs ${result2.confidence}% confidence)`
      : `DISAGREEMENT — Claude tips ${result1.tip} (${result1.confidence}%), GPT-4o tips ${result2.tip} (${result2.confidence}%)`;

    emit({ type: "info", text: `\n\n━━ SYNTHESIS: ${verdict} ━━\n\n` });

    // ── Synthesis ────────────────────────────────────────────────────────────
    const synthesisUser = `
Game: ${gameContext.homeTeam} vs ${gameContext.awayTeam}
Venue: ${gameContext.venue}
Round: ${gameContext.round}, ${gameContext.year}

The two team names to choose from:
- "${gameContext.homeTeam}" (home)
- "${gameContext.awayTeam}" (away)

─── ANALYST 1 (Claude claude-opus-4-6) ───
Tip: ${result1.tip}
Confidence: ${result1.confidence}%
Key Factors:
${result1.keyFactors}
Player Availability:
${result1.playerAvailability}
Reasoning:
${result1.reasoning}

─── ANALYST 2 (OpenAI gpt-4o) ───
Tip: ${result2.tip}
Confidence: ${result2.confidence}%
Key Factors:
${result2.keyFactors}
Player Availability:
${result2.playerAvailability}
Reasoning:
${result2.reasoning}

Synthesise these analyses and return your final tip as JSON.`.trim();

    const rawText = await streamClaudeRaw(
      this.anthropicClient,
      "claude-opus-4-6",
      SYNTHESIS_SYSTEM_PROMPT,
      synthesisUser,
      3000
    );

    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Multi-model synthesis did not return valid JSON");

    const parsed = JSON.parse(jsonMatch[0]);
    return TipResultSchema.parse(parsed);
  }
}
