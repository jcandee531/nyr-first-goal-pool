import { useEffect, useState } from 'react';
import { api, Standing } from '@api/client';

export default function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const refresh = async () => setRows(await api.standings());
  useEffect(() => { refresh(); }, []);
  return (
    <div>
      <h2>Standings</h2>
      <table>
        <thead>
          <tr>
            <th>Participant</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.name}</td>
              <td>{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={refresh} style={{ marginTop: 8 }}>Refresh</button>
    </div>
  );
}

