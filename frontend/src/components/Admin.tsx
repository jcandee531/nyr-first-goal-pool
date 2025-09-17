import { useEffect, useState } from 'react';
import { api } from '@api/client';

export default function Admin() {
  const [health, setHealth] = useState<{ ok: boolean; dbMode: 'turso'|'sqlite' }|null>(null);
  const [url, setUrl] = useState('');
  const [token, setToken] = useState('');
  const [adminKey, setAdminKey] = useState('');
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => { (async () => { try { setHealth(await api.adminHealth()); } catch {} })(); }, []);

  const test = async () => {
    setTestResult('');
    try {
      const r = await api.adminTestTurso(url, token, adminKey || undefined);
      setTestResult(r.ok ? 'OK' : 'Failed');
    } catch (e:any) {
      setTestResult(e.message);
    }
  };

  return (
    <div>
      <h2>Admin</h2>
      <div style={{ marginBottom: 12 }}>
        <strong>DB Mode:</strong> {health?.dbMode || 'unknown'} {health?.ok ? '✅' : '❌'}
      </div>
      <div style={{ display:'grid', gap:8, maxWidth: 600, margin:'0 auto' }}>
        <input placeholder="TURSO_URL" value={url} onChange={e=>setUrl(e.target.value)} />
        <input placeholder="TURSO_AUTH_TOKEN" value={token} onChange={e=>setToken(e.target.value)} />
        <input placeholder="ADMIN_KEY (optional)" value={adminKey} onChange={e=>setAdminKey(e.target.value)} />
        <button onClick={test}>Test Turso Connection</button>
        {testResult && <div>Result: {testResult}</div>}
      </div>
    </div>
  );
}

