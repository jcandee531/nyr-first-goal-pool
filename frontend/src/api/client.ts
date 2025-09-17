export type Participant = { id: number; name: string };
export type Game = { id: number; date: string; opponent: string; home: number; status: string; season: string; double_points?: number };
export type Pick = { id: number; game_id: number; participant_id: number; player_id: number; player_name: string };
export type Standing = { id: number; name: string; points: number };
export type RosterPlayer = { id: number; name: string; position: string };

const API_BASE = (import.meta as any).env?.VITE_API_BASE ? String((import.meta as any).env.VITE_API_BASE).replace(/\/$/, '') : '';
const url = (path: string) => `${API_BASE}${path}`;

async function http<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, { headers: { 'Content-Type': 'application/json' }, ...init });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  listParticipants: (): Promise<Participant[]> => http(url('/api/participants')),
  addParticipant: (name: string): Promise<Participant> => http(url('/api/participants'), { method: 'POST', body: JSON.stringify({ name }) }),

  importSeason: (season: string): Promise<{ imported: number }> => http(url('/api/games/import'), { method: 'POST', body: JSON.stringify({ season }) }),
  listGames: (): Promise<Game[]> => http(url('/api/games')),
  getUpcomingGame: (): Promise<Game | null> => http(url('/api/games/upcoming')),
  getDraftOrder: (gameId: number): Promise<number[]> => http(url(`/api/games/${gameId}/draft-order`)),
  getRoster: (gameId: number): Promise<RosterPlayer[]> => http(url(`/api/games/${gameId}/roster`)),

  listPicks: (gameId: number): Promise<Pick[]> => http(url(`/api/picks?gameId=${gameId}`)),
  createPick: (gameId: number, participantId: number, playerId: number, playerName: string): Promise<{ id: number }> =>
    http(url('/api/picks'), { method: 'POST', body: JSON.stringify({ gameId, participantId, playerId, playerName }) }),

  computeGame: (gameId: number): Promise<{ ok: boolean }> => http(url(`/api/games/${gameId}/compute`), { method: 'POST' }),
  standings: (): Promise<Standing[]> => http(url('/api/standings')),
  adminHealth: (): Promise<{ ok: boolean; dbMode: 'turso' | 'sqlite' }> => http(url('/api/admin/health')),
  adminTestTurso: (u: string, t: string, adminKey?: string): Promise<{ ok: boolean }> =>
    http(url('/api/admin/test-turso'), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(adminKey ? { 'x-admin-key': adminKey } : {}) }, body: JSON.stringify({ url: u, token: t }) }),
};

