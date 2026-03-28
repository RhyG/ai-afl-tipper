import { Hono } from "hono";
import { renderToString } from "hono/jsx/dom/server";
import { getDb } from "../db/client";
import { fetchAFLOdds, findGameOdds } from "../services/odds";
import { OddsDisplay } from "../views/components/odds-display";
import type { Fixture } from "../services/tipper";

const app = new Hono();

// Returns an HTML snippet for the odds section of a fixture card.
// Called via HTMX hx-trigger="load" so completed games get an empty div.
app.get("/fixture/:fixtureId", async (c) => {
  const fixtureId = parseInt(c.req.param("fixtureId"), 10);

  const fixture = getDb()
    .query<Fixture, [number]>("SELECT * FROM fixtures WHERE id = ?")
    .get(fixtureId);

  if (!fixture || fixture.is_complete === 1) {
    return c.html(`<div id="odds-${fixtureId}"></div>`);
  }

  try {
    const allOdds = await fetchAFLOdds();
    const odds = findGameOdds(allOdds, fixture.home_team, fixture.away_team);
    return c.html(
      renderToString(
        (
          <OddsDisplay
            fixtureId={fixtureId}
            odds={odds}
            homeTeam={fixture.home_team}
            awayTeam={fixture.away_team}
          />
        ) as any
      )
    );
  } catch (err) {
    console.error(`[odds] Failed for fixture ${fixtureId}:`, err);
    return c.html(`<div id="odds-${fixtureId}"></div>`);
  }
});

export { app as oddsRouter };
