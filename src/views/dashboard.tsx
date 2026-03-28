import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { RoundView } from "./round-view";
import type { Fixture, Tip } from "../services/tipper";
import { SPORTS, type SportId } from "../sports";

interface DashboardProps {
  round: number;
  year: number;
  currentRound: number;
  currentYear: number;
  maxRound: number;
  fixtures: Fixture[];
  tips: Map<number, Tip>;
  lastSyncedAt?: string;
  aiProvider?: string;
  aiModel?: string;
  sport?: SportId;
}

export const Dashboard: FC<DashboardProps> = ({ aiProvider, aiModel, sport = "afl", ...props }) => {
  const sportConfig = SPORTS[sport];
  return (
    <Layout
      title={`${sportConfig.label} AI Tipper — Round ${props.round}`}
      currentPath="/"
      aiProvider={aiProvider}
      aiModel={aiModel}
      sport={sport}
    >
      <div id="round-view">
        <RoundView {...props} sport={sport} />
      </div>
    </Layout>
  );
};
