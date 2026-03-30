import type { FC } from "hono/jsx";
import type { GameOdds } from "../../services/odds";

interface OddsDisplayProps {
  fixtureId: number;
  odds: GameOdds | null;
  homeTeam: string;
  awayTeam: string;
}

export const OddsDisplay: FC<OddsDisplayProps> = ({
  fixtureId,
  odds,
  homeTeam,
  awayTeam,
}) => {
  if (!odds || odds.bookmakers.length === 0) {
    return <div id={`odds-${fixtureId}`} />;
  }

  const { avgHomeOdds, avgAwayOdds, homeImpliedPct, awayImpliedPct, bookmakers } = odds;
  const homeFavored = (homeImpliedPct ?? 0) >= (awayImpliedPct ?? 0);

  return (
    <details
      id={`odds-${fixtureId}`}
      class="rounded-lg border border-gray-700/40 bg-gray-800/30 px-3 py-2 group"
    >
      <summary class="list-none cursor-pointer select-none">
        {/* Summary row: avg odds + expand hint */}
        <div class="flex items-center text-sm">
          <div class={`flex-1 text-left ${homeFavored ? "text-white" : "text-gray-500"}`}>
            <span class="font-bold tabular-nums">${avgHomeOdds?.toFixed(2)}</span>
            <span class="text-xs ml-1 text-gray-500">{homeImpliedPct}%</span>
          </div>
          <div class="text-gray-700 text-xs px-2">avg</div>
          <div class={`flex-1 text-right ${!homeFavored ? "text-white" : "text-gray-500"}`}>
            <span class="text-xs mr-1 text-gray-500">{awayImpliedPct}%</span>
            <span class="font-bold tabular-nums">${avgAwayOdds?.toFixed(2)}</span>
          </div>
        </div>
        <div class="text-xs text-gray-600 text-center mt-1">
          <span class="text-gray-700">▸</span> {bookmakers.length} bookmaker{bookmakers.length === 1 ? "" : "s"}
        </div>
      </summary>

      {/* Per-bookmaker breakdown */}
      <div class="mt-2 pt-2 border-t border-gray-700/40">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-gray-600">
              <th class="text-left font-normal pb-1">Bookmaker</th>
              <th class="text-right font-normal pb-1 tabular-nums">{homeTeam.split(" ").pop()}</th>
              <th class="text-right font-normal pb-1 tabular-nums">{awayTeam.split(" ").pop()}</th>
            </tr>
          </thead>
          <tbody>
            {bookmakers.map((b) => {
              const homeIsFav = b.homeOdds <= b.awayOdds;
              return (
                <tr class="border-t border-gray-800/60">
                  <td class="py-0.5 text-gray-500">{b.name}</td>
                  <td class={`py-0.5 text-right tabular-nums ${homeIsFav ? "text-white" : "text-gray-500"}`}>
                    ${b.homeOdds.toFixed(2)}
                  </td>
                  <td class={`py-0.5 text-right tabular-nums ${!homeIsFav ? "text-white" : "text-gray-500"}`}>
                    ${b.awayOdds.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
};
