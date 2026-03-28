import Parser from "rss-parser";
import { getCachedRound } from "./squiggle";
import { emit } from "./log-stream";
import { getDb } from "../db/client";

const rssParser = new Parser({ timeout: 10000 });

const PER_SOURCE_LIMIT = 3000;
const GLOBAL_CHAR_LIMIT = 60000;

export interface DataSource {
  id: number;
  name: string;
  type: string;
  url: string;
  description: string;
  enabled: number;
  last_validation_status?: string;
  last_validated_at?: string;
  last_validation_error?: string;
}

export interface FetchedSource {
  name: string;
  type: string;
  content: string;
}

async function fetchRss(source: DataSource): Promise<string> {
  // Pre-fetch as text so we can sanitize malformed XML (bare & in attributes/content)
  // before handing to the strict XML parser.
  const res = await fetch(source.url, {
    headers: { "User-Agent": "AFL-AI-Tipper/1.0" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.text();
  // Strip invalid XML characters (control chars except tab \x09, LF \x0A, CR \x0D)
  // then fix bare & not already part of a valid entity/numeric reference
  const sanitized = raw
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[\da-fA-F]+);)/g, "&amp;");

  let feed;
  try {
    feed = await rssParser.parseString(sanitized);
  } catch {
    // Feed is too malformed for the XML parser — fall back to plain-text extraction
    return raw
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
  }
  const items = (feed.items ?? []).slice(0, 10);
  return items
    .map((item) => {
      const title = item.title ?? "(no title)";
      const summary = item.contentSnippet ?? item.summary ?? "";
      const date = item.pubDate ?? "";
      return `• ${title} (${date})\n  ${summary}`.trim();
    })
    .join("\n\n");
}

async function fetchUrl(source: DataSource): Promise<string> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "AFL-AI-Tipper/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  // Strip tags, collapse whitespace
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchApi(source: DataSource): Promise<string> {
  const res = await fetch(source.url, {
    headers: { "User-Agent": "AFL-AI-Tipper/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return JSON.stringify(json, null, 2);
}

async function fetchSquiggleTipsSource(source: DataSource): Promise<string> {
  const round = getCachedRound();
  if (!round) return "Round information unavailable";
  const url = `${source.url}?q=tips;year=${round.year};round=${round.round}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "AFL-AI-Tipper/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { tips?: Array<Record<string, unknown>> };
  const tips = data.tips ?? [];
  if (tips.length === 0) return "No model tips available yet for this round";

  // Group by game
  const byGame = new Map<string, string[]>();
  for (const tip of tips) {
    const key = `${tip.hteam} vs ${tip.ateam}`;
    if (!byGame.has(key)) byGame.set(key, []);
    const conf = tip.confidence != null ? ` (${tip.confidence}% conf)` : "";
    byGame.get(key)!.push(`  - ${tip.sourcename}: tips ${tip.tip}${conf}`);
  }

  return Array.from(byGame.entries())
    .map(([game, lines]) => `${game}:\n${lines.join("\n")}`)
    .join("\n\n");
}

export async function validateAllSources(): Promise<{ ok: number; errors: number }> {
  const db = getDb();
  const sources = db.query("SELECT * FROM data_sources WHERE enabled = 1").all() as DataSource[];

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      switch (source.type) {
        case "rss":
          return await fetchRss(source);
        case "url":
          return await fetchUrl(source);
        case "api":
          return await fetchApi(source);
        case "squiggle-tips":
          return await fetchSquiggleTipsSource(source);
        default:
          throw new Error(`Unknown source type: ${source.type}`);
      }
    })
  );

  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  let ok = 0;
  let errors = 0;

  for (let i = 0; i < results.length; i++) {
    const source = sources[i];
    const result = results[i];
    if (result.status === "fulfilled") {
      ok++;
      db.run(
        "UPDATE data_sources SET last_validation_status = 'ok', last_validated_at = ?, last_validation_error = '' WHERE id = ?",
        [now, source.id]
      );
      console.log(`  ✓ ${source.name}`);
    } else {
      errors++;
      const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
      db.run(
        "UPDATE data_sources SET last_validation_status = 'error', last_validated_at = ?, last_validation_error = ? WHERE id = ?",
        [now, error, source.id]
      );
      console.error(`  ✗ ${source.name}: ${error}`);
    }
  }

  return { ok, errors };
}

export async function fetchAllSources(sources: DataSource[]): Promise<FetchedSource[]> {
  const enabled = sources.filter((s) => s.enabled === 1);

  // Fetch all in parallel, failures are non-fatal
  const results = await Promise.allSettled(
    enabled.map(async (source) => {
      let content: string;
      switch (source.type) {
        case "rss":
          content = await fetchRss(source);
          break;
        case "url":
          content = await fetchUrl(source);
          break;
        case "api":
          content = await fetchApi(source);
          break;
        case "squiggle-tips":
          content = await fetchSquiggleTipsSource(source);
          break;
        default:
          content = "Unknown source type";
      }
      return { name: source.name, type: source.type, content };
    })
  );

  const fetched: FetchedSource[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const source = enabled[i];
    if (result.status === "fulfilled") {
      const chars = result.value.content.length;
      emit({ type: "fetch", text: `  ✓ ${source.name} (${chars} chars)\n` });
      fetched.push({
        name: source.name,
        type: source.type,
        content: result.value.content.slice(0, PER_SOURCE_LIMIT),
      });
    } else {
      emit({ type: "error", text: `  ✗ ${source.name}: unavailable\n` });
      console.error(`[data-fetcher] Failed to fetch ${source.name}:`, result.reason);
      fetched.push({ name: source.name, type: source.type, content: "[unavailable]" });
    }
  }

  // Sort by priority, then apply global cap
  const priorityOrder = ["squiggle-tips", "rss", "api", "url"];
  fetched.sort(
    (a, b) => priorityOrder.indexOf(a.type) - priorityOrder.indexOf(b.type)
  );

  const capped: FetchedSource[] = [];
  let total = 0;
  for (const src of fetched) {
    if (total >= GLOBAL_CHAR_LIMIT) break;
    capped.push(src);
    total += src.content.length;
  }

  return capped;
}
