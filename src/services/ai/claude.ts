import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { emit } from "../log-stream";
import type { AIProvider, GameContext, SourceContent, TipResult } from "./provider";

export const TipResultSchema = z.object({
  tip: z.string(),
  confidence: z.number().int().min(0).max(100),
  reasoning: z.string(),
  dataSummary: z.string(),
  keyFactors: z.string(),
  playerAvailability: z.string(),
});

const SYSTEM_PROMPT = `You are an expert AFL tipping analyst. Your job is to analyse provided data sources and pick the winner of each AFL game.

You MUST respond with a single valid JSON object matching this exact shape:
{
  "tip": "<one of the two team names provided, exactly as given>",
  "confidence": <integer 0-100>,
  "reasoning": "<full written reasoning, 2-4 paragraphs>",
  "dataSummary": "<newline-separated bullets, one per source: - [Source Name]: [key signal or 'no relevant info']>",
  "keyFactors": "<newline-separated bullets, 3-5 decisive factors: - [factor]>",
  "playerAvailability": "<newline-separated list of injured/suspended/unavailable players found in sources: - [Team]: [Player] ([injury/status]); if none found write 'None noted'>"
}

Signal weighting — when sources conflict, trust them in this order:
1. Bookmaker odds (implied probability): market consensus aggregates enormous information; treat as your prior. If one team's implied probability exceeds 65%, you need strong counter-evidence to tip the other team.
2. Squiggle model consensus: aggregated statistical model predictions; highly reliable.
3. Recent form (last 3–5 games): directionally useful but noisy — do not over-weight a single result.
4. Head-to-head and venue history: meaningful context, especially early in the season.
5. News / injury reports: can override all of the above if a key player is confirmed out.
If your tip disagrees with the bookmaker favourite, your reasoning MUST explicitly explain why.

Rules:
- "tip" must be EXACTLY one of the two team names given in the game context (not abbreviated)
- "confidence" reflects your certainty: 50 = coin flip, 70 = reasonably confident, 90 = very confident
- "dataSummary" must include one bullet per source consulted
- "keyFactors" must have 3-5 bullets summarising the decisive factors
- "playerAvailability" CRITICAL: scan every source for injuries, suspensions, "out", "unavailable", "doubt", "managed", "test", or "omitted". Name every affected player and their team. Missing key players is often the single most decisive factor — do not skip this.
- Do not include any text outside the JSON object`;

export class ClaudeProvider implements AIProvider {
  private client: Anthropic;
  readonly providerName = "claude";
  readonly modelName: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.modelName = model;
  }

  async generateTip(gameContext: GameContext, sources: SourceContent[]): Promise<TipResult> {
    const sourceBlock = sources
      .map((s) => `=== ${s.name} (${s.type}) ===\n${s.content}`)
      .join("\n\n");

    const userMessage = `
Game: ${gameContext.homeTeam} vs ${gameContext.awayTeam}
Venue: ${gameContext.venue}
Date: ${gameContext.gameDate}
Round: ${gameContext.round}, ${gameContext.year}

The two team names you must choose from are:
- "${gameContext.homeTeam}" (home)
- "${gameContext.awayTeam}" (away)

Data sources:
${sourceBlock}

Analyse the above and return your tip as a JSON object.`.trim();

    return this.callWithRetry(userMessage);
  }

  private async callWithRetry(userMessage: string, isRetry = false): Promise<TipResult> {
    const system = isRetry
      ? SYSTEM_PROMPT + "\n\nCRITICAL: Return ONLY the JSON object, nothing else whatsoever."
      : SYSTEM_PROMPT;

    const fullText = await streamClaudeRaw(this.client, this.modelName, system, userMessage);

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (!isRetry) {
        emit({ type: "info", text: "\n[retrying with stricter prompt...]\n" });
        return this.callWithRetry(userMessage, true);
      }
      throw new Error("AI response did not contain valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return TipResultSchema.parse(parsed);
  }
}

/**
 * Streams a Claude call and returns the accumulated raw text.
 * Emits each chunk to the SSE log stream as it arrives.
 * Retries up to 3 times on 529 overloaded errors with exponential backoff.
 * Exported for use by MultiProvider's synthesis step.
 */
export async function streamClaudeRaw(
  client: Anthropic,
  model: string,
  system: string,
  user: string,
  maxTokens = 2048
): Promise<string> {
  const MAX_RETRIES = 3;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      let fullText = "";

      const stream = client.messages.stream({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const chunk = event.delta.text;
          fullText += chunk;
          emit({ type: "ai", text: chunk });
        }
      }

      return fullText;
    } catch (err) {
      const isOverloaded =
        err instanceof Anthropic.APIError && err.status === 529;

      if (isOverloaded && attempt < MAX_RETRIES) {
        const waitMs = 5000 * Math.pow(2, attempt); // 5s, 10s, 20s
        emit({
          type: "info",
          text: `\n[Claude overloaded — retrying in ${waitMs / 1000}s (attempt ${attempt + 1}/${MAX_RETRIES})...]\n`,
        });
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      throw err;
    }
  }

  // Unreachable but satisfies TypeScript
  throw new Error("streamClaudeRaw: exceeded retry limit");
}
