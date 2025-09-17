import { useEffect, useMemo, useState } from 'react';
import { api, type Game } from '@api/client';

export default function Schedule() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'server' | 'nhl'>('server');

  const refresh = async () => {
    try {
      const serverGames = await api.listGames();
      if (serverGames.length > 0) {
        setGames(serverGames);
        setSource('server');
        return;
      }
      // Fallback: fetch directly from NHL API client-side for display only
      const season = '20252026';
      const res = await fetch(`https://statsapi.web.nhl.com/api/v1/schedule?teamId=3&season=${season}`);
      const data = await res.json();
      const dates = data?.dates || [];
      const out: Game[] = [] as any;
      for (const d of dates) {
        for (const g of d.games) {
          const isHome = g.teams?.home?.team?.id === 3;
          const opponentTeam = isHome ? g.teams?.away?.team : g.teams?.home?.team;
          out.push({
            id: g.gamePk,
            date: g.gameDate,
            opponent: opponentTeam?.name || 'TBD',
            home: isHome ? 1 : 0,
            status: g.status?.detailedState || 'SCHEDULED',
            season,
            double_points: 0,
          } as Game);
        }
      }
      setGames(out);
      setSource('nhl');
    } catch (e:any) {
      setError(e.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const importSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      await api.importSeason(season);
      await refresh();
    } catch (e:any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const sorted = useMemo(() => [...games].sort((a,b)=>a.date.localeCompare(b.date)), [games]);

  return (
    <div>
      <h2>Schedule</h2>
      {source === 'nhl' && (
        <div style={{ marginBottom: 8, color: '#555' }}>
          Displaying live schedule from NHL API (read-only). Backend import unavailable.
        </div>
      )}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Home/Away</th>
            <th>Status</th>
            <th>Double</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(g => (
            <tr key={g.id}>
              <td>{new Date(g.date).toLocaleString()}</td>
              <td>{g.opponent}</td>
              <td>{g.home ? 'Home' : 'Away'}</td>
              <td>{g.status}</td>
              <td>{g.double_points ? '2x' : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

