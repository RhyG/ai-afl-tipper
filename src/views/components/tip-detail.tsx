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

  const cardStyle = isLive
    ? "border:1px solid rgba(239,68,68,0.5);box-shadow:0 0 0 1px rgba(239,68,68,0.1),0 8px 32px rgba(239,68,68,0.08)"
    : isComplete
    ? correctness === "correct"
      ? "border:1px solid rgba(52,211,153,0.35)"
      : correctness === "incorrect"
      ? "border:1px solid rgba(239,68,68,0.25)"
      : "border:1px solid rgba(255,255,255,0.07)"
    : "border:1px solid rgba(249,115,22,0.3)";

  return (
    <div
      id={`fixture-${fixture.id}`}
      class="rounded-2xl flex flex-col transition-all"
      style={`background:linear-gradient(160deg,rgba(17,27,51,0.95) 0%,rgba(4,13,26,1) 100%);${cardStyle}`}
    >
      {/* Teams header */}
      <div style="background:linear-gradient(180deg,rgba(255,255,255,0.04) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,0.05);padding:20px 20px 16px">
        <div class="flex items-center gap-4">
          <div class="flex-1 min-w-0">
            <div class="uppercase tracking-widest font-semibold mb-1" style="font-size:10px;color:rgba(100,116,139,0.7)">Home</div>
            <div class="font-black uppercase tracking-tight leading-tight" style={`font-size:clamp(15px,2.5vw,20px);${homeWon ? "color:#34d399" : isComplete ? "color:rgba(71,85,105,0.8)" : "color:white"}`}>
              {!isComplete && tip.tip === fixture.home_team && (
                <span style="color:#f97316;margin-right:5px">▶</span>
              )}
              {fixture.home_team}
              {homeWon && <span style="color:#34d399;font-size:11px;margin-left:6px">W</span>}
              {isComplete && awayWon && <span style="color:rgba(71,85,105,0.7);font-size:11px;margin-left:6px">L</span>}
            </div>
          </div>
          <div class="shrink-0 flex items-center justify-center font-black text-xs" style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(100,116,139,0.7)">vs</div>
          <div class="flex-1 min-w-0 text-right">
            <div class="uppercase tracking-widest font-semibold mb-1" style="font-size:10px;color:rgba(100,116,139,0.7)">Away</div>
            <div class="font-black uppercase tracking-tight leading-tight" style={`font-size:clamp(15px,2.5vw,20px);${awayWon ? "color:#34d399" : isComplete ? "color:rgba(71,85,105,0.8)" : "color:white"}`}>
              {fixture.away_team}
              {!isComplete && tip.tip === fixture.away_team && (
                <span style="color:#f97316;margin-left:5px">◀</span>
              )}
              {awayWon && <span style="color:#34d399;font-size:11px;margin-left:6px">W</span>}
              {isComplete && homeWon && <span style="color:rgba(71,85,105,0.7);font-size:11px;margin-left:6px">L</span>}
            </div>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-4 p-5">
        <div class="text-xs" style="color:rgba(71,85,105,0.9)">📍 {fixture.venue} · 📅 {formatDate(fixture.game_date)}</div>

        {/* Bookmaker odds */}
        {!isComplete && !isLive && (
          <div
            id={`odds-${fixture.id}`}
            hx-get={`/odds/fixture/${fixture.id}`}
            hx-trigger="load"
            hx-swap="outerHTML"
            class="text-xs animate-pulse"
            style="color:rgba(71,85,105,0.6)"
          >
            Loading odds...
          </div>
        )}

        {/* Score */}
        {(isComplete || isLive) && fixture.home_score != null && (
          <div style={`border-radius:10px;overflow:hidden;${isLive ? "border:1px solid rgba(239,68,68,0.5);box-shadow:0 0 20px rgba(239,68,68,0.1)" : "border:1px solid rgba(255,255,255,0.07)"}`}>
            {isLive && (
              <div style="background:linear-gradient(90deg,#dc2626,#b91c1c);color:white;text-align:center;font-size:11px;font-weight:800;padding:4px 0;letter-spacing:0.15em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:6px">
                <span class="live-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff" />
                Live · {fixture.complete}% complete
              </div>
            )}
            <div class="flex">
              <div class="flex-1 flex flex-col items-center py-4" style={homeWon ? "background:rgba(16,185,129,0.12)" : "background:rgba(255,255,255,0.03)"}>
                <span class="text-xs font-semibold mb-1" style={homeWon ? "color:#34d399" : "color:rgba(100,116,139,0.6)"}>{fixture.home_team.split(" ").pop()}{homeWon && " ✓"}</span>
                <span class="font-black tabular-nums" style={`font-size:36px;line-height:1;${homeWon ? "color:white" : isComplete ? "color:rgba(100,116,139,0.6)" : "color:rgba(226,232,240,0.9)"}`}>{fixture.home_score}</span>
              </div>
              <div class="flex flex-col items-center justify-center px-4" style="background:rgba(255,255,255,0.02)">
                {isComplete ? (
                  <div class="text-center">
                    <div class="text-xs font-semibold" style="color:rgba(100,116,139,0.7)">Final</div>
                    {margin > 0 && <div style="font-size:10px;color:rgba(71,85,105,0.7);margin-top:2px">by {margin}</div>}
                  </div>
                ) : <span class="text-xs font-bold" style="color:rgba(71,85,105,0.8)">vs</span>}
              </div>
              <div class="flex-1 flex flex-col items-center py-4" style={awayWon ? "background:rgba(16,185,129,0.12)" : "background:rgba(255,255,255,0.03)"}>
                <span class="text-xs font-semibold mb-1" style={awayWon ? "color:#34d399" : "color:rgba(100,116,139,0.6)"}>{fixture.away_team.split(" ").pop()}{awayWon && " ✓"}</span>
                <span class="font-black tabular-nums" style={`font-size:36px;line-height:1;${awayWon ? "color:white" : isComplete ? "color:rgba(100,116,139,0.6)" : "color:rgba(226,232,240,0.9)"}`}>{fixture.away_score}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tip badge */}
        <div
          class="flex items-center gap-4 rounded-xl px-4 py-3"
          style={
            correctness === "correct"
              ? "background:rgba(16,185,129,0.1);border:1px solid rgba(52,211,153,0.25)"
              : correctness === "incorrect"
              ? "background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2)"
              : "background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25)"
          }
        >
          <div>
            <div class="uppercase tracking-widest font-semibold mb-1" style="font-size:10px;color:rgba(100,116,139,0.7)">We tipped</div>
            <div class="flex items-center gap-2">
              <span class="font-black uppercase tracking-tight" style={`font-size:18px;${correctness === "incorrect" ? "color:rgba(100,116,139,0.5);text-decoration:line-through" : "color:white"}`}>
                {tip.tip}
              </span>
              {correctness === "correct" && <span class="text-sm font-black" style="color:#34d399">✓ Correct</span>}
              {correctness === "incorrect" && <span class="text-sm font-black" style="color:#f87171">✗ Wrong</span>}
            </div>
          </div>
          <div class="ml-auto text-right">
            <div class="uppercase tracking-widest font-semibold mb-0.5" style="font-size:10px;color:rgba(100,116,139,0.7)">Confidence</div>
            <div class="font-black tabular-nums text-white" style="font-size:28px;line-height:1;letter-spacing:-0.02em">{tip.confidence}%</div>
          </div>
        </div>

        {/* Data Analysed */}
        {tip.data_summary && (
          <div>
            <h3 class="uppercase tracking-widest font-bold mb-2" style="font-size:10px;color:rgba(100,116,139,0.6)">Data Analysed</h3>
            <ul class="space-y-1">
              {renderBullets(tip.data_summary).map((line) => (
                <li class="flex gap-2 text-sm" style="color:rgba(203,213,225,0.8)">
                  <span class="shrink-0 mt-0.5" style="color:#22d3ee">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Key Factors */}
        {tip.key_factors && (
          <div>
            <h3 class="uppercase tracking-widest font-bold mb-2" style="font-size:10px;color:rgba(100,116,139,0.6)">Key Factors</h3>
            <ul class="space-y-1">
              {renderBullets(tip.key_factors).map((line) => (
                <li class="flex gap-2 text-sm" style="color:rgba(203,213,225,0.8)">
                  <span class="shrink-0 mt-0.5" style="color:#fbbf24">▸</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Player Availability */}
        {tip.player_availability && tip.player_availability !== "None noted" && (
          <div style="border-radius:10px;border:1px solid rgba(249,115,22,0.25);background:rgba(249,115,22,0.07);padding:14px 16px">
            <h3 class="uppercase tracking-widest font-bold mb-2" style="font-size:10px;color:#fb923c">⚠ Player Availability</h3>
            <ul class="space-y-1">
              {renderBullets(tip.player_availability).map((line) => (
                <li class="flex gap-2 text-sm" style="color:rgba(253,186,116,0.8)">
                  <span class="shrink-0 mt-0.5" style="color:#f97316">!</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Reasoning */}
        {tip.reasoning && (
          <div>
            <h3 class="uppercase tracking-widest font-bold mb-2" style="font-size:10px;color:rgba(100,116,139,0.6)">Reasoning</h3>
            <div class="text-sm leading-relaxed space-y-2" style="color:rgba(203,213,225,0.75)">
              {tip.reasoning.split("\n\n").map((para) => (
                <p>{para.trim()}</p>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div class="flex gap-2 pt-1" style="border-top:1px solid rgba(255,255,255,0.06)">
          <button
            hx-get={`/tips/${fixture.id}/card`}
            hx-target={`#fixture-${fixture.id}`}
            hx-swap="outerHTML"
            class="btn-secondary flex-1 text-xs px-3 py-2 rounded-lg"
          >
            Collapse
          </button>
          {!isComplete && (
            <button
              hx-post={`/tips/generate/${fixture.id}`}
              hx-target={`#fixture-${fixture.id}`}
              hx-swap="outerHTML"
              class="btn-secondary relative text-xs px-3 py-2 rounded-lg flex items-center justify-center"
            >
              <span class="hide-on-load">Re-tip</span>
              <svg class="htmx-indicator spin-on-load absolute inset-0 m-auto w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
