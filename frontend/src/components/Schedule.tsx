import { useEffect, useMemo, useState } from 'react';
import { api, type Game } from '@api/client';

export default function Schedule() {
  const [season, setSeason] = useState('20242025');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
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
      <form onSubmit={importSeason} style={{ display:'flex', gap:8, marginBottom:12 }}>
        <input value={season} onChange={e=>setSeason(e.target.value)} placeholder="Season (e.g., 20242025)" />
        <button type="submit" disabled={loading}>{loading ? 'Importing...' : 'Import'}</button>
      </form>
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

