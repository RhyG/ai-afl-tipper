import OpenAI from "openai";
import { emit } from "../log-stream";
import type { AIProvider, GameContext, SourceContent, TipResult } from "./provider";
import { TipResultSchema, buildSystemPrompt } from "./claude";
import type { SportConfig } from "../../sports";

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

    return this.callWithRetry(userMessage, gameContext.sport);
  }

  private async callWithRetry(userMessage: string, sport: SportConfig, isRetry = false): Promise<TipResult> {
    const base = buildSystemPrompt(sport);
    const systemContent = isRetry
      ? base + "\n\nCRITICAL: Return ONLY the JSON object, nothing else whatsoever."
      : base;

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
        return this.callWithRetry(userMessage, sport, true);
      }
      throw new Error("AI response did not contain valid JSON");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return TipResultSchema.parse(parsed);
  }
}
