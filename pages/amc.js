import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const SITE_TYPE_CONFIG = {
  residential : { label:'Residential', color:'#2E90FA', bg:'#EFF8FF', border:'#B2DDFF' },
  commercial  : { label:'Commercial',  color:'#F79009', bg:'#FFFAEB', border:'#FEF0C7' },
  industrial  : { label:'Industrial',  color:'#7F56D9', bg:'#F4F3FF', border:'#D9D6FE' },
}

const ALERT_CONFIG = {
  error  : { bg:'#FEF3F2', border:'#FECDCA', color:'#B42318', dot:'#F04438' },
  warning: { bg:'#FFFAEB', border:'#FEF0C7', color:'#B54708', dot:'#F79009' },
  info   : { bg:'#EFF8FF', border:'#B2DDFF', color:'#1849A9', dot:'#2E90FA' },
  success: { bg:'#ECFDF3', border:'#A9EFC5', color:'#027A48', dot:'#12B76A' },
}

const DAYS = Array.from({length:28}, (_,i) => i+1)

const EMPTY_SITE = {
  client_name:'', site_type:'commercial', address:'Navi Mumbai',
  city:'', system_size_kw:'', amc_valid_upto:'',
  contact_name:'', contact_phone:'',
  assigned_to_emp_code:'', assigned_to_name:'',
  service_day_1:'', service_day_2:'', notes:'',
}

