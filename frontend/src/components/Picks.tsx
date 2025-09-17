import { useEffect, useMemo, useState } from 'react';
import { api, type Game, type Participant, type Pick, type RosterPlayer } from '@api/client';

export default function Picks() {
  const [upcoming, setUpcoming] = useState<Game | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [draftOrder, setDraftOrder] = useState<number[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  const refreshAll = async () => {
    setError(null);
    const g = await api.getUpcomingGame();
    setUpcoming(g);
    setParticipants(await api.listParticipants());
    if (g) {
      setDraftOrder(await api.getDraftOrder(g.id));
      try { setRoster(await api.getRoster(g.id)); } catch { setRoster([]); }
      setPicks(await api.listPicks(g.id));
    } else {
      setDraftOrder([]); setRoster([]); setPicks([]);
    }
  };

  useEffect(() => { refreshAll(); }, []);

  // Ticker for countdown UI
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const participantById = useMemo(() => Object.fromEntries(participants.map(p => [p.id, p])), [participants]);

  const submitPick = async (participantId: number, playerId: number, playerName: string) => {
    if (!upcoming) return;
    setError(null);
    try {
      await api.createPick(upcoming.id, participantId, playerId, playerName);
      setPicks(await api.listPicks(upcoming.id));
    } catch (e:any) {
      setError(e.message);
    }
  };

  const refreshRoster = async () => {
    if (!upcoming) return;
    setRosterLoading(true);
    try {
      const r = await api.getRoster(upcoming.id);
      setRoster(r);
    } catch (e:any) {
      setError(e.message);
    } finally {
      setRosterLoading(false);
    }
  };

  // Auto-refresh roster starting 1 hour before puck drop, until puck drop
  useEffect(() => {
    if (!upcoming) return;
    const startTimeMs = new Date(upcoming.date).getTime();
    const now = Date.now();
    const windowStart = startTimeMs - 60 * 60 * 1000; // 1 hour prior
    const delayToStart = Math.max(0, windowStart - now);
    const delayToStop = Math.max(0, startTimeMs - now);

    let startTimer: number | undefined;
    let stopTimer: number | undefined;
    let pollId: number | undefined;

    const begin = async () => {
      await refreshRoster();
      pollId = window.setInterval(refreshRoster, 2 * 60 * 1000); // every 2 minutes
    };

    if (delayToStart === 0) begin(); else startTimer = window.setTimeout(begin, delayToStart);
    // Stop polling a few seconds after scheduled start time
    stopTimer = window.setTimeout(() => { if (pollId) window.clearInterval(pollId); }, delayToStop + 5000);

    return () => {
      if (startTimer) window.clearTimeout(startTimer);
      if (stopTimer) window.clearTimeout(stopTimer);
      if (pollId) window.clearInterval(pollId);
    };
  }, [upcoming?.id, upcoming?.date]);

  return (
    <div>
      <h2>Upcoming Game</h2>
      {!upcoming && <div>No upcoming game scheduled. Import schedule first.</div>}
      {upcoming && (
        <div style={{ marginBottom: 12 }}>
          <div>{new Date(upcoming.date).toLocaleString()} vs {upcoming.opponent} ({upcoming.home ? 'Home' : 'Away'}) {upcoming.double_points ? '— DOUBLE POINTS' : ''}</div>
          <Countdown dateIso={upcoming.date} nowMs={nowMs} />
          <button onClick={async ()=>{ if (upcoming) { try { await api.computeGame(upcoming.id); alert('Computed. Refresh standings.'); } catch(e:any){ alert(e.message); } } }}>
            Compute Results (admin)
          </button>
          <button style={{ marginLeft: 8 }} disabled={!upcoming || rosterLoading} onClick={refreshRoster}>
            {rosterLoading ? 'Refreshing roster...' : 'Refresh roster'}
          </button>
        </div>
      )}
      {error && <div style={{ color: 'red' }}>{error}</div>}
      {upcoming && (
        <div style={{ display:'grid', gap:16 }}>
          <div>
            <h3>Draft Order</h3>
            <ol>
              {draftOrder.map(id => (
                <li key={id}>{participantById[id]?.name ?? `Participant ${id}`}</li>
              ))}
            </ol>
          </div>
          <div>
            <h3>Make Picks</h3>
            <div style={{ marginBottom: 8, color:'#555' }}>Roster players: {roster.length}</div>
            {draftOrder.map(pid => (
              <ParticipantPickRow key={pid}
                participant={participantById[pid]}
                roster={roster}
                picks={picks.filter(p => p.participant_id === pid)}
                onPick={(playerId, playerName) => submitPick(pid, playerId, playerName)}
              />
            ))}
          </div>
          <div>
            <h3>Current Picks</h3>
            <ul>
              {picks.map(p => (
                <li key={p.id}>{participantById[p.participant_id]?.name}: {p.player_name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantPickRow({ participant, roster, picks, onPick }:{ participant: Participant, roster: RosterPlayer[], picks: Pick[], onPick: (playerId:number, playerName:string)=>void }) {
  const [selected, setSelected] = useState<number | ''>('');
  const picked = picks.length > 0;
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:8 }}>
      <strong style={{ width: 160 }}>{participant.name}</strong>
      <select disabled={picked} value={selected} onChange={e=>setSelected(Number(e.target.value))}>
        <option value="">Select player</option>
        {roster.map(r => (
          <option key={r.id} value={r.id}>{r.name} {r.position ? `(${r.position})` : ''}</option>
        ))}
      </select>
      <button disabled={picked || !selected} onClick={() => {
        const r = roster.find(r => r.id === selected);
        if (r) onPick(r.id, r.name);
      }}>Pick</button>
      {picked && <span>Locked: {picks[0].player_name}</span>}
    </div>
  );
}

function Countdown({ dateIso, nowMs }:{ dateIso: string; nowMs: number }) {
  const startMs = new Date(dateIso).getTime();
  const diff = startMs - nowMs;
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / (1000*60*60));
  const minutes = Math.floor((abs % (1000*60*60)) / (1000*60));
  const seconds = Math.floor((abs % (1000*60)) / 1000);
  const pad = (n:number) => n.toString().padStart(2,'0');
  const text = `${hours}:${pad(minutes)}:${pad(seconds)}`;
  return (
    <div style={{ margin: '6px 0', color: '#444' }}>
      {diff > 0 ? `Puck drop in ${text}` : `Game started ${text} ago`}
    </div>
  );
}

