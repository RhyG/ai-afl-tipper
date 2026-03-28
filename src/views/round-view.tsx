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
          <p class="text-xs text-gray-600 text-center mt-1">Synced: {lastSyncedAt}</p>
        )}
      </div>

      {/* Action buttons */}
      <div class="flex flex-wrap justify-end gap-2 mb-4">
        {untippedCount > 0 && (
          <button
            hx-post={`/tips/generate/bulk?round=${round}&year=${year}&sport=${sport}`}
            hx-target="#fixture-grid"
            hx-swap="innerHTML"
            hx-indicator="#bulk-spinner"
            class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >
            <span>Generate All Tips</span>
            <span id="bulk-spinner" class="htmx-indicator text-xs">⏳</span>
          </button>
        )}
        {(isCurrentRound || !isUpcoming) && (
          <button
            hx-post={`/results/sync?round=${round}&year=${year}&sport=${sport}`}
            hx-target="#fixture-grid"
            hx-swap="innerHTML"
            hx-indicator="#results-spinner"
            class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Update Results
            <span id="results-spinner" class="htmx-indicator text-xs">⏳</span>
          </button>
        )}
        <button
          hx-post={`/fixtures/sync?round=${round}&year=${year}&sport=${sport}`}
          hx-target="#fixture-grid"
          hx-swap="innerHTML"
          hx-indicator="#sync-spinner"
          class="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          Refresh Fixtures
          <span id="sync-spinner" class="htmx-indicator text-xs">⏳</span>
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
        <div class="mb-4 bg-yellow-900/20 border border-yellow-700/30 rounded-lg px-4 py-2 text-sm text-yellow-400">
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
          <div class="col-span-2 text-center py-16 text-gray-600">
            <div class="text-4xl mb-3">{sportConfig.emoji}</div>
            <div class="text-lg font-medium">No fixtures found</div>
            <div class="text-sm mt-1">Click "Refresh Fixtures" to load from the {sportConfig.label} data source</div>
          </div>
        ) : (
          fixtures.map((f) => <FixtureCard fixture={f} tip={tips.get(f.id) ?? null} />)
        )}
      </div>
    </div>
  );
};
