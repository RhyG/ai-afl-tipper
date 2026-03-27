import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import {
  getAISettings,
  setAISettings,
  getDefaultModelForProvider,
  PROVIDER_MODELS,
} from "../services/runtime-config";

const app = new Hono();

// Returns the model options partial for a given provider (used by HTMX on provider change)
app.get("/ai/models", (c) => {
  const provider = c.req.query("provider") ?? "claude";
  const models = PROVIDER_MODELS[provider] ?? [];
  const current = getAISettings();
  const selectedModel =
    current.provider === provider ? current.model : getDefaultModelForProvider(provider);

  const options = models.map((m) => (
    <option value={m} selected={m === selectedModel}>
      {m}
    </option>
  ));
  return c.html(options.map((o) => renderToString(o as any)).join(""));
});

// Save provider + model
app.post("/ai", async (c) => {
  const body = await c.req.parseBody();
  const provider = (body.provider as string)?.trim();
  const model = (body.model as string)?.trim();

  if (!provider || !model) {
    return c.html(renderToString(<SettingsBadge error="Provider and model are required" /> as any));
  }

  if (!PROVIDER_MODELS[provider]) {
    return c.html(renderToString(<SettingsBadge error={`Unknown provider: ${provider}`} /> as any));
  }

  setAISettings(provider, model);
  return c.html(renderToString(<SettingsBadge provider={provider} model={model} /> as any));
});

interface SettingsBadgeProps {
  provider?: string;
  model?: string;
  error?: string;
}

export const SettingsBadge = ({ provider, model, error }: SettingsBadgeProps) => {
  if (error) {
    return (
      <span id="ai-settings-badge" class="text-xs text-red-400 px-2 py-1 rounded bg-red-900/30 border border-red-700/50">
        {error}
      </span>
    );
  }
  return (
    <span id="ai-settings-badge" class="text-xs text-green-400 px-2 py-1 rounded bg-green-900/30 border border-green-700/50">
      Saved: {provider}/{model}
    </span>
  );
};

export { app as settingsRouter };
