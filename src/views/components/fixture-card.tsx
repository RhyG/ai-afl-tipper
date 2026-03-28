import type { FC } from "hono/jsx";
import type { Fixture, Tip } from "../../services/tipper";

interface FixtureCardProps {
  fixture: Fixture;
  tip: Tip | null;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 75 ? "bg-green-500" : value >= 60 ? "bg-yellow-500" : "bg-orange-500";
  return (
    <div class="mt-2">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>Confidence</span>
        <span>{value}%</span>
      </div>
      <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div class={`h-full ${color} rounded-full`} style={`width: ${value}%`} />
      </div>
    </div>
  );
}

// Scoreboard shown for in-progress and completed games
function Scoreboard({ fixture }: { fixture: Fixture }) {
  const isComplete = fixture.is_complete === 1;
  const isLive = !isComplete && fixture.complete > 0 && fixture.home_score != null;

  if (!isLive && !isComplete) return null;
  if (fixture.home_score == null) return null;

  const homeWon = fixture.winner === fixture.home_team;
  const awayWon = fixture.winner === fixture.away_team;
  const margin = Math.abs((fixture.home_score ?? 0) - (fixture.away_score ?? 0));

  return (
    <div class={`rounded-lg overflow-hidden ${isLive ? "border border-red-500/40" : "border border-gray-700/50"}`}>
      {isLive && (
        <div class="bg-red-600 text-white text-center text-xs font-bold py-0.5 tracking-widest uppercase flex items-center justify-center gap-1.5">
          <span class="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Live · {fixture.complete}% complete
        </div>
      )}
      <div class="flex">
        {/* Home team score */}
        <div class={`flex-1 flex flex-col items-center py-2.5 px-3 ${
          isComplete && homeWon ? "bg-green-950/60" : isComplete && awayWon ? "bg-gray-800/40" : "bg-gray-800/60"
        }`}>
          <span class={`text-xs font-medium mb-0.5 ${
            isComplete && homeWon ? "text-green-400" : isComplete ? "text-gray-500" : "text-gray-400"
          }`}>
            {fixture.home_team.split(" ").pop()}
            {isComplete && homeWon && " ✓"}
          </span>
          <span class={`text-2xl font-bold tabular-nums ${
            isComplete && homeWon ? "text-white" : isComplete ? "text-gray-500" : "text-gray-200"
          }`}>
            {fixture.home_score}
          </span>
        </div>

        {/* Divider / status */}
        <div class="flex flex-col items-center justify-center px-3 bg-gray-800/30">
          {isComplete ? (
            <div class="text-center">
              <div class="text-xs text-gray-500 font-medium">Final</div>
              {margin > 0 && (
                <div class="text-xs text-gray-600 mt-0.5">by {margin}</div>
              )}
            </div>
          ) : (
            <span class="text-gray-600 text-sm font-bold">vs</span>
          )}
        </div>

        {/* Away team score */}
        <div class={`flex-1 flex flex-col items-center py-2.5 px-3 ${
          isComplete && awayWon ? "bg-green-950/60" : isComplete && homeWon ? "bg-gray-800/40" : "bg-gray-800/60"
        }`}>
          <span class={`text-xs font-medium mb-0.5 ${
            isComplete && awayWon ? "text-green-400" : isComplete ? "text-gray-500" : "text-gray-400"
          }`}>
            {fixture.away_team.split(" ").pop()}
            {isComplete && awayWon && " ✓"}
          </span>
          <span class={`text-2xl font-bold tabular-nums ${
            isComplete && awayWon ? "text-white" : isComplete ? "text-gray-500" : "text-gray-200"
          }`}>
            {fixture.away_score}
          </span>
        </div>
      </div>
    </div>
  );
}

