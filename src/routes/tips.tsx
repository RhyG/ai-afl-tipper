import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { renderToString } from "hono/jsx/dom/server";
import { generateTipForFixture, getFixturesForRound, getTipForFixture } from "../services/tipper";
import { detectCurrentRound } from "../services/squiggle";
import { subscribe, getHistory, clearHistory } from "../services/log-stream";
import { FixtureCard } from "../views/components/fixture-card";
import { TipDetail } from "../views/components/tip-detail";
import { getDb } from "../db/client";
import type { Fixture, Tip } from "../services/tipper";

const app = new Hono();

// Bulk generate for all untipped games — respects ?round=&year= for cross-round use
app.post("/generate/bulk", async (c) => {
  const current = await detectCurrentRound();
  const round = parseInt(c.req.query("round") ?? String(current.round), 10);
  const year = parseInt(c.req.query("year") ?? String(current.year), 10);

  const fixtures = getFixturesForRound(round, year);
  const untipped = fixtures.filter((f) => {
    const tip = getTipForFixture(f.id);
    return !tip && !f.is_complete;
  });

  // Sequential to avoid rate limits
  for (const fixture of untipped) {
    try {
      await generateTipForFixture(fixture.id);
    } catch (err) {
      console.error(`Bulk tip failed for fixture ${fixture.id}:`, err);
    }
  }

  // Re-fetch all fixtures and tips for full grid render
  const allFixtures = getFixturesForRound(round, year);
  const cards = allFixtures.map((f) => {
    const tip = getTipForFixture(f.id);
    const card = <FixtureCard fixture={f} tip={tip} />;
    return renderToString(card as any);
  });

  return c.html(cards.join(""));
});

// Generate tip for a single fixture
app.post("/generate/:fixtureId", async (c) => {
  const fixtureId = parseInt(c.req.param("fixtureId"), 10);

  const fixture = getDb()
    .query<Fixture, [number]>("SELECT * FROM fixtures WHERE id = ?")
    .get(fixtureId);

  if (!fixture) {
    return c.html(`<div id="fixture-${fixtureId}" class="bg-red-900/30 border border-red-700 rounded-xl p-4 text-red-400 text-sm">Fixture not found</div>`);
  }

  try {
    const tip = await generateTipForFixture(fixtureId);
    const card = <FixtureCard fixture={fixture} tip={tip} />;
    return c.html(renderToString(card as any));
  } catch (err) {
    console.error("Tip generation failed:", err);
    const message = err instanceof Error ? err.message : String(err);
    return c.html(`
      <div id="fixture-${fixtureId}" class="bg-gray-900 border border-red-500/50 rounded-xl p-5">
        <div class="font-semibold text-white mb-1">${fixture.home_team} vs ${fixture.away_team}</div>
        <div class="text-red-400 text-sm mb-3">Failed to generate tip: ${message}</div>
        <button
          hx-post="/tips/generate/${fixtureId}"
          hx-target="#fixture-${fixtureId}"
          hx-swap="outerHTML"
          class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg"
        >Retry</button>
      </div>
    `);
  }
});

// Show expanded tip detail
app.get("/:fixtureId/reasoning", (c) => {
  const fixtureId = parseInt(c.req.param("fixtureId"), 10);

  const fixture = getDb()
    .query<Fixture, [number]>("SELECT * FROM fixtures WHERE id = ?")
    .get(fixtureId);
  const tip = getTipForFixture(fixtureId);

  if (!fixture || !tip) {
    return c.html(`<div id="fixture-${fixtureId}" class="text-gray-500 text-sm p-4">Not found</div>`);
  }

  const detail = <TipDetail fixture={fixture} tip={tip} />;
  return c.html(renderToString(detail as any));
});

// Collapse back to card view
app.get("/:fixtureId/card", (c) => {
  const fixtureId = parseInt(c.req.param("fixtureId"), 10);

  const fixture = getDb()
    .query<Fixture, [number]>("SELECT * FROM fixtures WHERE id = ?")
    .get(fixtureId);
  const tip = getTipForFixture(fixtureId);

  if (!fixture) {
    return c.html(`<div id="fixture-${fixtureId}" class="text-gray-500 text-sm p-4">Not found</div>`);
  }

  const card = <FixtureCard fixture={fixture} tip={tip ?? null} />;
  return c.html(renderToString(card as any));
});

// Clear terminal history
app.post("/clear", (c) => {
  clearHistory();
  return c.text("ok");
});

// SSE stream for terminal
app.get("/stream", (c) => {
  return streamSSE(c, async (stream) => {
    // Replay recent history so the terminal isn't blank on open
    for (const line of getHistory()) {
      await stream.writeSSE({ data: JSON.stringify(line) });
    }

    // Subscribe to live events
    await new Promise<void>((resolve) => {
      const unsub = subscribe(async (line) => {
        try {
          await stream.writeSSE({ data: JSON.stringify(line) });
        } catch {
          unsub();
          resolve();
        }
      });

      c.req.raw.signal.addEventListener("abort", () => {
        unsub();
        resolve();
      });
    });
  });
});

export { app as tipsRouter };
