import { useEffect, useMemo, useState } from 'react';
import { api, type Game } from '@api/client';

export default function Schedule() {
  const [season, setSeason] = useState('20252026');
  const [games, setGames] = useState<Game[]>([]);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setGames(await api.listGames());
    } catch (e:any) {
      setError(e.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const importSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setImporting(true);
    try {
      await api.importSeason(season.trim());
      await refresh();
    } catch (e:any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  };

  const grouped = useMemo(() => {
    const bySeason: Record<string, Game[]> = {};
    for (const g of games) {
      if (!bySeason[g.season]) bySeason[g.season] = [];
      bySeason[g.season].push(g);
    }
    for (const s of Object.keys(bySeason)) {
      bySeason[s].sort((a,b)=>a.date.localeCompare(b.date));
    }
    return bySeason;
  }, [games]);

  return (
    <div>
      <h2>Schedule</h2>
      <form onSubmit={importSeason} style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:12 }}>
        <input value={season} onChange={e=>setSeason(e.target.value)} placeholder="Season (e.g., 20252026)" />
        <button type="submit" disabled={importing || !/^\d{8}$/.test(season)}>{importing ? 'Importing...' : 'Import Season'}</button>
        <button type="button" onClick={refresh}>Refresh</button>
      </form>
      {error && <div style={{ color:'red', marginBottom:8 }}>{error}</div>}
      {Object.keys(grouped).length === 0 && <div>No games found. Import a season.</div>}
      {Object.entries(grouped).sort((a,b)=>a[0].localeCompare(b[0])).map(([s, arr]) => (
        <div key={s} style={{ marginBottom:16 }}>
          <h3>Season {s}</h3>
          <table style={{ width:'100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign:'left' }}>Date</th>
                <th style={{ textAlign:'left' }}>Opponent</th>
                <th style={{ textAlign:'left' }}>Home/Away</th>
                <th style={{ textAlign:'left' }}>Status</th>
                <th style={{ textAlign:'left' }}>Double</th>
              </tr>
            </thead>
            <tbody>
              {arr.map(g => (
                <tr key={g.id}>
                  <td>{new Date(g.date).toLocaleString()}</td>
                  <td>{g.opponent}</td>
                  <td>{g.home ? 'Home' : 'Away'}</td>
                  <td>{g.status}</td>
                  <td>{g.double_points ? 'Yes' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

