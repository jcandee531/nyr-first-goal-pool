import './App.css'
import Participants from '@components/Participants'
import Schedule from '@components/Schedule'
import Picks from '@components/Picks'
import Standings from '@components/Standings'
import Dashboard from '@components/Dashboard'
import { useState } from 'react'

type Tab = 'dashboard' | 'picks' | 'participants' | 'schedule' | 'standings'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>NY Rangers First Goal Pool</h1>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab('dashboard')} disabled={tab==='dashboard'}>Dashboard</button>
        <button onClick={() => setTab('picks')} disabled={tab==='picks'}>Picks</button>
        <button onClick={() => setTab('participants')} disabled={tab==='participants'}>Participants</button>
        <button onClick={() => setTab('schedule')} disabled={tab==='schedule'}>Schedule</button>
        <button onClick={() => setTab('standings')} disabled={tab==='standings'}>Standings</button>
      </nav>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'picks' && <Picks />}
      {tab === 'participants' && <Participants />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'standings' && <Standings />}
    </div>
  )
}
