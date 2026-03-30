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

  return (
    <div class="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center gap-6">
      <div class="text-center">
        <div class="text-3xl font-bold text-white">{correct.length}/{tipped.length}</div>
        <div class="text-xs text-gray-500 mt-0.5">Correct</div>
      </div>
      <div class="flex-1">
        <div class="h-3 bg-gray-800 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${pct >= 60 ? "bg-green-500" : "bg-orange-500"}`}
            style={`width: ${pct}%`}
          />
        </div>
        <div class="text-sm text-gray-400 mt-1">{pct}% accuracy this round</div>
      </div>
      <div class="text-right text-xs text-gray-500">
        {fixtures.length - completed.length} game{fixtures.length - completed.length !== 1 ? "s" : ""} remaining
      </div>
    </div>
  );
};
