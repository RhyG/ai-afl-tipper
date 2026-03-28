// Common game record shape — used by both AFL (Squiggle) and NRL (TheSportsDB) services
export interface GameRecord {
  id: number;
  round: number;
  year: number;
  hteam: string;
  ateam: string;
  venue: string;
  date: string;
  hscore: number | null;
  ascore: number | null;
  winner: string | null;
  complete: number; // 0–100, 100 = complete
}
