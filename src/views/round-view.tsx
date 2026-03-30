import type { FC } from "hono/jsx";
import { FixtureCard } from "./components/fixture-card";
import { RoundSummary } from "./components/round-summary";
import { RoundNav } from "./components/round-nav";
import type { Fixture, Tip } from "../services/tipper";
import { SPORTS, type SportId } from "../sports";

interface RoundViewProps {
  round: number;
  year: number;
  currentRound: number;
  currentYear: number;
  maxRound: number;
  fixtures: Fixture[];
  tips: Map<number, Tip>;
  lastSyncedAt?: string;
  sport?: SportId;
}

export const RoundView: FC<RoundViewProps> = ({
  round,
  year,
  currentRound,
  currentYear,
  maxRound,
  fixtures,
  tips,
  lastSyncedAt,
  sport = "afl",
}) => {
  const isCurrentRound = round === currentRound && year === currentYear;
  const isUpcoming = round > currentRound || year > currentYear;
  const untippedCount = fixtures.filter((f) => !tips.has(f.id) && !f.is_complete).length;
  const hasCompleted = fixtures.some((f) => f.is_complete);
  const now = new Date();
  const hasLiveGames = fixtures.some(
    (f) => f.is_complete === 0 && new Date(f.game_date) <= now
  );
  const sportConfig = SPORTS[sport];

  return (
    <div>
      {/* Round navigator */}
      <div class="mb-6">
        <RoundNav
          round={round}
          year={year}
          currentRound={currentRound}
          currentYear={currentYear}
          maxRound={maxRound}
          sport={sport}
        />
        {lastSyncedAt && (
          <p class="text-xs text-center mt-1" style="color:rgba(71,85,105,0.7)">Synced: {lastSyncedAt}</p>
        )}
      </div>

      {/* Action buttons */}
      <div class="flex flex-wrap justify-end gap-2 mb-4">
        {untippedCount > 0 && (
          <button
            hx-post={`/tips/generate/bulk?round=${round}&year=${year}&sport=${sport}`}
            hx-target="#fixture-grid"
            hx-swap="innerHTML"
            class="btn-primary relative flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl"
          >
            <span class="hide-on-load">Generate All Tips</span>
            <svg class="htmx-indicator spin-on-load absolute inset-0 m-auto w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </button>
        )}
        {(isCurrentRound || !isUpcoming) && (
          <button
            hx-post={`/results/sync?round=${round}&year=${year}&sport=${sport}`}
            hx-target="#fixture-grid"
            hx-swap="innerHTML"
            class="btn-secondary relative flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl"
          >
            <span class="hide-on-load">Update Results</span>
            <svg class="htmx-indicator spin-on-load absolute inset-0 m-auto w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          </button>
        )}
        <button
          hx-post={`/fixtures/sync?round=${round}&year=${year}&sport=${sport}`}
          hx-target="#fixture-grid"
          hx-swap="innerHTML"
          class="btn-secondary relative flex items-center justify-center gap-2 text-sm px-4 py-2 rounded-xl"
        >
          <span class="hide-on-load">Refresh Fixtures</span>
          <svg class="htmx-indicator spin-on-load absolute inset-0 m-auto w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" d="M12 2a10 10 0 0 1 10 10" />
          </svg>
        </button>
      </div>

      {/* Round summary */}
      {hasCompleted && (
        <div class="mb-4">
          <RoundSummary fixtures={fixtures} tips={tips} />
        </div>
      )}

      {/* Upcoming badge */}
      {isUpcoming && !hasCompleted && fixtures.length > 0 && (
        <div class="mb-4 rounded-xl px-4 py-3 text-sm" style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.2);color:#fbbf24">
          These games haven't been played yet — generate tips now to lock in your picks before they start.
        </div>
      )}

      {/* Auto-poll results every 60s when games are live */}
      {hasLiveGames && (
        <div
          hx-post={`/results/sync?round=${round}&year=${year}&sport=${sport}`}
          hx-target="#fixture-grid"
          hx-swap="innerHTML"
          hx-trigger="every 60s"
        />
      )}

      {/* Fixture grid */}
      <div id="fixture-grid" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fixtures.length === 0 ? (
          <div class="col-span-2 text-center py-16" style="color:rgba(71,85,105,0.7)">
            <div class="text-5xl mb-4">{sportConfig.emoji}</div>
            <div class="font-black text-white" style="font-size:18px;letter-spacing:-0.01em">No fixtures found</div>
            <div class="text-sm mt-2" style="color:rgba(71,85,105,0.8)">Click "Refresh Fixtures" to load from the {sportConfig.label} data source</div>
          </div>
        ) : (
          fixtures.map((f) => <FixtureCard fixture={f} tip={tips.get(f.id) ?? null} />)
        )}
      </div>
    </div>
  );
};
