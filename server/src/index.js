const express = require("express");
const cors = require("cors");
const dayjs = require("dayjs");
const { z } = require("zod");
const db = require("./db");
const { fetchSeasonSchedule, fetchGameFeed, computeFirstScorerAndCounts, getActiveRosterForGame, loadStaticSchedule } = require("./nhl");

const app = express();
app.use(cors());
app.use(express.json());

async function getParticipants() {
  return await db.prepare("SELECT * FROM participants ORDER BY id").all();
}

async function getLastCompletedGame() {
  return await db.prepare("SELECT * FROM games WHERE status IN ('Final', 'OFF') ORDER BY date DESC LIMIT 1").get();
}

function getGameById(id) { return db.prepare("SELECT * FROM games WHERE id = ?").get(id); }

async function upsertStandings(participantId) {
  await db.prepare("INSERT OR IGNORE INTO standings (participant_id, points) VALUES (?, 0)").run(participantId);
}

app.get('/api/participants', async (req, res) => {
  res.json(await getParticipants());
});

app.post('/api/participants', async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { name } = parse.data;
  try {
    const info = await db.prepare("INSERT INTO participants (name) VALUES (?)").run(name);
    await upsertStandings(info.lastInsertRowid || 0);
    const created = await db.prepare("SELECT * FROM participants WHERE name=?").get(name);
    res.json({ id: created?.id, name: created?.name });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/import', async (req, res) => {
  const schema = z.object({ season: z.string().regex(/^[0-9]{8}$/) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { season } = parse.data;
  try {
    const imported = await upsertSeasonScheduleAndMarkDouble(season);
    res.json({ imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/games', async (req, res) => {
  const rows = await db.prepare("SELECT * FROM games ORDER BY date").all();
  res.json(rows);
});

app.get('/api/games/upcoming', async (req, res) => {
  const now = dayjs().toISOString();
  const row = await db.prepare("SELECT * FROM games WHERE date >= ? ORDER BY date LIMIT 1").get(now);
  res.json(row || null);
});

async function getPreviousGame(gameId) { return await db.prepare("SELECT * FROM games WHERE date < (SELECT date FROM games WHERE id = ?) ORDER BY date DESC LIMIT 1").get(gameId); }

async function getWinnerOfGame(gameId) {
  const result = await db.prepare("SELECT * FROM results WHERE game_id = ?").get(gameId);
  if (!result || !result.first_scorer_id) return null;
  const winner = await db.prepare("SELECT p.participant_id FROM picks p WHERE p.game_id=? AND p.player_id=?").get(gameId, result.first_scorer_id);
  return winner ? winner.participant_id : null;
}

async function getBaseOrderSnake(gameId) {
  // Determine snake direction by game index (0-based) in season
  const games = (await db.prepare("SELECT id FROM games WHERE season=(SELECT season FROM games WHERE id=?) ORDER BY date").all(gameId)).map(r => r.id);
  const index = games.indexOf(gameId);
  const participants = await getParticipants();
  const ids = participants.map(p => p.id);
  const forward = index % 2 === 0;
  return forward ? ids : ids.slice().reverse();
}

async function getDraftOrderForGame(gameId) {
  const base = await getBaseOrderSnake(gameId);
  const prev = await getPreviousGame(gameId);
  if (!prev) return base;
  const winnerId = await getWinnerOfGame(prev.id);
  if (!winnerId) return base;
  // Winner picks first again. Place winner at front, keep relative order of others as in base
  const others = base.filter(id => id !== winnerId);
  return [winnerId, ...others];
}

app.get('/api/games/:gameId/draft-order', async (req, res) => {
  const gameId = Number(req.params.gameId);
  const order = await getDraftOrderForGame(gameId);
  res.json(order);
});

app.get('/api/picks', async (req, res) => {
  const gameId = Number(req.query.gameId);
  if (!gameId) return res.status(400).json({ error: 'gameId required' });
  const rows = await db.prepare("SELECT * FROM picks WHERE game_id=?").all(gameId);
  res.json(rows);
});

app.post('/api/picks', async (req, res) => {
  const schema = z.object({ gameId: z.number(), participantId: z.number(), playerId: z.number(), playerName: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { gameId, participantId, playerId, playerName } = parse.data;

  // Enforce cannot pick same player two games in a row
  const prev = await getPreviousGame(gameId);
  if (prev) {
    const lastPick = await db.prepare("SELECT player_id FROM picks WHERE game_id=? AND participant_id=?").get(prev.id, participantId);
    if (lastPick && lastPick.player_id === playerId) {
      return res.status(400).json({ error: 'Cannot pick same player two games in a row' });
    }
  }

  // Lock: if already picked for this game, disallow new pick
  const existing = await db.prepare("SELECT 1 FROM picks WHERE game_id=? AND participant_id=?").get(gameId, participantId);
  if (existing) {
    return res.status(400).json({ error: 'Pick already submitted for this game' });
  }

  try {
    await db.prepare("INSERT INTO picks (game_id, participant_id, player_id, player_name) VALUES (?, ?, ?, ?)").run(gameId, participantId, playerId, playerName);
    await db.prepare("INSERT OR IGNORE INTO standings (participant_id, points) VALUES (?, 0)").run(participantId);
    await db.prepare("UPDATE standings SET last_pick_player_id=?, last_pick_game_id=? WHERE participant_id=?").run(playerId, gameId, participantId);
    const created = await db.prepare("SELECT id FROM picks WHERE game_id=? AND participant_id=?").get(gameId, participantId);
    res.json({ id: created?.id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/:gameId/compute', async (req, res) => {
  const gameId = Number(req.params.gameId);
  try {
    const feed = await fetchGameFeed(gameId);
    const { firstGoal, counts } = computeFirstScorerAndCounts(feed);
    await db.prepare("INSERT OR REPLACE INTO results (game_id, first_scorer_id, first_scorer_name, first_goal_team, player_goal_counts_json) VALUES (?, ?, ?, ?, ?)").run(
      gameId, firstGoal?.player_id || null, firstGoal?.player_name || null, firstGoal?.team || null, JSON.stringify(counts)
    );

    // Award points
    const isDouble = !!(await db.prepare("SELECT double_points FROM games WHERE id=?").get(gameId))?.double_points;
    const multiplier = isDouble ? 2 : 1;
    const picks = await db.prepare("SELECT * FROM picks WHERE game_id=?").all(gameId);
    const award = (points, pid) => db.prepare("UPDATE standings SET points = points + ? WHERE participant_id=?").run(points, pid);
    for (const pick of picks) {
      const goals = counts[pick.player_id] || 0;
      let add = 0;
      if (firstGoal && pick.player_id === firstGoal.player_id) {
        // 3 for first goal, plus 1 for each additional goal beyond the first
        add = (3 + Math.max(0, goals - 1)) * multiplier;
        await db.prepare("UPDATE standings SET last_correct_first_scorer_game_id=? WHERE participant_id=?").run(gameId, pick.participant_id);
      } else {
        add = goals * multiplier; // 1 per goal if not first scorer
      }
      if (add > 0) await award(add, pick.participant_id);
    }

    // Update game status to Final if feed says final
    const detailedState = feed.gameData?.status?.detailedState || '';
    if (detailedState) {
      await db.prepare("UPDATE games SET status=? WHERE id=?").run(detailedState, gameId);
    }

    res.json({ ok: true, firstGoal, counts });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PRNG for deterministic selection
function mulberry32(a) {
  return function() {
    var t = a += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}

async function upsertSeasonScheduleAndMarkDouble(season) {
  const staticSched = loadStaticSchedule(season);
  const schedule = staticSched || await fetchSeasonSchedule(season);
  const insert = db.prepare("INSERT OR IGNORE INTO games (id, date, opponent, home, status, season, double_points) VALUES (?, ?, ?, ?, ?, ?, 0)\n");
  const update = db.prepare("UPDATE games SET date=?, opponent=?, home=?, status=?, season=? WHERE id=?");
  const txn = db.transaction(() => {
    for (const g of schedule) {
      const existing = getGameById(g.id);
      if (existing) {
        update.run(g.date, g.opponent, g.home, g.status, g.season, g.id);
      } else {
        insert.run(g.id, g.date, g.opponent, g.home, g.status, g.season);
      }
    }
  });
  txn();

  const seasonGames = db.prepare("SELECT id FROM games WHERE season=? ORDER BY date").all(season).map(r => r.id);
  const already = db.prepare("SELECT COUNT(1) as c FROM games WHERE season=? AND double_points=1").get(season).c;
  if (seasonGames.length >= 5 && already < 5) {
    const seed = Number(season);
    let rng = mulberry32(seed);
    const picks = new Set();
    while (picks.size < 5) {
      const idx = Math.floor(rng() * seasonGames.length);
      picks.add(seasonGames[idx]);
    }
    const mark = db.prepare("UPDATE games SET double_points=1 WHERE id=?");
    const txn2 = db.transaction(() => { for (const id of picks) mark.run(id); });
    txn2();
  }
  return schedule.length;
}

app.get('/api/games/:gameId/roster', async (req, res) => {
  const gameId = Number(req.params.gameId);
  try {
    const roster = await getActiveRosterForGame(gameId);
    res.json(roster || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/standings', async (req, res) => {
  const rows = await db.prepare("SELECT p.id, p.name, s.points FROM participants p LEFT JOIN standings s ON s.participant_id = p.id ORDER BY s.points DESC, p.id ASC").all();
  res.json(rows.map(r => ({ id: r.id, name: r.name, points: r.points || 0 })));
});

const PORT = process.env.PORT || 3001;
// Import 2025-2026 season once at startup if missing
(async () => {
  const season = '20252026';
  try {
    const count = db.prepare("SELECT COUNT(1) as c FROM games WHERE season=?").get(season).c;
    if (count === 0) {
      console.log(`Importing Rangers schedule for season ${season}...`);
      await upsertSeasonScheduleAndMarkDouble(season);
      console.log(`Imported season ${season}.`);
    }
  } catch (e) {
    console.error('Startup import failed', e);
  }
})();

app.listen(PORT, () => { console.log(`Server listening on port ${PORT}`); });

// Admin endpoints
app.get('/api/admin/health', async (req, res) => {
  const ok = true;
  const dbMode = db.isTurso ? 'turso' : 'sqlite';
  try {
    if (db.isTurso) {
      await db.get('SELECT 1 as ok');
    } else {
      db.get('SELECT 1 as ok');
    }
    res.json({ ok, dbMode });
  } catch (e) {
    res.status(500).json({ ok: false, dbMode, error: String(e?.message || e) });
  }
});

app.post('/api/admin/test-turso', async (req, res) => {
  const adminKey = process.env.ADMIN_KEY;
  if (adminKey && req.headers['x-admin-key'] !== adminKey) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  const schema = z.object({ url: z.string().url(), token: z.string().min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { url, token } = parse.data;
  try {
    const { createClient } = require('@libsql/client');
    const client = createClient({ databaseUrl: url, authToken: token });
    const r = await client.execute('SELECT 1 as ok');
    res.json({ ok: true, result: r.rows?.[0] || null });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

