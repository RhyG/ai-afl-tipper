import type { FC } from "hono/jsx";

interface RoundNavProps {
  round: number;
  year: number;
  currentRound: number;
  currentYear: number;
  maxRound: number; // highest round known to exist (current + 2)
}

export const RoundNav: FC<RoundNavProps> = ({ round, year, currentRound, currentYear, maxRound }) => {
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
          hx-get={`/rounds/${year}/${prevRound}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${prevRound}`}
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
          hx-get={`/rounds/${year}/${nextRound}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${nextRound}`}
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
