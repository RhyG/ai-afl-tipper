import type { FC } from "hono/jsx";
import type { Fixture, Tip } from "../../services/tipper";

interface RoundSummaryProps {
  fixtures: Fixture[];
  tips: Map<number, Tip>;
}

export const RoundSummary: FC<RoundSummaryProps> = ({ fixtures, tips }) => {
  const completed = fixtures.filter((f) => f.is_complete === 1 && f.winner);
  const tipped = completed.filter((f) => tips.has(f.id));
  const correct = tipped.filter((f) => {
    const tip = tips.get(f.id);
    return tip && f.winner === tip.tip;
  });

  if (tipped.length === 0) return null;

  const pct = Math.round((correct.length / tipped.length) * 100);
  const barGrad = pct >= 60
    ? "linear-gradient(90deg,#10b981,#34d399)"
    : "linear-gradient(90deg,#f97316,#f43f5e)";

  return (
    <div class="accuracy-bar p-4 flex items-center gap-6">
      <div class="text-center shrink-0">
        <div class="font-black text-white tabular-nums" style="font-size:32px;line-height:1;letter-spacing:-0.02em">
          {correct.length}<span style="color:rgba(100,116,139,0.5);font-size:20px">/{tipped.length}</span>
        </div>
        <div class="uppercase font-semibold mt-1" style="font-size:10px;letter-spacing:0.12em;color:rgba(100,116,139,0.7)">
          Correct
        </div>
      </div>
      <div class="flex-1">
        <div class="conf-bar-track" style="height:8px">
          <div style={`width:${pct}%;height:100%;border-radius:999px;background:${barGrad};transition:width 0.5s ease`} />
        </div>
        <div class="text-sm mt-1.5 font-semibold" style="color:rgba(148,163,184,0.8)">
          {pct}% accuracy this round
        </div>
      </div>
      <div class="text-right shrink-0 text-xs" style="color:rgba(71,85,105,0.9)">
        {fixtures.length - completed.length} game{fixtures.length - completed.length !== 1 ? "s" : ""} remaining
      </div>
    </div>
  );
};
