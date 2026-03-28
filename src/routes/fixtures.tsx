import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { detectCurrentRound } from "../services/squiggle";
import { detectCurrentNRLRound } from "../services/nrl";
import { getFixturesForRound, getTipForFixture } from "../services/tipper";
import type { Tip } from "../services/tipper";
import { FixtureCard } from "../views/components/fixture-card";
import { syncFixtures } from "./dashboard";
import { parseSport } from "../sports";

const app = new Hono();

app.post("/sync", async (c) => {
  const sport = parseSport(c.req.query("sport"));
  const current = sport === "nrl"
    ? await detectCurrentNRLRound()
    : await detectCurrentRound();

  const round = parseInt(c.req.query("round") ?? String(current.round), 10);
  const year = parseInt(c.req.query("year") ?? String(current.year), 10);

  await syncFixtures(round, year, sport);

  const fixtures = getFixturesForRound(round, year, sport);
  const tips = new Map<number, Tip>();
  for (const f of fixtures) {
    const tip = getTipForFixture(f.id);
    if (tip) tips.set(f.id, tip);
  }

  const cards = fixtures.map((f) => (
    <FixtureCard fixture={f} tip={tips.get(f.id) ?? null} />
  ));
  return c.html(cards.map((card) => renderToString(card as any)).join(""));
});

export { app as fixturesRouter };
