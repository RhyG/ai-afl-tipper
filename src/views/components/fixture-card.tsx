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
  const cls = value >= 75 ? "conf-high" : value >= 60 ? "conf-mid" : "conf-low";
  return (
    <div>
      <div class="flex justify-between text-xs mb-1.5" style="color:rgba(148,163,184,0.7)">
        <span class="uppercase tracking-widest font-semibold" style="font-size:10px">Confidence</span>
        <span class="font-black tabular-nums" style="color:white">{value}%</span>
      </div>
      <div class="conf-bar-track">
        <div class={`conf-bar-fill ${cls}`} style={`width:${value}%`} />
      </div>
    </div>
  );
}

function Scoreboard({ fixture }: { fixture: Fixture }) {
  const isComplete = fixture.is_complete === 1;
  const isLive = !isComplete && fixture.complete > 0 && fixture.home_score != null;

  if (!isLive && !isComplete) return null;
  if (fixture.home_score == null) return null;

  const homeWon = fixture.winner === fixture.home_team;
  const awayWon = fixture.winner === fixture.away_team;
  const margin = Math.abs((fixture.home_score ?? 0) - (fixture.away_score ?? 0));

  return (
    <div style={`border-radius:10px;overflow:hidden;${isLive ? "border:1px solid rgba(239,68,68,0.5);box-shadow:0 0 20px rgba(239,68,68,0.1)" : "border:1px solid rgba(255,255,255,0.07)"}`}>
      {isLive && (
        <div style="background:linear-gradient(90deg,#dc2626,#b91c1c);color:white;text-align:center;font-size:11px;font-weight:800;padding:4px 0;letter-spacing:0.15em;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:6px">
          <span class="live-dot" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#fff" />
          Live · {fixture.complete}% complete
        </div>
      )}
      <div class="flex">
        <div class="flex-1 flex flex-col items-center py-3 px-3" style={isComplete && homeWon ? "background:rgba(16,185,129,0.12)" : "background:rgba(255,255,255,0.03)"}>
          <span class="text-xs font-semibold mb-1" style={isComplete && homeWon ? "color:#34d399" : "color:rgba(148,163,184,0.6)"}>
            {fixture.home_team.split(" ").pop()}{isComplete && homeWon && " ✓"}
          </span>
          <span class="text-3xl font-black tabular-nums" style={isComplete && homeWon ? "color:white" : isComplete ? "color:rgba(100,116,139,0.8)" : "color:rgba(226,232,240,0.9)"}>
            {fixture.home_score}
          </span>
        </div>
        <div class="flex flex-col items-center justify-center px-3" style="background:rgba(255,255,255,0.02)">
          {isComplete ? (
            <div class="text-center">
              <div class="text-xs font-semibold" style="color:rgba(100,116,139,0.8)">Final</div>
              {margin > 0 && <div style="font-size:10px;color:rgba(71,85,105,0.8);margin-top:2px">by {margin}</div>}
            </div>
          ) : (
            <span class="text-xs font-bold" style="color:rgba(71,85,105,0.9)">vs</span>
          )}
        </div>
        <div class="flex-1 flex flex-col items-center py-3 px-3" style={isComplete && awayWon ? "background:rgba(16,185,129,0.12)" : "background:rgba(255,255,255,0.03)"}>
          <span class="text-xs font-semibold mb-1" style={isComplete && awayWon ? "color:#34d399" : "color:rgba(148,163,184,0.6)"}>
            {fixture.away_team.split(" ").pop()}{isComplete && awayWon && " ✓"}
          </span>
          <span class="text-3xl font-black tabular-nums" style={isComplete && awayWon ? "color:white" : isComplete ? "color:rgba(100,116,139,0.8)" : "color:rgba(226,232,240,0.9)"}>
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

  const cardClass = isLive
    ? "fixture-card card-live"
    : isComplete
    ? correctness === "correct"
      ? "fixture-card card-correct"
      : correctness === "incorrect"
      ? "fixture-card card-wrong"
      : "fixture-card"
    : hasTip
    ? "fixture-card card-tipped"
    : "fixture-card";

  const homeWon = isComplete && fixture.winner === fixture.home_team;
  const awayWon = isComplete && fixture.winner === fixture.away_team;

  const tipIsHome = hasTip && tip!.tip === fixture.home_team;
  const tipIsAway = hasTip && tip!.tip === fixture.away_team;

  return (
    <div id={`fixture-${fixture.id}`} class={cardClass}>
      {/* Teams header — large bold names */}
      <div class="card-teams px-4 pt-4 pb-3">
        <div class="flex items-center gap-3">
          {/* Home team */}
          <div class="flex-1 min-w-0">
            <div class="uppercase tracking-widest font-semibold mb-1" style="font-size:10px;color:rgba(100,116,139,0.7)">Home</div>
            <div
              class="font-black leading-tight uppercase tracking-tight"
              style={`font-size:clamp(14px,2vw,18px);${homeWon ? "color:#34d399" : isComplete && awayWon ? "color:rgba(71,85,105,0.8)" : "color:white"}`}
            >
              {hasTip && !isComplete && tipIsHome && (
                <span style="color:#f97316;margin-right:4px">▶</span>
              )}
              {fixture.home_team}
              {homeWon && <span style="color:#34d399;font-size:11px;margin-left:5px">W</span>}
              {isComplete && awayWon && <span style="color:rgba(71,85,105,0.7);font-size:11px;margin-left:5px">L</span>}
            </div>
          </div>

          {/* VS badge */}
          <div
            class="shrink-0 flex items-center justify-center font-black text-xs"
            style="width:32px;height:32px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);color:rgba(100,116,139,0.7)"
          >
            vs
          </div>

          {/* Away team */}
          <div class="flex-1 min-w-0 text-right">
            <div class="uppercase tracking-widest font-semibold mb-1" style="font-size:10px;color:rgba(100,116,139,0.7)">Away</div>
            <div
              class="font-black leading-tight uppercase tracking-tight"
              style={`font-size:clamp(14px,2vw,18px);${awayWon ? "color:#34d399" : isComplete && homeWon ? "color:rgba(71,85,105,0.8)" : "color:white"}`}
            >
              {fixture.away_team}
              {hasTip && !isComplete && tipIsAway && (
                <span style="color:#f97316;margin-left:4px">◀</span>
              )}
              {awayWon && <span style="color:#34d399;font-size:11px;margin-left:5px">W</span>}
              {isComplete && homeWon && <span style="color:rgba(71,85,105,0.7);font-size:11px;margin-left:5px">L</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div class="px-4 pb-4 flex flex-col gap-3 pt-3">
        {/* Meta */}
        <div class="flex gap-3 text-xs" style="color:rgba(71,85,105,0.9)">
          <span>📍 {fixture.venue || "TBC"}</span>
          <span>📅 {formatDate(fixture.game_date)}</span>
        </div>

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

        {/* Scoreboard */}
        <Scoreboard fixture={fixture} />

        {/* Tip section */}
        {hasTip ? (
          <div class="flex flex-col gap-2">
            {/* Tip pick */}
            <div
              class="rounded-xl px-3 py-2.5"
              style={
                correctness === "correct"
                  ? "background:rgba(16,185,129,0.1);border:1px solid rgba(52,211,153,0.2)"
                  : correctness === "incorrect"
                  ? "background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2)"
                  : "background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2)"
              }
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="uppercase tracking-widest font-semibold mb-0.5" style="font-size:10px;color:rgba(100,116,139,0.7)">Tipped to win</div>
                  <div
                    class="font-black uppercase tracking-tight leading-tight"
                    style={`font-size:15px;${correctness === "incorrect" ? "color:rgba(100,116,139,0.5);text-decoration:line-through" : "color:white"}`}
                  >
                    {tip!.tip}
                  </div>
                </div>
                <div class="text-right">
                  {correctness === "correct" && (
                    <span class="text-sm font-black" style="color:#34d399">✓ Correct</span>
                  )}
                  {correctness === "incorrect" && (
                    <span class="text-sm font-black" style="color:#f87171">✗ Wrong</span>
                  )}
                  <div class="text-xs mt-0.5" style="color:rgba(71,85,105,0.8)">
                    {tip!.ai_provider}/{tip!.model?.split("-").slice(-2).join("-")}
                  </div>
                </div>
              </div>
            </div>

            <ConfidenceBar value={tip!.confidence} />

            <div class="flex gap-2 pt-0.5">
              <button
                hx-get={`/tips/${fixture.id}/reasoning`}
                hx-target={`#fixture-${fixture.id}`}
                hx-swap="outerHTML"
                class="btn-secondary flex-1 text-xs px-3 py-2 rounded-lg text-left"
              >
                Show Reasoning
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
        ) : (
          <div>
            {!isComplete ? (
              <button
                hx-post={`/tips/generate/${fixture.id}`}
                hx-target={`#fixture-${fixture.id}`}
                hx-swap="outerHTML"
                class="btn-primary relative w-full text-sm px-4 py-2.5 rounded-xl flex items-center justify-center"
              >
                <span class="hide-on-load">Generate Tip</span>
                <svg class="htmx-indicator spin-on-load absolute inset-0 m-auto w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
                </svg>
              </button>
            ) : (
              <div class="text-center text-xs" style="color:rgba(71,85,105,0.7)">No tip generated</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
