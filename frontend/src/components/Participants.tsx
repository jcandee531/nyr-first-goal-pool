import { useEffect, useState } from 'react';
import { api, type Participant } from '@api/client';

export default function Participants() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try { setParticipants(await api.listParticipants()); } catch (e:any) { setError(e.message); }
  };

  useEffect(() => { refresh(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    try {
      await api.addParticipant(name.trim());
      setName('');
      await refresh();
    } catch (e:any) {
      setError(e.message);
    }
  };

  return (
    <div>
      <h2>Participants</h2>
      <form onSubmit={add} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Name" />
        <button type="submit">Add</button>
      </form>
      {error && <div style={{ color: 'red' }}>{error}</div>}
      <ul>
        {participants.map(p => (
          <li key={p.id}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
}

