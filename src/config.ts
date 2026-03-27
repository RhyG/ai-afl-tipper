export interface Config {
  anthropicApiKey: string;
  openaiApiKey: string;
  aiProvider: string;
  aiModel: string;
  port: number;
}

export function loadConfig(): Config {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    openaiApiKey: process.env.OPENAI_API_KEY ?? "",
    aiProvider: process.env.AI_PROVIDER ?? "claude",
    aiModel: process.env.AI_MODEL ?? "claude-opus-4-6",
    port: parseInt(process.env.PORT ?? "3000", 10),
  };
}

export const config = loadConfig();
