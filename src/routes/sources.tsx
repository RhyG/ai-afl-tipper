import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { getDb } from "../db/client";
import { getAISettings } from "../services/runtime-config";
import { SourceRow } from "../views/components/source-row";
import { SourcesPage } from "../views/sources-page";

interface Source {
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

const app = new Hono();

app.get("/", (c) => {
  const db = getDb();
  const sources = db.query<Source, []>("SELECT * FROM data_sources ORDER BY id ASC").all();
  const aiSettings = getAISettings();
  const page = <SourcesPage sources={sources} aiProvider={aiSettings.provider} aiModel={aiSettings.model} />;
  return c.html("<!DOCTYPE html>" + renderToString(page as any));
});

// Partial: just the tbody rows — used by HTMX to refresh after startup validation
app.get("/rows", (c) => {
  const db = getDb();
  const sources = db.query<Source, []>("SELECT * FROM data_sources ORDER BY id ASC").all();
  const rows = sources.map((s) => <SourceRow source={s} />);
  return c.html(renderToString(<>{rows}</> as any));
});

app.post("/", async (c) => {
  const body = await c.req.parseBody();
  const name = (body.name as string)?.trim();
  const type = (body.type as string)?.trim();
  const url = (body.url as string)?.trim();
  const description = (body.description as string)?.trim() ?? "";

  if (!name || !type || !url) {
    return c.html('<tr><td colspan="6" class="px-4 py-3 text-red-400 text-sm">Name, type and URL are required</td></tr>', 400);
  }

  const db = getDb();
  try {
    const result = db.run(
      "INSERT INTO data_sources (name, type, url, description) VALUES (?, ?, ?, ?)",
      [name, type, url, description]
    );
    const source = db
      .query<Source, [number]>("SELECT * FROM data_sources WHERE id = ?")
      .get(result.lastInsertRowid as number);
    if (!source) throw new Error("Insert failed");
    const row = <SourceRow source={source} />;
    return c.html(renderToString(row as any));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return c.html(`<tr><td colspan="6" class="px-4 py-3 text-red-400 text-sm">Error: ${msg}</td></tr>`, 500);
  }
});

app.post("/:id/toggle", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const db = getDb();
  db.run("UPDATE data_sources SET enabled = 1 - enabled WHERE id = ?", [id]);
  const source = db.query<Source, [number]>("SELECT * FROM data_sources WHERE id = ?").get(id);
  if (!source) return c.html("", 404);
  const row = <SourceRow source={source} />;
  return c.html(renderToString(row as any));
});

app.delete("/:id", (c) => {
  const id = parseInt(c.req.param("id"), 10);
  getDb().run("DELETE FROM data_sources WHERE id = ?", [id]);
  return c.html(""); // HTMX swap removes the row
});

export { app as sourcesRouter };
