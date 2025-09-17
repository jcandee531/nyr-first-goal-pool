import { useEffect, useMemo, useState } from 'react';
import { api, type Game } from '@api/client';

export default function Schedule() {
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try { setGames(await api.listGames()); } catch (e:any) { setError(e.message); }
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

