import { useEffect, useMemo, useState } from 'react';
import { api, type Game } from '@api/client';

export default function Schedule() {
  const [games, setGames] = useState<Game[]>([]);
  const [onlyUpcoming, setOnlyUpcoming] = useState<boolean>(false);

  const refresh = async () => setGames(await api.listGames());
  useEffect(() => { refresh(); }, []);

  const rows = useMemo(() => {
    const data = [...games].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (!onlyUpcoming) return data;
    const now = Date.now();
    return data.filter(g => new Date(g.date).getTime() >= now);
  }, [games, onlyUpcoming]);

  return (
    <div>
      <h2>Schedule</h2>
      <div style={{ marginBottom: 8 }}>
        <label style={{ cursor:'pointer' }}>
          <input type="checkbox" checked={onlyUpcoming} onChange={e=>setOnlyUpcoming(e.target.checked)} />
          Show only upcoming
        </label>
        <button style={{ marginLeft: 8 }} onClick={refresh}>Refresh</button>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Opponent</th>
            <th>Venue</th>
            <th>Status</th>
            <th>Double</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(g => (
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

