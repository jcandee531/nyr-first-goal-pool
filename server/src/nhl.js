const axios = require("axios");
const dayjs = require("dayjs");
const fs = require("fs");
const path = require("path");

const RANGERS_TEAM_ID = 3;

async function fetchSeasonSchedule(season) {
  const url = `https://statsapi.web.nhl.com/api/v1/schedule?teamId=${RANGERS_TEAM_ID}&season=${season}`;
  const { data } = await axios.get(url);
  const dates = data.dates || [];
  const games = [];
  for (const d of dates) {
    for (const g of d.games) {
      const isRangersHome = g.teams.home.team.id === RANGERS_TEAM_ID;
      const opponentTeam = isRangersHome ? g.teams.away.team : g.teams.home.team;
      games.push({
        id: g.gamePk,
        date: dayjs(g.gameDate).toISOString(),
        opponent: opponentTeam.name,
        home: isRangersHome ? 1 : 0,
        status: g.status.detailedState,
        season
      });
    }
  }
  return games;
}

async function fetchGameFeed(gamePk) {
  const url = `https://statsapi.web.nhl.com/api/v1/game/${gamePk}/feed/live`;
  const { data } = await axios.get(url);
  return data;
}

function computeFirstScorerAndCounts(feed) {
  const allPlays = feed.liveData?.plays?.allPlays || [];
  let firstGoal = null;
  const counts = {};
  for (const play of allPlays) {
    if (play.result?.eventTypeId === 'GOAL') {
      const scorer = (play.players || []).find(p => p.playerType === 'Scorer');
      if (scorer) {
        const id = scorer.player?.id;
        const name = scorer.player?.fullName;
        if (id) {
          counts[id] = (counts[id] || 0) + 1;
          if (!firstGoal) {
            firstGoal = {
              player_id: id,
              player_name: name || '',
              team: play.team?.triCode || ''
            };
          }
        }
      }
    }
  }
  return { firstGoal, counts };
}

async function fetchTeamActiveRoster() {
  const url = `https://statsapi.web.nhl.com/api/v1/teams/${RANGERS_TEAM_ID}?expand=team.roster`;
  const { data } = await axios.get(url);
  const team = data?.teams?.[0];
  const roster = team?.roster?.roster || [];
  return roster.map((r) => ({ id: r.person.id, name: r.person.fullName, position: r.position?.abbreviation || '' }));
}

function getActiveRosterFromFeed(feed) {
  const box = feed?.liveData?.boxscore?.teams;
  const gameTeams = feed?.gameData?.teams;
  if (!box || !gameTeams) return null;
  const isHomeRangers = gameTeams?.home?.id === RANGERS_TEAM_ID;
  const teamBox = isHomeRangers ? box.home : box.away;
  if (!teamBox) return null;
  const scratches = new Set(teamBox.scratches || []);
  const activeIds = [
    ...(teamBox.skaters || []),
    ...(teamBox.goalies || []),
  ].filter((id) => !scratches.has(id));
  const playersMap = teamBox.players || {};
  const results = [];
  for (const id of activeIds) {
    const key = `ID${id}`;
    const p = playersMap[key];
    if (p?.person?.id) {
      results.push({ id: p.person.id, name: p.person.fullName, position: p.position?.abbreviation || '' });
    }
  }
  // Deduplicate by id
  const seen = new Set();
  return results.filter(p => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

async function getActiveRosterForGame(gamePk) {
  try {
    const feed = await fetchGameFeed(gamePk);
    const active = getActiveRosterFromFeed(feed);
    if (active && active.length > 0) return active;
  } catch (_e) {
    // ignore, fallback below
  }
  return await fetchTeamActiveRoster();
}

module.exports = { fetchSeasonSchedule, fetchGameFeed, computeFirstScorerAndCounts, getActiveRosterForGame, RANGERS_TEAM_ID };

// Load schedule from a bundled static JSON if available for a season
function loadStaticSchedule(season) {
  try {
    const filePath = path.join(__dirname, `static_schedule_${season}.json`);
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      const games = JSON.parse(raw);
      if (Array.isArray(games)) return games;
    }
  } catch (_e) { /* ignore */ }
  return null;
}

module.exports.loadStaticSchedule = loadStaticSchedule;

async function fetchNextGameLive() {
  const url = `https://statsapi.web.nhl.com/api/v1/teams/${RANGERS_TEAM_ID}?expand=team.schedule.next`;
  const { data } = await axios.get(url);
  const team = data?.teams?.[0];
  const next = team?.nextGameSchedule?.dates?.[0]?.games?.[0];
  if (!next) return null;
  const isHome = next.teams?.home?.team?.id === RANGERS_TEAM_ID;
  const opponentTeam = isHome ? next.teams?.away?.team : next.teams?.home?.team;
  return {
    id: next.gamePk,
    date: dayjs(next.gameDate).toISOString(),
    opponent: opponentTeam?.name || 'TBD',
    home: isHome ? 1 : 0,
    status: next.status?.detailedState || 'SCHEDULED',
  };
}

module.exports.fetchNextGameLive = fetchNextGameLive;

