import type { FC } from "hono/jsx";
import { Layout } from "./layout";
import { RoundView } from "./round-view";
import type { Fixture, Tip } from "../services/tipper";

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
}

export const Dashboard: FC<DashboardProps> = ({ aiProvider, aiModel, ...props }) => {
  return (
    <Layout title={`AFL AI Tipper — Round ${props.round}`} currentPath="/" aiProvider={aiProvider} aiModel={aiModel}>
      <div id="round-view">
        <RoundView {...props} />
      </div>
    </Layout>
  );
};
