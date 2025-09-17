const Database = require("better-sqlite3");
const path = require("path");

const dbPath = path.join(__dirname, "data.sqlite");
const db = new Database(dbPath);

db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY, -- NHL gamePk
  date TEXT NOT NULL,
  opponent TEXT NOT NULL,
  home INTEGER NOT NULL, -- 1 if Rangers home
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  season TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, participant_id),
  FOREIGN KEY(game_id) REFERENCES games(id),
  FOREIGN KEY(participant_id) REFERENCES participants(id)
);
CREATE TABLE IF NOT EXISTS results (
  game_id INTEGER PRIMARY KEY,
  first_scorer_id INTEGER,
  first_scorer_name TEXT,
  first_goal_team TEXT,
  player_goal_counts_json TEXT NOT NULL DEFAULT '{}', -- map of playerId -> goals in game
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS standings (
  participant_id INTEGER PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0,
  last_pick_player_id INTEGER,
  last_pick_game_id INTEGER,
  last_correct_first_scorer_game_id INTEGER,
  FOREIGN KEY(participant_id) REFERENCES participants(id)
);

`);

module.exports = db;

// Lightweight migration: add double_points column to games if missing
try {
  const cols = db.prepare("PRAGMA table_info(games)").all();
  const hasDouble = cols.some(c => c.name === 'double_points');
  if (!hasDouble) {
    db.exec("ALTER TABLE games ADD COLUMN double_points INTEGER NOT NULL DEFAULT 0");
  }
} catch (e) {
  // ignore
}

