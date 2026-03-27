import { getDb } from "./client";

export function runMigrations() {
  const db = getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS data_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      description TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS fixtures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      squiggle_id INTEGER UNIQUE NOT NULL,
      round INTEGER NOT NULL,
      year INTEGER NOT NULL,
      home_team TEXT NOT NULL,
      away_team TEXT NOT NULL,
      venue TEXT NOT NULL DEFAULT '',
      game_date TEXT NOT NULL,
      home_score INTEGER,
      away_score INTEGER,
      winner TEXT,
      is_complete INTEGER NOT NULL DEFAULT 0,
      complete INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  // Idempotent migration: add complete column to existing DBs
  try {
    db.run("ALTER TABLE fixtures ADD COLUMN complete INTEGER NOT NULL DEFAULT 0");
  } catch {
    // Column already exists — safe to ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS tips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fixture_id INTEGER UNIQUE NOT NULL REFERENCES fixtures(id),
      tip TEXT NOT NULL,
      confidence INTEGER NOT NULL DEFAULT 50,
      reasoning TEXT NOT NULL DEFAULT '',
      data_summary TEXT NOT NULL DEFAULT '',
      key_factors TEXT NOT NULL DEFAULT '',
      player_availability TEXT NOT NULL DEFAULT '',
      ai_provider TEXT NOT NULL DEFAULT 'claude',
      model TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    )
  `);

  // Idempotent migration: add player_availability to existing DBs
  try {
    db.run("ALTER TABLE tips ADD COLUMN player_availability TEXT NOT NULL DEFAULT ''");
  } catch {
    // Column already exists — safe to ignore
  }

  // Disable dead RSS feeds in existing DBs
  db.run(`
    UPDATE data_sources SET enabled = 0
    WHERE url IN (
      'https://www.theroar.com.au/afl/feed/',
      'https://www.sportingnews.com/au/afl/rss'
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  seedDefaultSources();
}

function seedDefaultSources() {
  const db = getDb();

  const sources = [
    {
      name: "Squiggle Model Tips",
      type: "squiggle-tips",
      url: "https://api.squiggle.com.au/",
      description: "Aggregated model tips from Squiggle's AFL prediction models",
    },
    {
      name: "AFL.com.au News",
      type: "rss",
      url: "https://www.afl.com.au/rss",
      description: "Official AFL news feed",
    },
    {
      name: "Fox Footy",
      type: "rss",
      url: "https://www.foxsports.com.au/rss/afl",
      description: "Fox Sports AFL news and analysis",
    },
    {
      name: "Zero Hanger",
      type: "rss",
      url: "https://www.zerohanger.com/feed/",
      description: "Zero Hanger AFL news feed",
    },
    {
      name: "Real Footy (The Age)",
      type: "rss",
      url: "https://www.theage.com.au/rss/sport/afl.xml",
      description: "The Age AFL coverage",
    },
    {
      name: "AFL Tables 2026",
      type: "url",
      url: "https://afltables.com/afl/seas/2026.html",
      description: "Season statistics and standings",
    },
    {
      name: "Footywire Ladder",
      type: "url",
      url: "https://www.footywire.com/afl/footy/ladder",
      description: "Current AFL season ladder and form from Footywire",
    },
  ];

  const insert = db.prepare(`
    INSERT OR IGNORE INTO data_sources (name, type, url, description)
    VALUES ($name, $type, $url, $description)
  `);

  for (const source of sources) {
    insert.run({
      $name: source.name,
      $type: source.type,
      $url: source.url,
      $description: source.description,
    });
  }
}
