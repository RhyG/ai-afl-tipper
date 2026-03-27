import { getDb } from "../db/client";
import { config as envConfig } from "../config";

export interface AISettings {
  provider: string;
  model: string;
}

const PROVIDER_DEFAULTS: Record<string, string> = {
  claude: "claude-opus-4-6",
  openai: "gpt-4o",
};

export const PROVIDER_MODELS: Record<string, string[]> = {
  claude: ["claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"],
  openai: ["gpt-4o", "gpt-4o-mini", "o1", "o3-mini"],
};

function getSetting(key: string): string | null {
  const row = getDb()
    .query<{ value: string }, [string]>("SELECT value FROM settings WHERE key = ?")
    .get(key);
  return row?.value ?? null;
}

function setSetting(key: string, value: string) {
  getDb().run(
    "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
    [key, value]
  );
}

export function getAISettings(): AISettings {
  const provider = getSetting("ai_provider") ?? envConfig.aiProvider;
  const model = getSetting("ai_model") ?? envConfig.aiModel;
  return { provider, model };
}

export function setAISettings(provider: string, model: string) {
  setSetting("ai_provider", provider);
  setSetting("ai_model", model);
}

export function getDefaultModelForProvider(provider: string): string {
  return PROVIDER_DEFAULTS[provider] ?? PROVIDER_MODELS[provider]?.[0] ?? "";
}
