import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const nav = [
  {
    href: '/', label: 'Dashboard', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    href: '/employees', label: 'Employees', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
  {
    href: '/attendance', label: 'Attendance', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  },
  {
    href: '/payroll', label: 'Payroll', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    href: '/salary-statement', label: 'Salary Sheet', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    href: '/letters', label: 'Letters', hrOnly: true,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    href: '/amc', label: 'O&M / AMC', hrOnly: false,
    icon: <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
]

export default function Layout({ children }) {
  const router   = useRouter()
  const [role, setRole] = useState('hr')

  useEffect(() => {
    const r = document.cookie
      .split('; ')
      .find(c => c.startsWith('hrms_role='))
      ?.split('=')[1]
    if (r) setRole(r)
  }, [])

  const onLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  const visibleNav = nav.filter(item =>
    role === 'tech' ? !item.hrOnly : true
  )

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon-row">
            <img src="/logo.jpg" className="brand-icon" alt="Go Solar" style={{ objectFit: 'contain', background: 'var(--surface-2)' }} />
            <div>
              <div className="brand-name">Go Solar Solutions</div>
              <div className="brand-sub">Warrington Renewsol Pvt. Ltd</div>
            </div>
          </div>
        </div>

        <div className="nav-section">
          {visibleNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${
                item.href === '/'
                  ? router.pathname === '/' ? 'active' : ''
                  : router.pathname.startsWith(item.href) ? 'active' : ''
              }`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>

        <div className="sidebar-footer">
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>
            HRMS PHASE 2 · V2.0
          </div>
          <div style={{ fontSize:11, color:'var(--text-primary)', fontWeight:600 }}>
            Powered by <span style={{ color:'var(--accent)' }}>Softsync Solutions</span>
          </div>
          {role === 'tech' && (
            <div style={{
              fontSize:11, fontWeight:600,
              color:'var(--accent)', background:'var(--accent-light)',
              border:'1px solid #FED7AA', borderRadius:6,
              padding:'4px 8px', marginBottom:10, textAlign:'center',
            }}>
              🔧 Technician Access
            </div>
          )}
          <button
            onClick={onLogout}
            style={{
              display:'flex', alignItems:'center', gap:6,
              background:'none', border:'1.5px solid var(--border)',
              borderRadius:8, padding:'6px 12px',
              fontSize:12, fontWeight:600,
              color:'var(--text-secondary)',
              cursor:'pointer', width:'100%', transition:'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background='var(--bg)'; e.currentTarget.style.borderColor='#D0D5DD' }}
            onMouseLeave={e => { e.currentTarget.style.background='none';      e.currentTarget.style.borderColor='var(--border)' }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
