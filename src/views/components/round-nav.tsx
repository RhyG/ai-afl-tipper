import type { FC } from "hono/jsx";
import type { SportId } from "../../sports";

interface RoundNavProps {
  round: number;
  year: number;
  currentRound: number;
  currentYear: number;
  maxRound: number;
  sport?: SportId;
}

export const RoundNav: FC<RoundNavProps> = ({
  round,
  year,
  currentRound,
  currentYear,
  maxRound,
  sport = "afl",
}) => {
  const isCurrentRound = round === currentRound && year === currentYear;
  const prevRound = round > 1 ? round - 1 : null;
  const nextRound = round < maxRound ? round + 1 : null;

  const label = isCurrentRound ? "Current Round" : round > currentRound ? "Upcoming" : "Past Round";
  const labelClass = isCurrentRound
    ? "text-blue-400"
    : round > currentRound
    ? "text-yellow-400"
    : "text-gray-500";

  return (
    <div id="round-nav" class="flex items-center gap-4 mb-2">
      {prevRound ? (
        <button
          hx-get={`/rounds/${year}/${prevRound}?sport=${sport}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${prevRound}?sport=${sport}`}
          class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          ← Round {prevRound}
        </button>
      ) : (
        <div class="w-24" />
      )}

      <div class="flex-1 text-center">
        <div class="text-xl font-bold text-white">Round {round} — {year}</div>
        <div class={`text-xs font-medium ${labelClass}`}>{label}</div>
      </div>

      {nextRound ? (
        <button
          hx-get={`/rounds/${year}/${nextRound}?sport=${sport}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${nextRound}?sport=${sport}`}
          class="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-800"
        >
          Round {nextRound} →
        </button>
      ) : (
        <div class="w-24" />
      )}
    </div>
  );
};
