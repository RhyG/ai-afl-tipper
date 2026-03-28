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
    <div
      id={`odds-${fixtureId}`}
      class="rounded-lg border border-gray-700/40 bg-gray-800/30 px-3 py-2"
    >
      <div class="text-xs text-gray-500 uppercase tracking-wide mb-1.5">
        Bookmaker Odds <span class="normal-case text-gray-600">(avg)</span>
      </div>
      <div class="flex items-center text-sm">
        {/* Home odds */}
        <div class={`flex-1 text-left ${homeFavored ? "text-white" : "text-gray-500"}`}>
          <span class="font-bold tabular-nums">${avgHomeOdds?.toFixed(2)}</span>
          <span class="text-xs ml-1 text-gray-500">{homeImpliedPct}%</span>
        </div>
        {/* Separator */}
        <div class="text-gray-700 text-xs px-2">|</div>
        {/* Away odds */}
        <div class={`flex-1 text-right ${!homeFavored ? "text-white" : "text-gray-500"}`}>
          <span class="text-xs mr-1 text-gray-500">{awayImpliedPct}%</span>
          <span class="font-bold tabular-nums">${avgAwayOdds?.toFixed(2)}</span>
        </div>
      </div>
      <div class="text-xs text-gray-600 text-center mt-1 truncate">
        {bookmakers.map((b) => b.name).join(" · ")}
      </div>
    </div>
  );
};
