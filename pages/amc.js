import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const SITE_TYPE_CONFIG = {
  residential : { label: 'Residential',  color: '#2E90FA', bg: '#EFF8FF', border: '#B2DDFF' },
  commercial  : { label: 'Commercial',   color: '#F79009', bg: '#FFFAEB', border: '#FEF0C7' },
  industrial  : { label: 'Industrial',   color: '#7F56D9', bg: '#F4F3FF', border: '#D9D6FE' },
}

const FREQ_LABELS = {
  monthly     : 'Monthly',
  quarterly   : 'Quarterly',
  half_yearly : 'Half Yearly',
  yearly      : 'Yearly',
}

const EMPTY_SITE = {
  client_name: '', address: '', city: '', site_type: 'residential',
  system_size_kw: '', installation_date: '',
  contact_name: '', contact_phone: '', notes: '',
}

export default function AMC() {
  const [sites,     setSites]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState(EMPTY_SITE)
  const [saving,    setSaving]    = useState(false)
  const [alert,     setAlert]     = useState(null)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('all')

  const load = () => {
    setLoading(true)
    fetch('/api/amc/sites')
      .then(r => r.json())
      .then(d => { setSites(Array.isArray(d) ? d : []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const onChange = e => {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  const onSubmit = async () => {
    if (!form.client_name || !form.address || !form.site_type) {
      return setAlert({ type:'error', msg:'Client name, address and site type are required.' })
    }
    setSaving(true)
    const res  = await fetch('/api/amc/sites', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({
        ...form,
        system_size_kw: form.system_size_kw ? Number(form.system_size_kw) : null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg: `${data.client_name} added successfully.` })
    setForm(EMPTY_SITE)
    setShowForm(false)
    load()
  }

  // Stats
  const totalSites    = sites.length
  const activeSites   = sites.filter(s => s.active_contract).length
  const expiringSoon  = sites.filter(s => s.is_expiring_soon).length
  const upcomingToday = sites.filter(s =>
    s.next_visit?.scheduled_date === new Date().toISOString().split('T')[0]
  ).length

  const filtered = sites.filter(s => {
    const matchSearch = !search ||
      s.client_name.toLowerCase().includes(search.toLowerCase()) ||
      s.city?.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all'      ? true :
      filter === 'active'   ? !!s.active_contract :
      filter === 'expiring' ? s.is_expiring_soon :
      filter === s.site_type
    return matchSearch && matchFilter
  })

  const fmt = n => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—'

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">O&M / AMC</h1>
          <p className="page-sub">Site management and maintenance tracking</p>
        </div>
        <div className="flex gap-8 items-center">
          <input
            placeholder="Search client, city..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 220 }}
          />
          <select value={filter} onChange={e => setFilter(e.target.value)} style={{ width: 140 }}>
            <option value="all">All Sites</option>
            <option value="active">Active AMC</option>
            <option value="expiring">Expiring Soon</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="industrial">Industrial</option>
          </select>
          <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setAlert(null) }}>
            {showForm ? 'Cancel' : '+ Add Site'}
          </button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="card stat-card stat-accent">
          <div className="stat-label">Total Sites</div>
          <div className="stat-value">{totalSites}</div>
          <div className="stat-hint">All registered</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Active AMC</div>
          <div className="stat-value">{activeSites}</div>
          <div className="stat-hint">Under contract</div>
        </div>
        <div className="card stat-card" style={{
          borderTop: expiringSoon > 0 ? '3px solid #F79009' : ''
        }}>
          <div className="stat-label">Expiring Soon</div>
          <div className="stat-value" style={{
            color: expiringSoon > 0 ? '#F79009' : 'var(--text-primary)'
          }}>
            {expiringSoon}
          </div>
          <div className="stat-hint">Within 30 days</div>
        </div>
        <div className="card stat-card">
          <div className="stat-label">Today's Visits</div>
          <div className="stat-value">{upcomingToday}</div>
          <div className="stat-hint">Scheduled today</div>
        </div>
      </div>

      {/* Add Site Form */}
      {showForm && (
        <div className="card card-pad" style={{ marginBottom: 20 }}>
          <div className="card-title" style={{ marginBottom: 20 }}>Add New Site</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Client Name *</label>
              <input name="client_name" placeholder="e.g. Sharma Residence"
                value={form.client_name} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Site Type *</label>
              <select name="site_type" value={form.site_type} onChange={onChange}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
            <div className="form-group full">
              <label>Address *</label>
              <input name="address" placeholder="Full address"
                value={form.address} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input name="city" placeholder="e.g. Navi Mumbai"
                value={form.city} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>System Size (kW)</label>
              <input name="system_size_kw" type="number" placeholder="e.g. 10"
                value={form.system_size_kw} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Installation Date</label>
              <input name="installation_date" type="date"
                value={form.installation_date} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input name="contact_name" placeholder="e.g. Rahul Sharma"
                value={form.contact_name} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Contact Phone</label>
              <input name="contact_phone" placeholder="9876543210"
                value={form.contact_phone} onChange={onChange} />
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <input name="notes" placeholder="Any additional notes"
                value={form.notes} onChange={onChange} />
            </div>
          </div>
          <div className="divider" />
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={onSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Site'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Sites Table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Sites — {filtered.length} shown</span>
        </div>
        <div className="table-wrap">
          {loading ? (
            <div className="empty-state"><p>Loading...</p></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <strong>No sites found</strong>
              <p>Add your first site using the "+ Add Site" button.</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Location</th>
                  <th>Size</th>
                  <th>AMC Status</th>
                  <th>Next Visit</th>
                  <th>Frequency</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(site => {
                  const tc  = SITE_TYPE_CONFIG[site.site_type] || SITE_TYPE_CONFIG.residential
                  const exp = site.active_contract
                    ? new Date(site.active_contract.end_date)
                    : null
                  const daysLeft = exp
                    ? Math.ceil((exp - new Date()) / (1000*60*60*24))
                    : null

                  return (
                    <tr key={site.id}>
                      <td>
                        <div style={{ fontWeight:500 }}>{site.client_name}</div>
                        {site.contact_phone && (
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {site.contact_phone}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{
                          background: tc.bg, color: tc.color,
                          border: `1px solid ${tc.border}`
                        }}>
                          {tc.label}
                        </span>
                      </td>
                      <td style={{ color:'var(--text-secondary)' }}>
                        {site.city || site.address.split(',').slice(-1)[0]?.trim()}
                      </td>
                      <td className="mono">
                        {site.system_size_kw ? `${site.system_size_kw} kW` : '—'}
                      </td>
                      <td>
                        {site.active_contract ? (
                          <div>
                            <span className={`badge ${
                              site.is_expiring_soon ? 'badge-orange' : 'badge-green'
                            }`}>
                              {site.is_expiring_soon ? '⚠ Expiring' : 'Active'}
                            </span>
                            {daysLeft !== null && (
                              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                                {daysLeft > 0 ? `${daysLeft} days left` : 'Expired'}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="badge badge-gray">No AMC</span>
                        )}
                      </td>
                      <td className="mono" style={{ fontSize:12 }}>
                        {site.next_visit
                          ? new Date(site.next_visit.scheduled_date)
                              .toLocaleDateString('en-IN', {
                                day:'2-digit', month:'short', year:'numeric'
                              })
                          : '—'}
                      </td>
                      <td>
                        {site.active_contract
                          ? FREQ_LABELS[site.active_contract.visit_frequency]
                          : '—'}
                      </td>
                      <td>
                        <Link
                          href={`/amc/${site.id}`}
                          style={{ fontSize:12, fontWeight:600,
                            color:'var(--accent)', textDecoration:'none' }}
                        >
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
