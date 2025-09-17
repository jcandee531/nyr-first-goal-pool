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
      <div className="site-header">
        <h1>NY Rangers First Goal Pool</h1>
        <img className="rangers-logo" alt="New York Rangers" src="/rangers.svg" />
      </div>
      <nav className="tab-nav">
        <button className={tab==='dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button className={tab==='picks' ? 'active' : ''} onClick={() => setTab('picks')}>Picks</button>
        <button className={tab==='participants' ? 'active' : ''} onClick={() => setTab('participants')}>Participants</button>
        <button className={tab==='schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>Schedule</button>
        <button className={tab==='standings' ? 'active' : ''} onClick={() => setTab('standings')}>Standings</button>
      </nav>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'picks' && <Picks />}
      {tab === 'participants' && <Participants />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'standings' && <Standings />}
    </div>
  )
}
