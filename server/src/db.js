const path = require("path");
const fs = require("fs");

const useTurso = !!process.env.TURSO_URL;

let db = null;
const schemaSQL = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  opponent TEXT NOT NULL,
  home INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED',
  season TEXT NOT NULL,
  double_points INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS picks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  player_id INTEGER NOT NULL,
  player_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(game_id, participant_id)
);
CREATE TABLE IF NOT EXISTS results (
  game_id INTEGER PRIMARY KEY,
  first_scorer_id INTEGER,
  first_scorer_name TEXT,
  first_goal_team TEXT,
  player_goal_counts_json TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS standings (
  participant_id INTEGER PRIMARY KEY,
  points INTEGER NOT NULL DEFAULT 0,
  last_pick_player_id INTEGER,
  last_pick_game_id INTEGER,
  last_correct_first_scorer_game_id INTEGER
);
`;

if (useTurso) {
	const { createClient } = require("@libsql/client");
	db = createClient({
		databaseUrl: process.env.TURSO_URL,
		authToken: process.env.TURSO_AUTH_TOKEN,
	});

	module.exports = {
		all: async (sql, params = []) => (await db.execute({ sql, args: params })).rows,
		get: async (sql, params = []) => {
			const r = await db.execute({ sql, args: params });
			return r.rows[0] || null;
		},
		run: async (sql, params = []) => {
			await db.execute({ sql, args: params });
			return { lastInsertRowid: undefined, changes: undefined };
		},
		transaction: (fn) => fn, // no-op wrapper; libsql auto-transactions could be added
		exec: async (sql) => { await db.execute(sql); },
		isTurso: true,
		ensureSchema: async () => { await db.execute(schemaSQL); },
		prepare: (sql) => {
			const norm = (argsLike) => {
				const arr = Array.from(argsLike);
				return arr.length === 1 && Array.isArray(arr[0]) ? arr[0] : arr;
			};
			return {
				all: async (...params) => (await db.execute({ sql, args: norm(params) })).rows,
				get: async (...params) => {
					const r = await db.execute({ sql, args: norm(params) });
					return r.rows[0] || null;
				},
				run: async (...params) => {
					await db.execute({ sql, args: norm(params) });
					return { lastInsertRowid: undefined, changes: undefined };
				}
			};
		},
	};
} else {
	const Database = require("better-sqlite3");
	const dbPath = path.join(__dirname, "data.sqlite");
	const sqlite = new Database(dbPath);
	// Ensure schema
	sqlite.exec(schemaSQL);
	// Migration: double_points
	try {
		const cols = sqlite.prepare("PRAGMA table_info(games)").all();
		if (!cols.some(c => c.name === 'double_points')) {
			sqlite.exec("ALTER TABLE games ADD COLUMN double_points INTEGER NOT NULL DEFAULT 0");
		}
	} catch {}

	module.exports = {
		all: (sql, params = []) => sqlite.prepare(sql).all(...params),
		get: (sql, params = []) => sqlite.prepare(sql).get(...params),
		run: (sql, params = []) => sqlite.prepare(sql).run(...params),
		transaction: (fn) => sqlite.transaction(fn),
		exec: (sql) => sqlite.exec(sql),
		isTurso: false,
		ensureSchema: async () => {},
		prepare: (sql) => sqlite.prepare(sql),
	};
}

