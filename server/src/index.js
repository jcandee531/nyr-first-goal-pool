const express = require("express");
const cors = require("cors");
const dayjs = require("dayjs");
const { z } = require("zod");
const db = require("./db");
const { fetchSeasonSchedule, fetchGameFeed, computeFirstScorerAndCounts, getActiveRosterForGame } = require("./nhl");

const app = express();
app.use(cors());
app.use(express.json());

function getParticipants() {
  return db.prepare("SELECT * FROM participants ORDER BY id").all();
}

function getLastCompletedGame() {
  return db.prepare("SELECT * FROM games WHERE status IN ('Final', 'OFF') ORDER BY date DESC LIMIT 1").get();
}

function getGameById(id) {
  return db.prepare("SELECT * FROM games WHERE id = ?").get(id);
}

function upsertStandings(participantId) {
  db.prepare("INSERT OR IGNORE INTO standings (participant_id, points) VALUES (?, 0)").run(participantId);
}

app.get('/api/participants', (req, res) => {
  res.json(getParticipants());
});

app.post('/api/participants', (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { name } = parse.data;
  try {
    const info = db.prepare("INSERT INTO participants (name) VALUES (?)").run(name);
    upsertStandings(info.lastInsertRowid);
    res.json({ id: Number(info.lastInsertRowid), name });
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

app.get('/api/games', (req, res) => {
  const rows = db.prepare("SELECT * FROM games ORDER BY date").all();
  res.json(rows);
});

app.get('/api/games/upcoming', (req, res) => {
  const now = dayjs().toISOString();
  const row = db.prepare("SELECT * FROM games WHERE date >= ? ORDER BY date LIMIT 1").get(now);
  res.json(row || null);
});

function getPreviousGame(gameId) {
  return db.prepare("SELECT * FROM games WHERE date < (SELECT date FROM games WHERE id = ?) ORDER BY date DESC LIMIT 1").get(gameId);
}

function getWinnerOfGame(gameId) {
  const result = db.prepare("SELECT * FROM results WHERE game_id = ?").get(gameId);
  if (!result || !result.first_scorer_id) return null;
  const winner = db.prepare("SELECT p.participant_id FROM picks p WHERE p.game_id=? AND p.player_id=?").get(gameId, result.first_scorer_id);
  return winner ? winner.participant_id : null;
}

function getBaseOrderSnake(gameId) {
  // Determine snake direction by game index (0-based) in season
  const games = db.prepare("SELECT id FROM games WHERE season=(SELECT season FROM games WHERE id=?) ORDER BY date").all(gameId).map(r => r.id);
  const index = games.indexOf(gameId);
  const participants = getParticipants();
  const ids = participants.map(p => p.id);
  const forward = index % 2 === 0;
  return forward ? ids : ids.slice().reverse();
}

function getDraftOrderForGame(gameId) {
  const base = getBaseOrderSnake(gameId);
  const prev = getPreviousGame(gameId);
  if (!prev) return base;
  const winnerId = getWinnerOfGame(prev.id);
  if (!winnerId) return base;
  // Winner picks first again. Place winner at front, keep relative order of others as in base
  const others = base.filter(id => id !== winnerId);
  return [winnerId, ...others];
}

app.get('/api/games/:gameId/draft-order', (req, res) => {
  const gameId = Number(req.params.gameId);
  const order = getDraftOrderForGame(gameId);
  res.json(order);
});

app.get('/api/picks', (req, res) => {
  const gameId = Number(req.query.gameId);
  if (!gameId) return res.status(400).json({ error: 'gameId required' });
  const rows = db.prepare("SELECT * FROM picks WHERE game_id=?").all(gameId);
  res.json(rows);
});

app.post('/api/picks', (req, res) => {
  const schema = z.object({ gameId: z.number(), participantId: z.number(), playerId: z.number(), playerName: z.string() });
  const parse = schema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error.flatten());
  const { gameId, participantId, playerId, playerName } = parse.data;

  // Enforce cannot pick same player two games in a row
  const prev = getPreviousGame(gameId);
  if (prev) {
    const lastPick = db.prepare("SELECT player_id FROM picks WHERE game_id=? AND participant_id=?").get(prev.id, participantId);
    if (lastPick && lastPick.player_id === playerId) {
      return res.status(400).json({ error: 'Cannot pick same player two games in a row' });
    }
  }

  // Lock: if already picked for this game, disallow new pick
  const existing = db.prepare("SELECT 1 FROM picks WHERE game_id=? AND participant_id=?").get(gameId, participantId);
  if (existing) {
    return res.status(400).json({ error: 'Pick already submitted for this game' });
  }

  try {
    const info = db.prepare("INSERT INTO picks (game_id, participant_id, player_id, player_name) VALUES (?, ?, ?, ?)").run(gameId, participantId, playerId, playerName);
    db.prepare("INSERT OR IGNORE INTO standings (participant_id, points) VALUES (?, 0)").run(participantId);
    db.prepare("UPDATE standings SET last_pick_player_id=?, last_pick_game_id=? WHERE participant_id=?").run(playerId, gameId, participantId);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/games/:gameId/compute', async (req, res) => {
  const gameId = Number(req.params.gameId);
  try {
    const feed = await fetchGameFeed(gameId);
    const { firstGoal, counts } = computeFirstScorerAndCounts(feed);
    db.prepare("INSERT OR REPLACE INTO results (game_id, first_scorer_id, first_scorer_name, first_goal_team, player_goal_counts_json) VALUES (?, ?, ?, ?, ?)").run(
      gameId, firstGoal?.player_id || null, firstGoal?.player_name || null, firstGoal?.team || null, JSON.stringify(counts)
    );

    // Award points
    const isDouble = !!db.prepare("SELECT double_points FROM games WHERE id=?").get(gameId)?.double_points;
    const multiplier = isDouble ? 2 : 1;
    const picks = db.prepare("SELECT * FROM picks WHERE game_id=?").all(gameId);
    const award = db.prepare("UPDATE standings SET points = points + ? WHERE participant_id=?");
    for (const pick of picks) {
      const goals = counts[pick.player_id] || 0;
      let add = 0;
      if (firstGoal && pick.player_id === firstGoal.player_id) {
        // 3 for first goal, plus 1 for each additional goal beyond the first
        add = (3 + Math.max(0, goals - 1)) * multiplier;
        db.prepare("UPDATE standings SET last_correct_first_scorer_game_id=? WHERE participant_id=?").run(gameId, pick.participant_id);
      } else {
        add = goals * multiplier; // 1 per goal if not first scorer
      }
      if (add > 0) award.run(add, pick.participant_id);
    }

    // Update game status to Final if feed says final
    const detailedState = feed.gameData?.status?.detailedState || '';
    if (detailedState) {
      db.prepare("UPDATE games SET status=? WHERE id=?").run(detailedState, gameId);
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
  const schedule = await fetchSeasonSchedule(season);
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

app.get('/api/standings', (req, res) => {
  const rows = db.prepare("SELECT p.id, p.name, s.points FROM participants p LEFT JOIN standings s ON s.participant_id = p.id ORDER BY s.points DESC, p.id ASC").all();
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