export default function AMC() {
  const [sites,      setSites]      = useState([])
  const [employees,  setEmployees]  = useState([])
  const [alerts,     setAlerts]     = useState([])
  const [alertCounts,setAlertCounts]= useState({})
  const [loading,    setLoading]    = useState(true)
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState(EMPTY_SITE)
  const [saving,     setSaving]     = useState(false)
  const [alert,      setAlert]      = useState(null)
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('all')
  const [showAlerts, setShowAlerts] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/amc/sites').then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Sites failed') })),
      fetch('/api/amc/alerts').then(r => r.ok ? r.json() : r.json().then(d => { throw new Error(d.error || 'Alerts failed') })),
      fetch('/api/employees').then(r => r.ok ? r.json() : []),  // returns [] silently if tech (403)
    ]).then(([sitesData, alertsData, empsData]) => {
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setAlerts(alertsData?.alerts || [])
      setAlertCounts(alertsData?.counts || {})
      setEmployees(Array.isArray(empsData) ? empsData : [])
      setLoading(false)
    }).catch(err => {
      console.error('AMC Load Error:', err)
      setLoading(false)
      setAlert({ type:'error', msg:'Failed to load data. Please refresh.' })
    })
  }

  useEffect(() => { load() }, [])

  const onChange = e => {
    const { name, value } = e.target
    // Auto-fill assigned_to_name when emp selected
    if (name === 'assigned_to_emp_code') {
      const emp = employees.find(e => e.emp_code === value || e.id === value)
      setForm(f => ({
        ...f,
        assigned_to_emp_code: emp?.emp_code || value,
        assigned_to_name    : emp?.name     || '',
      }))
    } else {
      setForm(f => ({ ...f, [name]: value }))
    }
  }

  const onSubmit = async () => {
    if (!form.client_name) return setAlert({ type:'error', msg:'Site name is required' })

    // Contact name — alphabetical only (letters, spaces, dots, hyphens)
    if (form.contact_name && !/^[A-Za-z\s.\-']+$/.test(form.contact_name.trim())) {
      return setAlert({ type:'error', msg:'Contact name should contain letters only — no numbers or special characters.' })
    }

    // Contact phone — must start with 91 and be exactly 12 digits
    if (form.contact_phone) {
      const phone = form.contact_phone.replace(/\s/g, '')
      if (!/^\d+$/.test(phone)) {
        return setAlert({ type:'error', msg:'Contact phone must contain numbers only.' })
      }
      if (!phone.startsWith('91')) {
        return setAlert({ type:'error', msg:'Contact phone must start with 91 (e.g. 919876543210).' })
      }
      if (phone.length !== 12) {
        return setAlert({ type:'error', msg:'Contact phone must be 12 digits starting with 91 (91 + 10-digit number).' })
      }
    }
    setSaving(true)
    const res = await fetch('/api/amc/sites', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...form,
        system_size_kw: form.system_size_kw ? Number(form.system_size_kw) : null,
        service_day_1 : form.service_day_1  ? Number(form.service_day_1)  : null,
        service_day_2 : form.service_day_2  ? Number(form.service_day_2)  : null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`${data.client_name} added successfully.` })
    setForm(EMPTY_SITE)
    setShowForm(false)
    load()
  }

  // Stats
  const totalKw      = sites.reduce((s,x) => s + (Number(x.system_size_kw)||0), 0)
  const expiredCount = sites.filter(s => s.is_expired).length
  const expiringCount= sites.filter(s => s.is_expiring_soon).length
  const activeCount  = sites.filter(s => !s.is_expired && s.amc_valid_upto).length

  const filtered = sites.filter(s => {
    const matchSearch = !search ||
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.assigned_to_name||'').toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'expired'  ? s.is_expired :
      filter === 'expiring' ? s.is_expiring_soon :
      filter === 'active'   ? (!s.is_expired && s.amc_valid_upto) :
      filter === 'no_date'  ? !s.amc_valid_upto :
      s.assigned_to_name?.toUpperCase() === filter.toUpperCase()
    return matchSearch && matchFilter
  })

  const fmt = (dateStr) => dateStr
    ? new Date(dateStr).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
    : '—'

  const techNames = [...new Set(sites.map(s => s.assigned_to_name).filter(Boolean))]

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">O&M / AMC</h1>
          <p className="page-sub">Site management and AMC renewal tracking — {sites.length} sites · {totalKw.toLocaleString('en-IN')} kW total</p>
        </div>
        <div className="flex gap-8 items-center">
          <input placeholder="Search site or technician..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width:220 }} />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width:160 }}>
            <option value="all">All Sites</option>
            <option value="expired">⛔ Expired</option>
            <option value="expiring">⚠ Expiring Soon</option>
            <option value="active">✅ Active</option>
            <option value="no_date">No Date</option>
            {techNames.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <a href="/inventory" style={{
            padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)',
            background:'#fff', color:'var(--text-secondary)', fontSize:13,
            fontWeight:600, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6
          }}>
            📍 Manage Sites
          </a>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* ── ALERTS BANNER ── */}
      {alertCounts.total > 0 && (
        <div className="card" style={{ marginBottom:16, overflow:'hidden' }}>
          <div
            onClick={() => setShowAlerts(s => !s)}
            style={{
              display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 20px', cursor:'pointer',
              background: alertCounts.expired > 0 ? '#FEF3F2' : '#FFFAEB',
              borderBottom: showAlerts ? '1px solid var(--border-light)' : 'none',
            }}
          >
            <div className="flex items-center gap-8">
              <span style={{ fontSize:16 }}>
                {alertCounts.expired > 0 ? '🚨' : '⚠️'}
              </span>
              <span style={{ fontWeight:600, fontSize:13.5,
                color: alertCounts.expired > 0 ? '#B42318' : '#B54708' }}>
                {alertCounts.total} Alert{alertCounts.total !== 1 ? 's' : ''} require attention
              </span>
              <div className="flex gap-8" style={{ fontSize:12 }}>
                {alertCounts.expired > 0 && (
                  <span style={{ background:'#FEF3F2', color:'#B42318',
                    border:'1px solid #FECDCA', padding:'1px 8px', borderRadius:20,
                    fontWeight:600 }}>
                    {alertCounts.expired} Expired
                  </span>
                )}
                {alertCounts.expiring > 0 && (
                  <span style={{ background:'#FFFAEB', color:'#B54708',
                    border:'1px solid #FEF0C7', padding:'1px 8px', borderRadius:20,
                    fontWeight:600 }}>
                    {alertCounts.expiring} Expiring
                  </span>
                )}
                {alertCounts.overdue_visits > 0 && (
                  <span style={{ background:'#EFF8FF', color:'#1849A9',
                    border:'1px solid #B2DDFF', padding:'1px 8px', borderRadius:20,
                    fontWeight:600 }}>
                    {alertCounts.overdue_visits} Overdue Visits
                  </span>
                )}
                {alertCounts.today_visits > 0 && (
                  <span style={{ background:'#ECFDF3', color:'#027A48',
                    border:'1px solid #A9EFC5', padding:'1px 8px', borderRadius:20,
                    fontWeight:600 }}>
                    {alertCounts.today_visits} Today
                  </span>
                )}
              </div>
            </div>
            <span style={{ color:'var(--text-muted)', fontSize:12 }}>
              {showAlerts ? '▲ Hide' : '▼ Show'}
            </span>
          </div>

          {showAlerts && (
            <div style={{ padding:'12px 20px', display:'flex', flexDirection:'column', gap:8,
              maxHeight:300, overflowY:'auto' }}>
              {alerts.map((a, i) => {
                const ac = ALERT_CONFIG[a.severity]
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'10px 14px',
                    background:ac.bg, border:`1px solid ${ac.border}`,
                    borderRadius:8,
                  }}>
                    <div style={{ width:8, height:8, borderRadius:'50%',
                      background:ac.dot, flexShrink:0 }} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:ac.color }}>
                        {a.title}
                      </div>
                      <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:1 }}>
                        {a.message} · {a.meta}
                      </div>
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-muted)',
                      fontFamily:'DM Mono, monospace', flexShrink:0 }}>
                      {fmt(a.date)}
                    </div>
                    {a.site_id && (
                      <Link href={`/amc/${a.site_id}`} style={{
                        fontSize:11, fontWeight:600, color:ac.color,
                        textDecoration:'none', flexShrink:0,
                        padding:'2px 8px', background:'rgba(255,255,255,0.6)',
                        borderRadius:6, border:`1px solid ${ac.border}`,
                      }}>
                        View →
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(5,1fr)', marginBottom:20 }}>
        {[
          { label:'Total Sites',   value:sites.length,   color:'var(--accent)',   hint:'All registered' },
          { label:'Active AMC',    value:activeCount,    color:'#12B76A',         hint:'Valid contracts' },
          { label:'Expiring Soon', value:expiringCount,  color:'#F79009',         hint:'Within 30 days' },
          { label:'Expired',       value:expiredCount,   color:'#F04438',         hint:'Need renewal' },
          { label:'Total Capacity',value:`${totalKw.toLocaleString('en-IN')} kW`, color:'#2E90FA', hint:'All sites' },
        ].map(s => (
          <div key={s.label} className="card stat-card"
            style={{ borderTop:`3px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize:20, color:s.color }}>{s.value}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* ── INFO BANNER: Sites managed from Inventory ── */}
      <div style={{ background:'#EFF8FF', border:'1px solid #B2DDFF', borderRadius:10,
        padding:'12px 18px', marginBottom:20, fontSize:13, color:'#1849A9',
        display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:18 }}>📍</span>
        <div>
          <strong>Sites are managed from Inventory.</strong>
          {' '}Create or update sites in the{' '}
          <a href="/inventory" style={{ color:'var(--accent)', fontWeight:600 }}>Inventory module</a>
          {' '}→ Sites tab. Once created, they appear here automatically for AMC configuration.
        </div>
      </div>

      {/* ── SITES TABLE ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {filter === 'all' ? 'All Sites' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            {' '}— {filtered.length} shown
          </span>
          <span style={{ fontSize:12, color:'var(--text-muted)' }}>
            Click a site to view visits, set service dates, and update checklist
          </span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><p>Loading sites...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <strong>No sites found</strong>
              <p>Add your first site or adjust the filter.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>AMC Valid Upto</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Service Days</th>
                  <th>Next Visit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(site => {
                  const tc = SITE_TYPE_CONFIG[site.site_type] || SITE_TYPE_CONFIG.commercial

                  const statusBadge = site.is_expired
                    ? { label:'Expired',       bg:'#FEF3F2', color:'#B42318', border:'#FECDCA' }
                    : site.is_expiring_soon
                      ? { label:'Expiring Soon', bg:'#FFFAEB', color:'#B54708', border:'#FEF0C7' }
                      : site.amc_valid_upto
                        ? { label:'Active',        bg:'#ECFDF3', color:'#027A48', border:'#A9EFC5' }
                        : { label:'No Date',       bg:'var(--surface-2)', color:'var(--text-muted)', border:'var(--border)' }

                  const daysText = site.is_expired
                    ? `${Math.abs(site.days_left)} days ago`
                    : site.days_left !== null
                      ? `${site.days_left} days left`
                      : null

                  const serviceInfo = [site.service_day_1, site.service_day_2]
                    .filter(Boolean)
                    .map(d => `${d}th`)
                    .join(' & ')

                  return (
                    <tr key={site.id}>
                      <td>
                        <div style={{ fontWeight:600, fontSize:13.5 }}>{site.client_name}</div>
                        {site.notes && (
                          <div style={{ fontSize:11, color:'#F04438', marginTop:1 }}>{site.notes}</div>
                        )}
                      </td>
                      <td>
                        <span style={{
                          background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`,
                          padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
                        }}>
                          {tc.label}
                        </span>
                      </td>
                      <td className="mono">
                        {site.system_size_kw ? `${site.system_size_kw} kW` : '—'}
                      </td>
                      <td className="mono" style={{ fontSize:12 }}>
                        {fmt(site.amc_valid_upto)}
                      </td>
                      <td>
                        <span style={{
                          background:statusBadge.bg, color:statusBadge.color,
                          border:`1px solid ${statusBadge.border}`,
                          padding:'2px 8px', borderRadius:20,
                          fontSize:11, fontWeight:600, display:'block', marginBottom:2,
                        }}>
                          {statusBadge.label}
                        </span>
                        {daysText && (
                          <span style={{ fontSize:10, color:'var(--text-muted)' }}>
                            {daysText}
                          </span>
                        )}
                      </td>
                      <td style={{ fontSize:13 }}>
                        {site.assigned_to_name || '—'}
                      </td>
                      <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                        {serviceInfo || <span style={{ color:'var(--text-muted)' }}>Not set</span>}
                      </td>
                      <td style={{ fontSize:12 }}>
                        {site.next_visit
                          ? <span style={{ color:'#2E90FA' }}>
                              {fmt(site.next_visit.scheduled_date)}
                            </span>
                          : site.has_overdue
                            ? <span style={{ color:'#F04438', fontWeight:600 }}>Overdue!</span>
                            : <span style={{ color:'var(--text-muted)' }}>—</span>
                        }
                      </td>
                      <td>
                        <Link href={`/amc/${site.id}`}
                          style={{ fontSize:12, fontWeight:600,
                            color:'var(--accent)', textDecoration:'none' }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
