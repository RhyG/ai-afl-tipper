import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { fetchFixtures, detectCurrentRound } from "../services/squiggle";
import { getDb } from "../db/client";
import { getFixturesForRound, getTipForFixture } from "../services/tipper";
import { FixtureCard } from "../views/components/fixture-card";
import type { Tip } from "../services/tipper";

const app = new Hono();

app.post("/sync", async (c) => {
  const current = await detectCurrentRound();
  const round = parseInt(c.req.query("round") ?? String(current.round), 10);
  const year = parseInt(c.req.query("year") ?? String(current.year), 10);

  try {
    // Fetch all games for the round — captures in-progress scores too
    const games = await fetchFixtures(round, year);
    const db = getDb();

    const update = db.prepare(`
      UPDATE fixtures SET
        home_score = $home_score,
        away_score = $away_score,
        winner = $winner,
        is_complete = $is_complete,
        complete = $complete,
        synced_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
      WHERE squiggle_id = $squiggle_id
        AND ($complete > complete OR $is_complete = 1)
    `);

    for (const game of games) {
      if (game.complete > 0) {
        update.run({
          $squiggle_id: game.id,
          $home_score: game.hscore ?? null,
          $away_score: game.ascore ?? null,
          $winner: game.winner ?? null,
          $is_complete: game.complete === 100 ? 1 : 0,
          $complete: game.complete,
        });
      }
    }
  } catch (err) {
    console.error("Results sync failed:", err);
  }

  const fixtures = getFixturesForRound(round, year);
  const tips = new Map<number, Tip>();
  for (const f of fixtures) {
    const tip = getTipForFixture(f.id);
    if (tip) tips.set(f.id, tip);
  }

  const cards = fixtures.map((f) =>
    renderToString((<FixtureCard fixture={f} tip={tips.get(f.id) ?? null} />) as any)
  );

  return c.html(cards.join(""));
});

export { app as resultsRouter };
