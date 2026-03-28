export type SportId = "afl" | "nrl";

export interface SportConfig {
  id: SportId;
  label: string;        // "AFL" | "NRL"
  fullLabel: string;    // "Australian Football League" | "National Rugby League"
  emoji: string;        // "🏈" | "🏉"
  maxRounds: number;    // 24 | 27
  oddsKey: string;      // The Odds API sport key
  teamNameMap: Record<string, string>; // Odds API name → canonical name
}

const AFL_TEAM_MAP: Record<string, string> = {
  "Adelaide Crows": "Adelaide",
  "Brisbane Lions": "Brisbane",
  "Carlton Blues": "Carlton",
  "Collingwood Magpies": "Collingwood",
  "Essendon Bombers": "Essendon",
  "Fremantle Dockers": "Fremantle",
  "Geelong Cats": "Geelong",
  "Gold Coast Suns": "Gold Coast",
  "Greater Western Sydney Giants": "GWS Giants",
  "GWS Giants": "GWS Giants",
  "Hawthorn Hawks": "Hawthorn",
  "Melbourne Demons": "Melbourne",
  "North Melbourne Kangaroos": "North Melbourne",
  "North Melbourne": "North Melbourne",
  "Port Adelaide Power": "Port Adelaide",
  "Richmond Tigers": "Richmond",
  "St Kilda Saints": "St Kilda",
  "Sydney Swans": "Sydney",
  "West Coast Eagles": "West Coast",
  "Western Bulldogs": "Western Bulldogs",
};

const NRL_TEAM_MAP: Record<string, string> = {
  "Brisbane Broncos": "Brisbane Broncos",
  "Canberra Raiders": "Canberra Raiders",
  "Canterbury Bulldogs": "Canterbury-Bankstown Bulldogs",
  "Canterbury-Bankstown Bulldogs": "Canterbury-Bankstown Bulldogs",
  "Cronulla Sharks": "Cronulla-Sutherland Sharks",
  "Cronulla-Sutherland Sharks": "Cronulla-Sutherland Sharks",
  "Gold Coast Titans": "Gold Coast Titans",
  "Manly Sea Eagles": "Manly-Warringah Sea Eagles",
  "Manly-Warringah Sea Eagles": "Manly-Warringah Sea Eagles",
  "Melbourne Storm": "Melbourne Storm",
  "Newcastle Knights": "Newcastle Knights",
  "New Zealand Warriors": "New Zealand Warriors",
  "NZ Warriors": "New Zealand Warriors",
  "Warriors": "New Zealand Warriors",
  "North Queensland Cowboys": "North Queensland Cowboys",
  "Cowboys": "North Queensland Cowboys",
  "Parramatta Eels": "Parramatta Eels",
  "Penrith Panthers": "Penrith Panthers",
  "South Sydney Rabbitohs": "South Sydney Rabbitohs",
  "Rabbitohs": "South Sydney Rabbitohs",
  "St George Illawarra Dragons": "St George Illawarra Dragons",
  "Dragons": "St George Illawarra Dragons",
  "Sydney Roosters": "Sydney Roosters",
  "Roosters": "Sydney Roosters",
  "Wests Tigers": "Wests Tigers",
  "Dolphins": "Dolphins",
  "Redcliffe Dolphins": "Dolphins",
};

export const SPORTS: Record<SportId, SportConfig> = {
  afl: {
    id: "afl",
    label: "AFL",
    fullLabel: "Australian Football League",
    emoji: "🏈",
    maxRounds: 24,
    oddsKey: "aussierules_afl",
    teamNameMap: AFL_TEAM_MAP,
  },
  nrl: {
    id: "nrl",
    label: "NRL",
    fullLabel: "National Rugby League",
    emoji: "🏉",
    maxRounds: 27,
    oddsKey: "rugbyleague_nrl",
    teamNameMap: NRL_TEAM_MAP,
  },
};

export function parseSport(s: string | undefined): SportId {
  return s === "nrl" ? "nrl" : "afl";
}
