import { useEffect, useMemo, useState } from 'react';
import { api, type Standing, type Game } from '@api/client';

export default function Dashboard() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [upcoming, setUpcoming] = useState<Game | null>(null);

  const refresh = async () => {
    const [s, g] = await Promise.all([api.standings(), api.getUpcomingGame()]);
    setStandings(s); setUpcoming(g);
  };
  useEffect(() => { refresh(); }, []);

  const leaders = useMemo(() => [...standings].sort((a,b)=>b.points-a.points).slice(0,5), [standings]);

  return (
    <div>
      <h2>Dashboard</h2>
      <section style={{ marginBottom: 16 }}>
        <h3>Leaderboard</h3>
        <table>
          <thead>
            <tr><th>Participant</th><th>Points</th></tr>
          </thead>
          <tbody>
            {leaders.map(l => (
              <tr key={l.id}><td>{l.name}</td><td>{l.points}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section>
        <h3>Next Game</h3>
        {!upcoming && <div>No upcoming game</div>}
        {upcoming && (
          <div>
            <div>{new Date(upcoming.date).toLocaleString()} vs {upcoming.opponent} ({upcoming.home ? 'Home' : 'Away'}) {upcoming.double_points ? '— DOUBLE POINTS' : ''}</div>
          </div>
        )}
      </section>
    </div>
  );
}

