import type { FC } from "hono/jsx";
import type { Fixture, Tip } from "../../services/tipper";

interface TipDetailProps {
  fixture: Fixture;
  tip: Tip;
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

function renderBullets(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => (line.startsWith("- ") ? line.slice(2) : line));
}

export const TipDetail: FC<TipDetailProps> = ({ fixture, tip }) => {
  const isComplete = fixture.is_complete === 1;
  const isLive = !isComplete && fixture.complete > 0 && fixture.home_score != null;
  const homeWon = isComplete && fixture.winner === fixture.home_team;
  const awayWon = isComplete && fixture.winner === fixture.away_team;
  const margin = Math.abs((fixture.home_score ?? 0) - (fixture.away_score ?? 0));

  let correctness: "correct" | "incorrect" | null = null;
  if (isComplete && fixture.winner) {
    correctness = fixture.winner === tip.tip ? "correct" : "incorrect";
  }

  const cardBorder = isLive
    ? "border-red-500/50"
    : isComplete
    ? correctness === "correct"
      ? "border-green-500/40"
      : correctness === "incorrect"
      ? "border-red-500/30"
      : "border-gray-700"
    : "border-blue-500/50";

  return (
    <div
      id={`fixture-${fixture.id}`}
      class={`bg-gray-900 rounded-xl border ${cardBorder} p-5 flex flex-col gap-4 transition-all`}
    >
      {/* Teams */}
      <div class="flex items-start justify-between gap-2">
        <div class="flex-1">
          <div class="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Home</div>
          <div class={`text-sm font-bold ${homeWon ? "text-white" : isComplete ? "text-gray-500" : "text-white"}`}>
            {!isComplete && tip.tip === fixture.home_team && (
              <span class="mr-1.5 text-green-400">▶</span>
            )}
            {fixture.home_team}
            {homeWon && <span class="ml-1.5 text-green-400 text-xs font-bold">W</span>}
            {isComplete && awayWon && <span class="ml-1.5 text-gray-600 text-xs">L</span>}
          </div>
        </div>
        <div class="text-gray-700 font-bold px-2 pt-4">vs</div>
        <div class="flex-1 text-right">
          <div class="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Away</div>
          <div class={`text-sm font-bold ${awayWon ? "text-white" : isComplete ? "text-gray-500" : "text-white"}`}>
            {fixture.away_team}
            {!isComplete && tip.tip === fixture.away_team && (
              <span class="ml-1.5 text-green-400">◀</span>
            )}
            {awayWon && <span class="ml-1.5 text-green-400 text-xs font-bold">W</span>}
            {isComplete && homeWon && <span class="ml-1.5 text-gray-600 text-xs">L</span>}
          </div>
        </div>
      </div>

      <div class="text-xs text-gray-600">📍 {fixture.venue} · 📅 {formatDate(fixture.game_date)}</div>

      {/* Bookmaker odds — lazy-loaded for upcoming games */}
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

      {/* Score */}
      {(isComplete || isLive) && fixture.home_score != null && (
        <div class={`rounded-lg overflow-hidden border ${isLive ? "border-red-500/40" : "border-gray-700/50"}`}>
          {isLive && (
            <div class="bg-red-600 text-white text-center text-xs font-bold py-0.5 tracking-widest uppercase flex items-center justify-center gap-1.5">
              <span class="inline-block w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live · {fixture.complete}% complete
            </div>
          )}
          <div class="flex">
            <div class={`flex-1 flex flex-col items-center py-3 ${homeWon ? "bg-green-950/60" : isComplete ? "bg-gray-800/30" : "bg-gray-800/60"}`}>
              <span class={`text-xs mb-0.5 ${homeWon ? "text-green-400" : "text-gray-500"}`}>
                {fixture.home_team.split(" ").pop()}{homeWon && " ✓"}
              </span>
              <span class={`text-3xl font-bold tabular-nums ${homeWon ? "text-white" : isComplete ? "text-gray-500" : "text-gray-200"}`}>
                {fixture.home_score}
              </span>
            </div>
            <div class="flex flex-col items-center justify-center px-4 bg-gray-800/20">
              {isComplete ? (
                <div class="text-center">
                  <div class="text-xs text-gray-500">Final</div>
                  {margin > 0 && <div class="text-xs text-gray-600">by {margin}</div>}
                </div>
              ) : (
                <span class="text-gray-600 font-bold">vs</span>
              )}
            </div>
            <div class={`flex-1 flex flex-col items-center py-3 ${awayWon ? "bg-green-950/60" : isComplete ? "bg-gray-800/30" : "bg-gray-800/60"}`}>
              <span class={`text-xs mb-0.5 ${awayWon ? "text-green-400" : "text-gray-500"}`}>
                {fixture.away_team.split(" ").pop()}{awayWon && " ✓"}
              </span>
              <span class={`text-3xl font-bold tabular-nums ${awayWon ? "text-white" : isComplete ? "text-gray-500" : "text-gray-200"}`}>
                {fixture.away_score}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tip badge */}
      <div class={`flex items-center gap-3 rounded-lg px-4 py-3 border ${
        correctness === "correct"
          ? "bg-green-950/40 border-green-700/40"
          : correctness === "incorrect"
          ? "bg-red-950/40 border-red-800/40"
          : "bg-blue-950/40 border-blue-700/30"
      }`}>
        <div>
          <div class="text-xs text-gray-500 mb-0.5">We tipped</div>
          <div class="flex items-center gap-2">
            <span class={`text-lg font-bold ${correctness === "incorrect" ? "text-gray-500 line-through" : "text-white"}`}>
              {tip.tip}
            </span>
            {correctness === "correct" && <span class="text-green-400 text-sm font-bold">✓ Correct</span>}
            {correctness === "incorrect" && <span class="text-red-400 text-sm font-bold">✗ Wrong</span>}
          </div>
        </div>
        <div class="ml-auto text-right">
          <div class="text-xs text-gray-500 mb-0.5">Confidence</div>
          <div class="text-2xl font-bold text-white">{tip.confidence}%</div>
        </div>
      </div>

      {/* Data Analysed */}
      {tip.data_summary && (
        <div>
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Data Analysed</h3>
          <ul class="space-y-1">
            {renderBullets(tip.data_summary).map((line) => (
              <li class="flex gap-2 text-sm text-gray-300">
                <span class="text-blue-400 mt-0.5 shrink-0">•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key Factors */}
      {tip.key_factors && (
        <div>
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Key Factors</h3>
          <ul class="space-y-1">
            {renderBullets(tip.key_factors).map((line) => (
              <li class="flex gap-2 text-sm text-gray-300">
                <span class="text-yellow-400 mt-0.5 shrink-0">▸</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Player Availability */}
      {tip.player_availability && tip.player_availability !== "None noted" && (
        <div class="rounded-lg border border-orange-700/30 bg-orange-950/20 px-4 py-3">
          <h3 class="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-2">⚠ Player Availability</h3>
          <ul class="space-y-1">
            {renderBullets(tip.player_availability).map((line) => (
              <li class="flex gap-2 text-sm text-orange-200/80">
                <span class="text-orange-500 mt-0.5 shrink-0">!</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning */}
      {tip.reasoning && (
        <div>
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Reasoning</h3>
          <div class="text-sm text-gray-300 leading-relaxed space-y-2">
            {tip.reasoning.split("\n\n").map((para) => (
              <p>{para.trim()}</p>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div class="flex gap-2 pt-1 border-t border-gray-800">
        <button
          hx-get={`/tips/${fixture.id}/card`}
          hx-target={`#fixture-${fixture.id}`}
          hx-swap="outerHTML"
          class="flex-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-lg transition-colors"
        >
          Collapse
        </button>
        {!isComplete && (
          <button
            hx-post={`/tips/generate/${fixture.id}`}
            hx-target={`#fixture-${fixture.id}`}
            hx-swap="outerHTML"
            class="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-lg transition-colors"
          >
            Re-tip
          </button>
        )}
      </div>
    </div>
  );
};
