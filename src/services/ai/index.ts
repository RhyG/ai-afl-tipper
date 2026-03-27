import type { Config } from "../../config";
import type { AIProvider } from "./provider";
import { ClaudeProvider } from "./claude";
import { OpenAIProvider } from "./openai";
import { MultiProvider } from "./multi";

const OPENAI_DEFAULT_MODEL = "gpt-4o";

export function getAIProvider(config: Config): AIProvider {
  switch (config.aiProvider) {
    case "claude":
      return new ClaudeProvider(config.anthropicApiKey, config.aiModel);
    case "openai":
      return new OpenAIProvider(
        config.openaiApiKey,
        config.aiModel === "claude-opus-4-6" ? OPENAI_DEFAULT_MODEL : config.aiModel
      );
    case "multi":
      if (!config.anthropicApiKey || !config.openaiApiKey) {
        throw new Error("Multi-provider requires both ANTHROPIC_API_KEY and OPENAI_API_KEY");
      }
      return new MultiProvider(config.anthropicApiKey, config.openaiApiKey);
    default:
      throw new Error(`Unknown AI provider: "${config.aiProvider}". Valid options: claude, openai, multi`);
  }
}
