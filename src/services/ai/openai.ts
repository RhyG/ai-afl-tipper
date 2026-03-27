import OpenAI from "openai";
import { z } from "zod";
import { emit } from "../log-stream";
import type { AIProvider, GameContext, SourceContent, TipResult } from "./provider";

const TipResultSchema = z.object({
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

Rules:
- "tip" must be EXACTLY one of the two team names given in the game context (not abbreviated)
- "confidence" reflects your certainty: 50 = coin flip, 70 = reasonably confident, 90 = very confident
- "dataSummary" must include one bullet per source consulted
- "keyFactors" must have 3-5 bullets summarising the decisive factors
- "playerAvailability" CRITICAL: scan every source for injuries, suspensions, "out", "unavailable", "doubt", "managed", "test", or "omitted". Name every affected player and their team. Missing key players is often the single most decisive factor — do not skip this.
- Do not include any text outside the JSON object`;

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  readonly providerName = "openai";
  readonly modelName: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
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
    const systemContent = isRetry
      ? SYSTEM_PROMPT + "\n\nCRITICAL: Return ONLY the JSON object, nothing else whatsoever."
      : SYSTEM_PROMPT;

    let fullText = "";

    const stream = await this.client.chat.completions.create({
      model: this.modelName,
      max_tokens: 2048,
      stream: true,
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userMessage },
      ],
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? "";
      if (text) {
        fullText += text;
        emit({ type: "ai", text });
      }
    }

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
