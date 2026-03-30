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
      style="border-radius:10px;border:1px solid rgba(255,255,255,0.07);background:rgba(255,255,255,0.03);padding:8px 12px"
    >
      <summary class="list-none cursor-pointer select-none">
        <div class="flex items-center text-sm">
          <div class="flex-1 text-left" style={homeFavored ? "color:white" : "color:rgba(71,85,105,0.8)"}>
            <span class="font-black tabular-nums">${avgHomeOdds?.toFixed(2)}</span>
            <span class="text-xs ml-1" style="color:rgba(71,85,105,0.7)">{homeImpliedPct}%</span>
          </div>
          <div class="text-xs px-2" style="color:rgba(71,85,105,0.6)">avg</div>
          <div class="flex-1 text-right" style={!homeFavored ? "color:white" : "color:rgba(71,85,105,0.8)"}>
            <span class="text-xs mr-1" style="color:rgba(71,85,105,0.7)">{awayImpliedPct}%</span>
            <span class="font-black tabular-nums">${avgAwayOdds?.toFixed(2)}</span>
          </div>
        </div>
        <div class="text-center mt-1" style="font-size:10px;color:rgba(71,85,105,0.6)">
          ▸ {bookmakers.length} bookmaker{bookmakers.length === 1 ? "" : "s"}
        </div>
      </summary>

      <div class="mt-2 pt-2" style="border-top:1px solid rgba(255,255,255,0.06)">
        <table class="w-full text-xs">
          <thead>
            <tr style="color:rgba(71,85,105,0.7)">
              <th class="text-left font-normal pb-1">Bookmaker</th>
              <th class="text-right font-normal pb-1 tabular-nums">{homeTeam.split(" ").pop()}</th>
              <th class="text-right font-normal pb-1 tabular-nums">{awayTeam.split(" ").pop()}</th>
            </tr>
          </thead>
          <tbody>
            {bookmakers.map((b) => {
              const homeIsFav = b.homeOdds <= b.awayOdds;
              return (
                <tr style="border-top:1px solid rgba(255,255,255,0.04)">
                  <td class="py-0.5" style="color:rgba(100,116,139,0.7)">{b.name}</td>
                  <td class="py-0.5 text-right tabular-nums" style={homeIsFav ? "color:white" : "color:rgba(71,85,105,0.7)"}>
                    ${b.homeOdds.toFixed(2)}
                  </td>
                  <td class="py-0.5 text-right tabular-nums" style={!homeIsFav ? "color:white" : "color:rgba(71,85,105,0.7)"}>
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
