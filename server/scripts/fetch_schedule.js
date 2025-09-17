#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dayjs = require('dayjs');

const TEAM_ID = 3; // NY Rangers
const SEASON = process.argv[2] || '20252026';

async function run() {
  const url = `https://statsapi.web.nhl.com/api/v1/schedule?teamId=${TEAM_ID}&season=${SEASON}`;
  const { data } = await axios.get(url, { timeout: 20000 });
  const dates = data?.dates || [];
  const games = [];
  for (const d of dates) {
    for (const g of d.games) {
      const isHome = g.teams?.home?.team?.id === TEAM_ID;
      const opponentTeam = isHome ? g.teams?.away?.team : g.teams?.home?.team;
      games.push({
        id: g.gamePk,
        date: dayjs(g.gameDate).toISOString(),
        opponent: opponentTeam?.name || 'TBD',
        home: isHome ? 1 : 0,
        status: g.status?.detailedState || 'SCHEDULED',
        season: SEASON
      });
    }
  }
  const outPath = path.join(__dirname, '..', 'src', `static_schedule_${SEASON}.json`);
  fs.writeFileSync(outPath, JSON.stringify(games, null, 2));
  console.log(`Wrote ${games.length} games to ${outPath}`);
}

run().catch((e) => {
  console.error('Failed to fetch schedule:', e?.response?.status || e.message);
  process.exit(1);
});

