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
  const labelColor = isCurrentRound ? "#f97316" : round > currentRound ? "#fbbf24" : "rgba(100,116,139,0.8)";

  return (
    <div id="round-nav" class="flex items-center gap-3 mb-2">
      {prevRound ? (
        <button
          hx-get={`/rounds/${year}/${prevRound}?sport=${sport}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${prevRound}?sport=${sport}`}
          class="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl shrink-0"
        >
          ← <span class="hidden sm:inline">Round {prevRound}</span>
        </button>
      ) : (
        <div class="w-20" />
      )}

      <div class="flex-1 text-center round-display px-4 py-3">
        <div class="font-black text-white" style="font-size:clamp(18px,3vw,28px);letter-spacing:-0.02em;line-height:1">
          Round {round}
        </div>
        <div class="font-semibold mt-0.5" style={`font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:${labelColor}`}>
          {label} · {year}
        </div>
      </div>

      {nextRound ? (
        <button
          hx-get={`/rounds/${year}/${nextRound}?sport=${sport}`}
          hx-target="#round-view"
          hx-swap="innerHTML"
          hx-push-url={`/rounds/${year}/${nextRound}?sport=${sport}`}
          class="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl shrink-0"
        >
          <span class="hidden sm:inline">Round {nextRound}</span> →
        </button>
      ) : (
        <div class="w-20" />
      )}
    </div>
  );
};
