import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Layout from '../../components/Layout'
import Link from 'next/link'

const CHECKLIST_ITEMS = {
  panel_cleaning     : 'Monthly Panel Cleaning',
  inverter_check     : 'Inverter Health Check',
  battery_voltage    : 'Battery Voltage Test',
  dc_wiring          : 'DC Wiring Inspection',
  ac_output          : 'AC Output Verification',
  performance_review : 'Performance Ratio Review',
  earthing_check     : 'Earthing & Bonding Check',
  thermographic_scan : 'Annual Thermographic Scan',
}

const VISIT_STATUS = {
  scheduled   : { label:'Scheduled',   color:'#2E90FA', bg:'#EFF8FF' },
  completed   : { label:'Completed',   color:'#12B76A', bg:'#ECFDF3' },
  missed      : { label:'Missed',      color:'#F04438', bg:'#FEF3F2' },
  rescheduled : { label:'Rescheduled', color:'#F79009', bg:'#FFFAEB' },
}

const DAYS = Array.from({length:28}, (_,i) => i+1)

export default function SiteDetail() {
  const router = useRouter()
  const { id } = router.query

  const [site,       setSite]       = useState(null)
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [alert,      setAlert]      = useState(null)
  const [activeTab,  setActiveTab]  = useState('visits')
  const [editVisit,  setEditVisit]  = useState(null)
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [editDetails,  setEditDetails] = useState(false)
  const [isHR,       setIsHR]       = useState(false)

  // Visit form
  const [visitForm, setVisitForm] = useState({
    scheduled_date:'', technician_id:'', remarks:''
  })

  // Site edit form
  const [editForm, setEditForm] = useState({})

  const load = () => {
    if (!id) return
    // Read role from cookie — HR can delete visits, tech cannot
    const role = document.cookie.split(';').find(c => c.trim().startsWith('hrms_role='))
    setIsHR((role || '').includes('hr'))
    Promise.all([
      fetch(`/api/amc/${id}`).then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]).then(([siteData, empsData]) => {
      setSite(siteData)
      setEditForm({
        client_name          : siteData.client_name,
        site_type            : siteData.site_type,
        system_size_kw       : siteData.system_size_kw || '',
        amc_valid_upto       : siteData.amc_valid_upto || '',
        contact_name         : siteData.contact_name   || '',
        contact_phone        : siteData.contact_phone  || '',
        assigned_to_emp_code : siteData.assigned_to_emp_code || '',
        assigned_to_name     : siteData.assigned_to_name     || '',
        service_day_1        : siteData.service_day_1  || '',
        service_day_2        : siteData.service_day_2  || '',
        notes                : siteData.notes          || '',
      })
      setEmployees(Array.isArray(empsData) ? empsData : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  const saveDetails = async () => {
    setSaving(true)
    const res = await fetch('/api/amc/sites', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        id,
        ...editForm,
        system_size_kw: editForm.system_size_kw ? Number(editForm.system_size_kw) : null,
        service_day_1 : editForm.service_day_1  ? Number(editForm.service_day_1)  : null,
        service_day_2 : editForm.service_day_2  ? Number(editForm.service_day_2)  : null,
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:'Site updated successfully.' })
    setEditDetails(false)
    load()
  }

  const addVisit = async () => {
    if (!visitForm.scheduled_date) return setAlert({ type:'error', msg:'Date required' })
    setSaving(true)
    const emp = employees.find(e => e.id === visitForm.technician_id)
    const res = await fetch('/api/amc/visits', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        site_id         : id,
        scheduled_date  : visitForm.scheduled_date,
        technician_id   : visitForm.technician_id   || null,
        technician_name : emp?.name                  || null,
        remarks         : visitForm.remarks          || null,
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:'Visit scheduled.' })
    setShowAddVisit(false)
    setVisitForm({ scheduled_date:'', technician_id:'', remarks:'' })
    load()
  }

  const updateVisit = async (visitId, updates) => {
    await fetch('/api/amc/visits', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: visitId, ...updates })
    })
    setEditVisit(null)
    load()
  }

  const markComplete = async (visit) => {
    await updateVisit(visit.id, {
      status        : 'completed',
      completed_date: new Date().toISOString().split('T')[0],
      checklist     : visit.checklist,
      remarks       : visit.remarks,
    })
    setAlert({ type:'success', msg:'Visit marked as completed ✓' })
  }

  const deleteVisit = async (visitId) => {
    if (!confirm('Delete this scheduled visit? This cannot be undone.')) return
    const res = await fetch(`/api/amc/visits?id=${visitId}`, { method:'DELETE' })
    if (res.ok) {
      setSite(prev => ({
        ...prev,
        amc_visits: prev.amc_visits.filter(v => v.id !== visitId)
      }))
      setAlert({ type:'success', msg:'Visit deleted.' })
    } else {
      setAlert({ type:'error', msg:'Failed to delete visit.' })
    }
  }

  const toggleChecklist = (visitId, key) => {
    setSite(prev => ({
      ...prev,
      amc_visits: prev.amc_visits.map(v =>
        v.id === visitId
          ? { ...v, checklist: { ...v.checklist, [key]: !v.checklist?.[key] } }
          : v
      )
    }))
  }

  const fmt = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
    : '—'

  if (loading) return <Layout><div className="empty-state"><p>Loading...</p></div></Layout>
  if (!site || site.error) return <Layout><div className="empty-state"><strong>Site not found</strong></div></Layout>

  const visits     = (site.amc_visits || []).sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
  const today      = new Date().toISOString().split('T')[0]
  const validUpto  = site.amc_valid_upto ? new Date(site.amc_valid_upto) : null
  const daysLeft   = validUpto ? Math.ceil((validUpto - new Date()) / (1000*60*60*24)) : null
  const isExpired  = daysLeft !== null && daysLeft < 0
  const isSoon     = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
  const tc         = { residential:{c:'#2E90FA',bg:'#EFF8FF'}, commercial:{c:'#F79009',bg:'#FFFAEB'}, industrial:{c:'#7F56D9',bg:'#F4F3FF'} }[site.site_type] || {}

  const serviceInfo = [site.service_day_1, site.service_day_2]
    .filter(Boolean).map(d => `${d}th`).join(' & ')

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13,
        color:'var(--text-muted)', marginBottom:20 }}>
        <Link href="/amc" style={{ color:'var(--text-muted)', textDecoration:'none' }}>O&M / AMC</Link>
        <span>/</span>
        <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{site.client_name}</span>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Header card */}
      <div className="card" style={{ marginBottom:20, padding:'20px 24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:'var(--text-primary)' }}>
                {site.client_name}
              </h2>
              <span style={{ background:tc.bg, color:tc.c, padding:'2px 8px',
                borderRadius:20, fontSize:11, fontWeight:600 }}>
                {site.site_type}
              </span>
              {isExpired && (
                <span style={{ background:'#FEF3F2', color:'#B42318',
                  border:'1px solid #FECDCA', padding:'2px 8px',
                  borderRadius:20, fontSize:11, fontWeight:600 }}>
                  ⛔ AMC Expired
                </span>
              )}
              {isSoon && !isExpired && (
                <span style={{ background:'#FFFAEB', color:'#B54708',
                  border:'1px solid #FEF0C7', padding:'2px 8px',
                  borderRadius:20, fontSize:11, fontWeight:600 }}>
                  ⚠ Expiring Soon
                </span>
              )}
            </div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              {site.address}{site.city ? `, ${site.city}` : ''}
              {site.contact_phone ? ` · ${site.contact_phone}` : ''}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            {site.system_size_kw && (
              <div style={{ fontSize:26, fontWeight:700, color:'var(--accent)',
                fontFamily:'DM Mono, monospace' }}>
                {site.system_size_kw} kW
              </div>
            )}
          </div>
        </div>

        {/* Info strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
          gap:12, marginTop:16, paddingTop:16,
          borderTop:'1px solid var(--border-light)' }}>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>AMC Valid Upto</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:3,
              color: isExpired ? '#F04438' : isSoon ? '#F79009' : 'var(--text-primary)' }}>
              {fmt(site.amc_valid_upto)}
              {daysLeft !== null && (
                <span style={{ fontSize:11, marginLeft:6,
                  color: isExpired ? '#F04438' : isSoon ? '#F79009' : '#12B76A' }}>
                  ({isExpired ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`})
                </span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Assigned To</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:3 }}>
              {site.assigned_to_name || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Service Days</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:3 }}>
              {serviceInfo || <span style={{ color:'var(--text-muted)', fontWeight:400 }}>Not set</span>}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Visits</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:3 }}>
              {visits.filter(v=>v.status==='completed').length} / {visits.length} done
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['visits','details'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding:'8px 18px', borderRadius:8,
            border:'1px solid var(--border)',
            background: activeTab === tab ? 'var(--accent)' : '#fff',
            color      : activeTab === tab ? '#fff' : 'var(--text-secondary)',
            fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.15s',
          }}>
            {tab === 'visits' ? `Visits (${visits.length})` : 'Site Details'}
          </button>
        ))}
      </div>

      {/* ── VISITS TAB ── */}
      {activeTab === 'visits' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Visit Schedule & History</span>
            <button className="btn btn-primary btn-sm"
              onClick={() => setShowAddVisit(s => !s)}>
              + Schedule Visit
            </button>
          </div>

          {showAddVisit && (
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-light)',
              background:'var(--surface-2)' }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Scheduled Date *</label>
                  <input type="date" value={visitForm.scheduled_date}
                    onChange={e => setVisitForm(f => ({ ...f, scheduled_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Assign Technician</label>
                  <select value={visitForm.technician_id}
                    onChange={e => setVisitForm(f => ({ ...f, technician_id: e.target.value }))}>
                    <option value="">Select employee...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.emp_code} — {e.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group full">
                  <label>Remarks</label>
                  <input placeholder="Optional notes"
                    value={visitForm.remarks}
                    onChange={e => setVisitForm(f => ({ ...f, remarks: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-8 mt-16">
                <button className="btn btn-primary btn-sm" onClick={addVisit} disabled={saving}>
                  {saving ? 'Saving...' : 'Schedule Visit'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowAddVisit(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            {visits.length === 0 ? (
              <div className="empty-state">
                <strong>No visits scheduled</strong>
                <p>Add a visit using the button above.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Scheduled Date</th>
                    <th>Status</th>
                    <th>Technician</th>
                    <th>Checklist</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(visit => {
                    const sc        = VISIT_STATUS[visit.status] || VISIT_STATUS.scheduled
                    const done      = Object.values(visit.checklist || {}).filter(Boolean).length
                    const total     = Object.keys(CHECKLIST_ITEMS).length
                    const isEditing = editVisit === visit.id
                    const isOverdue = visit.status === 'scheduled' && visit.scheduled_date < today

                    return (
                      <tr key={visit.id}
                        style={{ background: isOverdue ? '#FFFBF0' : '' }}>
                        <td style={{ fontFamily:'DM Mono,monospace', fontSize:12 }}>
                          {fmt(visit.scheduled_date)}
                          {isOverdue && (
                            <div style={{ fontSize:10, color:'#F04438', fontWeight:600 }}>
                              OVERDUE
                            </div>
                          )}
                          {visit.completed_date && visit.completed_date !== visit.scheduled_date && (
                            <div style={{ fontSize:10, color:'#12B76A' }}>
                              Done: {fmt(visit.completed_date)}
                            </div>
                          )}
                        </td>
                        <td>
                          <span style={{ background:sc.bg, color:sc.color,
                            padding:'2px 8px', borderRadius:20,
                            fontSize:11, fontWeight:600 }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ fontSize:13 }}>
                          {visit.employees?.name || visit.technician_name || '—'}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {Object.entries(CHECKLIST_ITEMS).map(([key, label]) => (
                                <label key={key} style={{ display:'flex',
                                  alignItems:'center', gap:6,
                                  fontSize:11, cursor:'pointer',
                                  textTransform:'none', letterSpacing:'normal',
                                  fontWeight:'normal', color:'var(--text-primary)' }}>
                                  <input type="checkbox"
                                    checked={!!visit.checklist?.[key]}
                                    onChange={() => toggleChecklist(visit.id, key)}
                                    style={{ accentColor:'var(--accent)', width:13, height:13 }}
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize:12,
                              color: done === total ? '#12B76A' : 'var(--text-primary)',
                              fontWeight: done === total ? 600 : 400 }}>
                              {done}/{total} items
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                          {isEditing ? (
                            <input value={visit.remarks || ''}
                              onChange={e => setSite(prev => ({
                                ...prev,
                                amc_visits: prev.amc_visits.map(v =>
                                  v.id === visit.id ? { ...v, remarks: e.target.value } : v
                                )
                              }))}
                              style={{ width:160 }}
                              placeholder="Remarks..." />
                          ) : (visit.remarks || '—')}
                        </td>
                        <td>
                          <div className="flex gap-8">
                            {visit.status === 'scheduled' && !isEditing && (
                              <>
                                {/* Technicians see Edit and Done */}
                                {!isHR && (
                                  <>
                                    <button className="btn btn-outline btn-sm"
                                      onClick={() => setEditVisit(visit.id)}
                                      style={{ fontSize:11 }}>
                                      ✏ Edit
                                    </button>
                                    <button className="btn btn-primary btn-sm"
                                      onClick={() => markComplete(visit)}
                                      style={{ fontSize:11 }}>
                                      ✓ Done
                                    </button>
                                  </>
                                )}

                                {/* HR sees only Delete for managing schedule/mistakes */}
                                {isHR && (
                                  <button className="btn btn-outline btn-sm"
                                    onClick={() => deleteVisit(visit.id)}
                                    style={{ fontSize:11, color:'#F04438',
                                      borderColor:'#F04438' }}>
                                    🗑 Delete
                                  </button>
                                )}
                              </>
                            )}

                            {isEditing && (
                              <>
                                <button className="btn btn-primary btn-sm"
                                  onClick={() => updateVisit(visit.id, {
                                    status          : visit.status,
                                    checklist       : visit.checklist,
                                    remarks         : visit.remarks,
                                    technician_id   : visit.technician_id,
                                    technician_name : visit.technician_name,
                                  })}
                                  style={{ fontSize:11 }}>
                                  Save
                                </button>
                                <button className="btn btn-outline btn-sm"
                                  onClick={() => { setEditVisit(null); load() }}
                                  style={{ fontSize:11 }}>
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── DETAILS TAB ── */}
      {activeTab === 'details' && (
        <div className="card card-pad">
          <div style={{ display:'flex', justifyContent:'space-between',
            alignItems:'center', marginBottom:20 }}>
            <span className="card-title">Site Information</span>
            <button className="btn btn-outline btn-sm"
              onClick={() => setEditDetails(s => !s)}>
              {editDetails ? 'Cancel' : '✏ Edit'}
            </button>
          </div>

          {editDetails ? (
            <>
              <div className="form-grid">
                <div className="form-group">
                  <label>Site Name</label>
                  <input value={editForm.client_name}
                    onChange={e => setEditForm(f => ({ ...f, client_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Site Type</label>
                  <select value={editForm.site_type}
                    onChange={e => setEditForm(f => ({ ...f, site_type: e.target.value }))}>
                    <option value="residential">Residential</option>
                    <option value="commercial">Commercial</option>
                    <option value="industrial">Industrial</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>System Size (kW)</label>
                  <input type="number" value={editForm.system_size_kw}
                    onChange={e => setEditForm(f => ({ ...f, system_size_kw: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>AMC Valid Upto</label>
                  <input type="date" value={editForm.amc_valid_upto}
                    onChange={e => setEditForm(f => ({ ...f, amc_valid_upto: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Contact Name</label>
                  <input value={editForm.contact_name}
                    onChange={e => setEditForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Contact Phone</label>
                  <input value={editForm.contact_phone}
                    onChange={e => setEditForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>

                {/* Assign To — dynamic employee list */}
                <div className="form-group full">
                  <label>Assign To Technician</label>
                  <select value={editForm.assigned_to_emp_code}
                    onChange={e => {
                      const emp = employees.find(x => x.emp_code === e.target.value)
                      setEditForm(f => ({
                        ...f,
                        assigned_to_emp_code: e.target.value,
                        assigned_to_name    : emp?.name || '',
                      }))
                    }}>
                    <option value="">Select employee...</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.emp_code}>
                        {e.emp_code} — {e.name} ({e.department})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:3 }}>
                    All active employees — new joiners appear automatically
                  </div>
                </div>

                {/* Service days */}
                <div className="form-group">
                  <label>Service Day 1 (of month)</label>
                  <select value={editForm.service_day_1}
                    onChange={e => setEditForm(f => ({ ...f, service_day_1: e.target.value }))}>
                    <option value="">Not set</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}th of every month</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Service Day 2 (of month)</label>
                  <select value={editForm.service_day_2}
                    onChange={e => setEditForm(f => ({ ...f, service_day_2: e.target.value }))}>
                    <option value="">Not set</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}th of every month</option>)}
                  </select>
                </div>

                <div className="form-group full">
                  <label>Notes</label>
                  <input value={editForm.notes}
                    onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div className="divider" />
              <div className="flex gap-8">
                <button className="btn btn-primary" onClick={saveDetails} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button className="btn btn-outline"
                  onClick={() => setEditDetails(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
              {[
                ['Site Name',       site.client_name],
                ['Site Type',       site.site_type],
                ['System Size',     site.system_size_kw ? `${site.system_size_kw} kW` : '—'],
                ['AMC Valid Upto',  site.amc_valid_upto
                  ? `${fmt(site.amc_valid_upto)}${daysLeft !== null ? ` (${isExpired ? Math.abs(daysLeft)+' days expired' : daysLeft+' days left'})` : ''}` : '—'],
                ['Contact Name',    site.contact_name   || '—'],
                ['Contact Phone',   site.contact_phone  || '—'],
                ['Assigned To',     site.assigned_to_name ? `${site.assigned_to_name} (${site.assigned_to_emp_code})` : '—'],
                ['Service Days',    serviceInfo || 'Not set'],
                ['Notes',           site.notes  || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding:'12px 0',
                  borderBottom:'1px solid var(--border-light)',
                  display:'grid', gridTemplateColumns:'160px 1fr', gap:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.05em', paddingTop:1 }}>
                    {label}
                  </div>
                  <div style={{ fontSize:13.5, color:'var(--text-primary)' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Layout>
  )
}
