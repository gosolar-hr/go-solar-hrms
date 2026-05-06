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

const STATUS_CONFIG = {
  scheduled   : { label:'Scheduled',   color:'#2E90FA', bg:'#EFF8FF' },
  completed   : { label:'Completed',   color:'#12B76A', bg:'#ECFDF3' },
  missed      : { label:'Missed',      color:'#F04438', bg:'#FEF3F2' },
  rescheduled : { label:'Rescheduled', color:'#F79009', bg:'#FFFAEB' },
}

const FREQ_LABELS = {
  monthly:'Monthly', quarterly:'Quarterly',
  half_yearly:'Half Yearly', yearly:'Yearly',
}

export default function SiteDetail() {
  const router   = useRouter()
  const { id }   = router.query

  const [site,       setSite]       = useState(null)
  const [employees,  setEmployees]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [alert,      setAlert]      = useState(null)
  const [activeTab,  setActiveTab]  = useState('visits')
  const [editVisit,  setEditVisit]  = useState(null)
  const [showContract, setShowContract] = useState(false)
  const [showAddVisit, setShowAddVisit] = useState(false)
  const [saving,     setSaving]     = useState(false)

  // Contract form
  const [contractForm, setContractForm] = useState({
    start_date:'', end_date:'', visit_frequency:'quarterly',
    contract_value:'', notes:''
  })

  // New visit form
  const [visitForm, setVisitForm] = useState({
    scheduled_date:'', technician_id:'', remarks:''
  })

  const load = () => {
    if (!id) return
    fetch(`/api/amc/${id}`)
      .then(r => r.json())
      .then(d => { setSite(d); setLoading(false) })
  }

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { load() }, [id])

  const saveContract = async () => {
    if (!contractForm.start_date || !contractForm.end_date) {
      return setAlert({ type:'error', msg:'Start date and end date required' })
    }
    setSaving(true)
    const res = await fetch('/api/amc/contracts', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ site_id: id, ...contractForm,
        contract_value: Number(contractForm.contract_value)||0 })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg: `Contract ${data.contract_number} created. Visits auto-scheduled.` })
    setShowContract(false)
    load()
  }

  const addVisit = async () => {
    if (!visitForm.scheduled_date) {
      return setAlert({ type:'error', msg:'Scheduled date required' })
    }
    setSaving(true)
    const emp = employees.find(e => e.id === visitForm.technician_id)
    const res = await fetch('/api/amc/visits', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        site_id         : id,
        scheduled_date  : visitForm.scheduled_date,
        technician_id   : visitForm.technician_id || null,
        technician_name : emp?.name || null,
        remarks         : visitForm.remarks || null,
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:'Visit scheduled successfully.' })
    setShowAddVisit(false)
    setVisitForm({ scheduled_date:'', technician_id:'', remarks:'' })
    load()
  }

  const updateVisit = async (visitId, updates) => {
    const res = await fetch('/api/amc/visits', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ id: visitId, ...updates })
    })
    if (res.ok) { setEditVisit(null); load() }
  }

  const markComplete = async (visit) => {
    await updateVisit(visit.id, {
      status        : 'completed',
      completed_date: new Date().toISOString().split('T')[0],
      checklist     : visit.checklist,
      remarks       : visit.remarks,
    })
    setAlert({ type:'success', msg:'Visit marked as completed.' })
  }

  const toggleChecklist = (visitId, key) => {
    setSite(prev => ({
      ...prev,
      amc_visits: prev.amc_visits.map(v =>
        v.id === visitId
          ? { ...v, checklist: { ...v.checklist, [key]: !v.checklist[key] } }
          : v
      )
    }))
  }

  if (loading) return <Layout><p className="text-muted">Loading site...</p></Layout>
  if (!site || site.error) return <Layout><p className="text-muted">Site not found.</p></Layout>

  const activeContract = site.amc_contracts?.find(c => c.status === 'active')
  const visits = (site.amc_visits || [])
    .sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
  const completedVisits = visits.filter(v => v.status === 'completed').length
  const tc = {
    residential:{ color:'#2E90FA', bg:'#EFF8FF', border:'#B2DDFF' },
    commercial :{ color:'#F79009', bg:'#FFFAEB', border:'#FEF0C7' },
    industrial :{ color:'#7F56D9', bg:'#F4F3FF', border:'#D9D6FE' },
  }[site.site_type] || {}

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8,
        fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
        <Link href="/amc" style={{ color:'var(--text-muted)', textDecoration:'none' }}>
          O&M / AMC
        </Link>
        <span>/</span>
        <span style={{ color:'var(--text-primary)', fontWeight:500 }}>
          {site.client_name}
        </span>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Site Header */}
      <div className="card" style={{ marginBottom:20, padding:'24px 28px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <h2 style={{ fontSize:22, fontWeight:700, color:'var(--text-primary)' }}>
                {site.client_name}
              </h2>
              <span className="badge" style={{
                background:tc.bg, color:tc.color, border:`1px solid ${tc.border}`
              }}>
                {site.site_type}
              </span>
            </div>
            <div style={{ fontSize:13, color:'var(--text-secondary)', marginBottom:4 }}>
              📍 {site.address}{site.city ? `, ${site.city}` : ''}
            </div>
            {site.contact_name && (
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                Contact: {site.contact_name}
                {site.contact_phone ? ` · ${site.contact_phone}` : ''}
              </div>
            )}
          </div>
          <div style={{ textAlign:'right' }}>
            {site.system_size_kw && (
              <div style={{ fontSize:28, fontWeight:700, color:'var(--accent)',
                fontFamily:'DM Mono, monospace' }}>
                {site.system_size_kw} kW
              </div>
            )}
            {site.installation_date && (
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                Installed: {new Date(site.installation_date).toLocaleDateString('en-IN',
                  { day:'2-digit', month:'short', year:'numeric' })}
              </div>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
          gap:12, marginTop:20, paddingTop:16, borderTop:'1px solid var(--border-light)' }}>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>AMC Status</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:4 }}>
              {activeContract ? (
                <span style={{ color:'#12B76A' }}>Active</span>
              ) : (
                <span style={{ color:'#F04438' }}>No Contract</span>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Contract #</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:4,
              fontFamily:'DM Mono, monospace' }}>
              {activeContract?.contract_number || '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Expires</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:4 }}>
              {activeContract
                ? new Date(activeContract.end_date).toLocaleDateString('en-IN',
                    { day:'2-digit', month:'short', year:'numeric' })
                : '—'}
            </div>
          </div>
          <div>
            <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Visits Done</div>
            <div style={{ fontSize:14, fontWeight:600, marginTop:4 }}>
              {completedVisits} / {visits.length}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[
          { key:'visits',   label:`Visits (${visits.length})`   },
          { key:'contract', label:'Contract'                     },
          { key:'details',  label:'Site Details'                 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding        : '8px 18px',
              borderRadius   : 8,
              border         : '1px solid var(--border)',
              background     : activeTab === tab.key ? 'var(--accent)' : '#fff',
              color          : activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
              fontWeight     : 600,
              fontSize       : 13,
              cursor         : 'pointer',
              transition     : 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* VISITS TAB */}
      {activeTab === 'visits' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Visit Schedule & History</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddVisit(s => !s)}>
              + Add Visit
            </button>
          </div>

          {showAddVisit && (
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-light)',
              background:'var(--bg)' }}>
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
                    <option value="">Select employee</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.emp_code} — {e.name}</option>
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
                <button className="btn btn-outline btn-sm"
                  onClick={() => setShowAddVisit(false)}>Cancel</button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            {visits.length === 0 ? (
              <div className="empty-state">
                <strong>No visits scheduled</strong>
                <p>Add an AMC contract to auto-generate visits, or add manually.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th>Technician</th>
                    <th>Checklist</th>
                    <th>Remarks</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(visit => {
                    const sc  = STATUS_CONFIG[visit.status] || STATUS_CONFIG.scheduled
                    const done = Object.values(visit.checklist || {}).filter(Boolean).length
                    const total = Object.keys(CHECKLIST_ITEMS).length
                    const isEditing = editVisit === visit.id

                    return (
                      <tr key={visit.id}>
                        <td style={{ fontFamily:'DM Mono, monospace', fontSize:13 }}>
                          {new Date(visit.scheduled_date).toLocaleDateString('en-IN',
                            { day:'2-digit', month:'short', year:'numeric' })}
                          {visit.completed_date && visit.completed_date !== visit.scheduled_date && (
                            <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                              Done: {new Date(visit.completed_date).toLocaleDateString('en-IN',
                                { day:'2-digit', month:'short' })}
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
                                <label key={key} style={{ display:'flex', alignItems:'center',
                                  gap:6, fontSize:11, cursor:'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={!!visit.checklist?.[key]}
                                    onChange={() => toggleChecklist(visit.id, key)}
                                    style={{ accentColor:'var(--accent)' }}
                                  />
                                  {label}
                                </label>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize:12 }}>
                              <span style={{ fontWeight:600, color: done === total
                                ? '#12B76A' : 'var(--text-primary)' }}>
                                {done}/{total}
                              </span>
                              <span style={{ color:'var(--text-muted)', marginLeft:4 }}>
                                items
                              </span>
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                          {isEditing ? (
                            <input
                              value={visit.remarks || ''}
                              onChange={e => setSite(prev => ({
                                ...prev,
                                amc_visits: prev.amc_visits.map(v =>
                                  v.id === visit.id
                                    ? { ...v, remarks: e.target.value }
                                    : v
                                )
                              }))}
                              style={{ width:160 }}
                              placeholder="Add remarks..."
                            />
                          ) : (visit.remarks || '—')}
                        </td>
                        <td>
                          <div className="flex gap-8">
                            {visit.status === 'scheduled' && !isEditing && (
                              <>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => setEditVisit(visit.id)}
                                  style={{ fontSize:11 }}
                                >
                                  ✏ Edit
                                </button>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => markComplete(visit)}
                                  style={{ fontSize:11 }}
                                >
                                  ✓ Done
                                </button>
                              </>
                            )}
                            {isEditing && (
                              <>
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => updateVisit(visit.id, {
                                    status      : visit.status,
                                    checklist   : visit.checklist,
                                    remarks     : visit.remarks,
                                    technician_id: visit.technician_id,
                                    technician_name: visit.technician_name,
                                  })}
                                  style={{ fontSize:11 }}
                                >
                                  Save
                                </button>
                                <button
                                  className="btn btn-outline btn-sm"
                                  onClick={() => { setEditVisit(null); load() }}
                                  style={{ fontSize:11 }}
                                >
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

      {/* CONTRACT TAB */}
      {activeTab === 'contract' && (
        <div className="card card-pad">
          <div className="flex items-center justify-between" style={{ marginBottom:20 }}>
            <div className="card-title">AMC Contract</div>
            {!activeContract && (
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowContract(s => !s)}>
                + Create Contract
              </button>
            )}
          </div>

          {showContract && (
            <div style={{ background:'var(--bg)', borderRadius:8, padding:16, marginBottom:20 }}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Start Date *</label>
                  <input type="date" value={contractForm.start_date}
                    onChange={e => setContractForm(f => ({ ...f, start_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>End Date *</label>
                  <input type="date" value={contractForm.end_date}
                    onChange={e => setContractForm(f => ({ ...f, end_date: e.target.value }))} />
                </div>
                <div className="form-group">
                  <label>Visit Frequency *</label>
                  <select value={contractForm.visit_frequency}
                    onChange={e => setContractForm(f => ({ ...f, visit_frequency: e.target.value }))}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="half_yearly">Half Yearly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Contract Value (₹)</label>
                  <input type="number" placeholder="0"
                    value={contractForm.contract_value}
                    onChange={e => setContractForm(f => ({ ...f, contract_value: e.target.value }))} />
                </div>
                <div className="form-group full">
                  <label>Notes</label>
                  <input placeholder="Contract notes"
                    value={contractForm.notes}
                    onChange={e => setContractForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
              </div>
              <div style={{ background:'#EFF8FF', border:'1px solid #B2DDFF',
                borderRadius:8, padding:'10px 14px', marginTop:12, fontSize:12, color:'#1849A9' }}>
                ℹ Visits will be auto-generated based on frequency from start date to end date.
              </div>
              <div className="flex gap-8 mt-16">
                <button className="btn btn-primary btn-sm" onClick={saveContract} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Contract'}
                </button>
                <button className="btn btn-outline btn-sm"
                  onClick={() => setShowContract(false)}>Cancel</button>
              </div>
            </div>
          )}

          {activeContract ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {[
                { label:'Contract No.', value: activeContract.contract_number },
                { label:'Frequency',   value: FREQ_LABELS[activeContract.visit_frequency] },
                { label:'Start Date',  value: new Date(activeContract.start_date)
                    .toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) },
                { label:'End Date',    value: new Date(activeContract.end_date)
                    .toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' }) },
                { label:'Value',       value: activeContract.contract_value
                    ? `₹${Number(activeContract.contract_value).toLocaleString('en-IN')}`
                    : '—' },
                { label:'Status',      value: activeContract.status.toUpperCase() },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding:'12px 0',
                  borderBottom:'1px solid var(--border-light)' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.04em' }}>
                    {label}
                  </div>
                  <div style={{ fontSize:14, fontWeight:500, color:'var(--text-primary)', marginTop:4 }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No active contract</strong>
              <p>Create a contract to auto-schedule maintenance visits.</p>
            </div>
          )}
        </div>
      )}

      {/* DETAILS TAB */}
      {activeTab === 'details' && (
        <div className="card card-pad">
          <div className="card-title" style={{ marginBottom:16 }}>Site Information</div>
          {[
            { label:'Client Name',       value: site.client_name     },
            { label:'Site Type',         value: site.site_type       },
            { label:'Address',           value: site.address         },
            { label:'City',              value: site.city            },
            { label:'System Size',       value: site.system_size_kw
                ? `${site.system_size_kw} kW` : null                 },
            { label:'Installation Date', value: site.installation_date
                ? new Date(site.installation_date).toLocaleDateString('en-IN',
                    { day:'2-digit', month:'long', year:'numeric' })
                : null                                                },
            { label:'Contact Person',    value: site.contact_name    },
            { label:'Contact Phone',     value: site.contact_phone   },
            { label:'Notes',             value: site.notes           },
          ].map(({ label, value }) => (
            <div key={label} style={{ display:'grid',
              gridTemplateColumns:'180px 1fr', gap:16,
              padding:'10px 0', borderBottom:'1px solid var(--border-light)' }}>
              <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.04em' }}>
                {label}
              </div>
              <div style={{ fontSize:13.5, color:'var(--text-secondary)' }}>
                {value || <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>
                  Not provided</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
