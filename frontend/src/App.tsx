import './App.css'
import Participants from '@components/Participants'
import Picks from '@components/Picks'
import Standings from '@components/Standings'
import Dashboard from '@components/Dashboard'
import Admin from '@components/Admin'
import Schedule from '@components/Schedule'
import { useState } from 'react'

type Tab = 'dashboard' | 'schedule' | 'picks' | 'participants' | 'standings' | 'admin'

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard')
  return (
    <div className="content" style={{ maxWidth: 900, margin: '0 auto', padding: 16, textAlign: 'center' }}>
      <div className="site-header">
        <h1>NY Rangers First Goal Pool</h1>
        <img
          className="rangers-logo"
          alt="New York Rangers"
          referrerPolicy="no-referrer"
          src="https://upload.wikimedia.org/wikipedia/en/1/10/New_York_Rangers_logo.svg"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/rangers.svg' }}
        />
      </div>
      <nav className="tab-nav">
        <button className={tab==='dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>Dashboard</button>
        <button className={tab==='schedule' ? 'active' : ''} onClick={() => setTab('schedule')}>Schedule</button>
        <button className={tab==='picks' ? 'active' : ''} onClick={() => setTab('picks')}>Picks</button>
        <button className={tab==='participants' ? 'active' : ''} onClick={() => setTab('participants')}>Participants</button>
        <button className={tab==='standings' ? 'active' : ''} onClick={() => setTab('standings')}>Standings</button>
        <button className={tab==='admin' ? 'active' : ''} onClick={() => setTab('admin')}>Admin</button>
      </nav>
      {tab === 'dashboard' && <Dashboard />}
      {tab === 'schedule' && <Schedule />}
      {tab === 'picks' && <Picks />}
      {tab === 'participants' && <Participants />}
      {tab === 'standings' && <Standings />}
      {tab === 'admin' && <Admin />}
    </div>
  )
}