export const FixtureCard: FC<FixtureCardProps> = ({ fixture, tip }) => {
  const isComplete = fixture.is_complete === 1;
  const isLive = !isComplete && fixture.complete > 0 && fixture.home_score != null;
  const hasTip = tip !== null;

  let correctness: "correct" | "incorrect" | null = null;
  if (isComplete && hasTip && fixture.winner) {
    correctness = fixture.winner === tip.tip ? "correct" : "incorrect";
  }

  // Card border: live > completed-correct > completed-incorrect > tipped > default
  const cardBorder = isLive
    ? "border-red-500/50"
    : isComplete
    ? correctness === "correct"
      ? "border-green-500/40"
      : correctness === "incorrect"
      ? "border-red-500/30"
      : "border-gray-700/60"
    : hasTip
    ? "border-blue-500/40"
    : "border-gray-700/60";

  const homeWon = isComplete && fixture.winner === fixture.home_team;
  const awayWon = isComplete && fixture.winner === fixture.away_team;

  return (
    <div
      id={`fixture-${fixture.id}`}
      class={`bg-gray-900 rounded-xl border ${cardBorder} p-4 flex flex-col gap-3 transition-all`}
    >
      {/* Teams header */}
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1 min-w-0">
          <div class="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Home</div>
          <div class={`text-sm font-bold leading-tight ${
            homeWon ? "text-white" : isComplete ? "text-gray-400" : "text-white"
          }`}>
            {hasTip && !isComplete && tip!.tip === fixture.home_team && (
              <span class="mr-1.5 text-green-400">▶</span>
            )}
            {fixture.home_team}
            {homeWon && <span class="ml-1 text-green-400 text-xs">W</span>}
            {isComplete && awayWon && <span class="ml-1 text-gray-600 text-xs">L</span>}
          </div>
        </div>

        <div class="shrink-0 px-2 pt-4 text-gray-700 text-sm font-bold">vs</div>

        <div class="flex-1 min-w-0 text-right">
          <div class="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Away</div>
          <div class={`text-sm font-bold leading-tight ${
            awayWon ? "text-white" : isComplete ? "text-gray-400" : "text-white"
          }`}>
            {fixture.away_team}
            {hasTip && !isComplete && tip!.tip === fixture.away_team && (
              <span class="ml-1.5 text-green-400">◀</span>
            )}
            {awayWon && <span class="ml-1 text-green-400 text-xs">W</span>}
            {isComplete && homeWon && <span class="ml-1 text-gray-600 text-xs">L</span>}
          </div>
        </div>
      </div>

      {/* Meta */}
      <div class="text-xs text-gray-600 flex gap-3">
        <span>📍 {fixture.venue || "TBC"}</span>
        <span>📅 {formatDate(fixture.game_date)}</span>
      </div>

      {/* Bookmaker odds — lazy-loaded for upcoming games only */}
      {!isComplete && !isLive && (
        <div
          id={`odds-${fixture.id}`}
          hx-get={`/odds/fixture/${fixture.id}`}
          hx-trigger="load"
          hx-swap="outerHTML"
          class="text-xs text-gray-700 animate-pulse"
        >
          Loading odds...
        </div>
      )}

      {/* Scoreboard */}
      <Scoreboard fixture={fixture} />

      {/* Tip section */}
      {hasTip ? (
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <div>
                <div class="text-xs text-gray-500 mb-0.5">Tipped to win</div>
                <div class={`text-base font-bold ${
                  correctness === "incorrect" ? "text-gray-500 line-through" : "text-white"
                }`}>
                  {tip!.tip}
                </div>
              </div>
              {correctness === "correct" && (
                <span class="text-green-400 text-sm font-bold">✓ Correct</span>
              )}
              {correctness === "incorrect" && (
                <span class="text-red-400 text-sm font-bold">✗ Wrong</span>
              )}
            </div>
            <span class="text-xs text-gray-600 shrink-0">{tip!.ai_provider}/{tip!.model?.split("-").slice(-2).join("-")}</span>
          </div>
          <ConfidenceBar value={tip!.confidence} />
          <div class="flex gap-2 pt-1">
            <button
              hx-get={`/tips/${fixture.id}/reasoning`}
              hx-target={`#fixture-${fixture.id}`}
              hx-swap="outerHTML"
              class="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-lg transition-colors"
            >
              Show Reasoning
            </button>
            {!isComplete && (
              <button
                hx-post={`/tips/generate/${fixture.id}`}
                hx-target={`#fixture-${fixture.id}`}
                hx-swap="outerHTML"
                class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-500 px-3 py-2 rounded-lg transition-colors flex items-center gap-1"
              >
                <span class="label-on-load">Re-tip</span>
                <svg class="htmx-indicator spin-on-load w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div>
          {!isComplete ? (
            <button
              hx-post={`/tips/generate/${fixture.id}`}
              hx-target={`#fixture-${fixture.id}`}
              hx-swap="outerHTML"
              hx-indicator={`#spinner-${fixture.id}`}
              class="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <span>Generate Tip</span>
              <span id={`spinner-${fixture.id}`} class="htmx-indicator text-xs">⏳</span>
            </button>
          ) : (
            <div class="text-center text-xs text-gray-700">No tip generated</div>
          )}
        </div>
      )}

      <div id={`fixture-${fixture.id}-spinner`} class="htmx-indicator text-center text-xs text-blue-400">
        Generating tip...
      </div>
    </div>
  );
};
