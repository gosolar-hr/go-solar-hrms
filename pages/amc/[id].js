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

  const [site,           setSite]          = useState(null)
  const [employees,      setEmployees]     = useState([])
  const [loading,        setLoading]       = useState(true)
  const [saving,         setSaving]        = useState(false)
  const [alert,          setAlert]         = useState(null)
  const [activeTab,      setActiveTab]     = useState('visits')
  const [editVisit,      setEditVisit]     = useState(null)
  const [showAddVisit,   setShowAddVisit]  = useState(false)
  const [editDetails,    setEditDetails]   = useState(false)
  const [isHR,           setIsHR]          = useState(false)
  const [rescheduleId,   setRescheduleId]  = useState(null)
  const [rescheduleForm, setRescheduleForm]= useState({ scheduled_date:'', technician_id:'', remarks:'' })

  const [visitForm, setVisitForm] = useState({ scheduled_date:'', technician_id:'', remarks:'' })
  const [editForm,  setEditForm]  = useState({})

  // ── Photo upload state ───────────────────────────────────────────
  const [uploadVisitId,  setUploadVisitId]  = useState(null)   // visit being uploaded to
  const [uploadFiles,    setUploadFiles]    = useState([])     // staged File objects
  const [uploading,      setUploading]      = useState(false)
  const [lightboxUrl,    setLightboxUrl]    = useState(null)   // photo preview

  const MAX_IMAGE_MB  = 2
  const MAX_PDF_MB    = 5
  const MAX_FILES     = 5
  const ALLOWED_TYPES = ['image/jpeg','image/jpg','image/png','image/webp','application/pdf']

  const validateFiles = (files) => {
    if (files.length > MAX_FILES) return `Max ${MAX_FILES} files at once`
    for (const f of files) {
      if (!ALLOWED_TYPES.includes(f.type))
        return `"${f.name}" is not allowed. Only JPEG, PNG, WebP or PDF files.`
      const limitMB = f.type === 'application/pdf' ? MAX_PDF_MB : MAX_IMAGE_MB
      if (f.size > limitMB * 1024 * 1024)
        return `"${f.name}" exceeds the ${limitMB} MB limit. Please compress it first.`
    }
    return null
  }

  const stageFiles = (fileList) => {
    const files = Array.from(fileList)
    const err   = validateFiles(files)
    if (err) return setAlert({ type:'error', msg: err })
    setUploadFiles(files)
  }

  const uploadPhotos = async (visitId) => {
    if (!uploadFiles.length) return
    setUploading(true)
    const fd = new FormData()
    fd.append('visitId', visitId)
    uploadFiles.forEach(f => fd.append('files', f))
    const res  = await fetch('/api/amc/upload', { method:'POST', body: fd })
    const data = await res.json()
    setUploading(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`${data.uploaded.length} file(s) uploaded.` })
    setUploadFiles([])
    setUploadVisitId(null)
    load()
  }

  const deletePhoto = async (visitId, url) => {
    if (!confirm('Remove this photo?')) return
    const res  = await fetch('/api/amc/upload-delete', {
      method:'DELETE',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ visitId, url }),
    })
    const data = await res.json()
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:'Photo removed.' })
    load()
  }

  const load = () => {
    if (!id) return
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
    // Contact name — alphabetical only
    if (editForm.contact_name && !/^[A-Za-z\s.\-']+$/.test(editForm.contact_name.trim())) {
      return setAlert({ type:'error', msg:'Contact name should contain letters only — no numbers or special characters.' })
    }

    // Contact phone — must start with 91, exactly 12 digits
    if (editForm.contact_phone) {
      const phone = editForm.contact_phone.replace(/\s/g, '')
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
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        id, ...editForm,
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
      setSite(prev => ({ ...prev, amc_visits: prev.amc_visits.filter(v => v.id !== visitId) }))
      setAlert({ type:'success', msg:'Visit deleted.' })
    } else {
      setAlert({ type:'error', msg:'Failed to delete visit.' })
    }
  }

  // Open reschedule panel for a visit — pre-fill current technician
  const openReschedule = (visit) => {
    setRescheduleId(visit.id)
    setRescheduleForm({
      scheduled_date : '',
      technician_id  : visit.technician_id   || '',
      remarks        : '',
    })
    setEditVisit(null)
  }

  const saveReschedule = async () => {
    if (!rescheduleForm.scheduled_date) {
      return setAlert({ type:'error', msg:'Please select a new date.' })
    }
    setSaving(true)
    const emp = employees.find(e => e.id === rescheduleForm.technician_id)
    const res = await fetch('/api/amc/visits', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        id             : rescheduleId,
        status         : 'rescheduled',
        scheduled_date : rescheduleForm.scheduled_date,
        technician_id  : rescheduleForm.technician_id  || null,
        technician_name: emp?.name                      || null,
        remarks        : rescheduleForm.remarks         || null,
      })
    })
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg:'Failed to reschedule.' })
    setAlert({ type:'success', msg:'Visit rescheduled ✓' })
    setRescheduleId(null)
    load()
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

  const openWhatsApp = (visit) => {
    const phone = (site.contact_phone || '').replace(/\D/g, '')
    if (!phone) {
      setAlert({ type:'error', msg:'No contact phone number saved for this site. Add it under Site Details tab.' })
      return
    }
    // Ensure country code — default to India (+91)
    const waPhone    = phone.startsWith('91') && phone.length === 12 ? phone : `91${phone}`
    const techName   = visit.technician_name || visit.employees?.name || 'our technician'
    const date       = new Date(visit.scheduled_date).toLocaleDateString('en-IN',
                         { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    const clientName = site.contact_name || 'Sir/Madam'
    const address    = [site.address, site.city].filter(Boolean).join(', ')
    const visitNum   = visit.visit_number ? `Visit #${visit.visit_number}` : 'AMC Service Visit'

    const message =
`Dear ${clientName},

This is a reminder for your *${visitNum}* scheduled on *${date}*.

📍 Site: ${site.client_name}${address ? `\n📌 Address: ${address}` : ''}${site.system_size_kw ? `\n⚡ System: ${site.system_size_kw} kW` : ''}
👷 Technician: ${techName}

Kindly ensure site access is available at the time of visit.

For any queries, feel free to contact us.

Thank you,
*Go Solar Solutions*`

    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(message)}`
    // Use anchor click to avoid popup blockers
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const fmt = (d) => d
    ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
    : '—'

  if (loading) return <Layout><div className="empty-state"><p>Loading...</p></div></Layout>
  if (!site || site.error) return <Layout><div className="empty-state"><strong>Site not found</strong></div></Layout>

  const visits    = (site.amc_visits || []).sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
  const today     = new Date().toISOString().split('T')[0]
  const validUpto = site.amc_valid_upto ? new Date(site.amc_valid_upto) : null
  const daysLeft  = validUpto ? Math.ceil((validUpto - new Date()) / (1000*60*60*24)) : null
  const isExpired = daysLeft !== null && daysLeft < 0
  const isSoon    = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30
  const tc        = { residential:{c:'#2E90FA',bg:'#EFF8FF'}, commercial:{c:'#F79009',bg:'#FFFAEB'}, industrial:{c:'#7F56D9',bg:'#F4F3FF'} }[site.site_type] || {}
  const serviceInfo = [site.service_day_1, site.service_day_2].filter(Boolean).map(d => `${d}th`).join(' & ')

  return (
    <Layout>
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

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)',
          gap:12, marginTop:16, paddingTop:16,
          borderTop:'1px solid var(--border-light)' }}>
          {[
            ['AMC Valid Upto', (() => (
              <span style={{ color: isExpired ? '#F04438' : isSoon ? '#F79009' : 'var(--text-primary)' }}>
                {fmt(site.amc_valid_upto)}
                {daysLeft !== null && (
                  <span style={{ fontSize:11, marginLeft:6,
                    color: isExpired ? '#F04438' : isSoon ? '#F79009' : '#12B76A' }}>
                    ({isExpired ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days left`})
                  </span>
                )}
              </span>
            ))()],
            ['Assigned To',  site.assigned_to_name || '—'],
            ['Service Days', serviceInfo || 'Not set'],
            ['Visits',       `${visits.filter(v=>v.status==='completed').length} / ${visits.length} done`],
          ].map(([label, value]) => (
            <div key={label}>
              <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600,
                textTransform:'uppercase', letterSpacing:'0.06em' }}>{label}</div>
              <div style={{ fontSize:14, fontWeight:600, marginTop:3 }}>{value}</div>
            </div>
          ))}
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
            {isHR && (
              <button className="btn btn-primary btn-sm"
                onClick={() => setShowAddVisit(s => !s)}>
                + Schedule Visit
              </button>
            )}
          </div>

          {/* Add Visit form — HR only */}
          {isHR && showAddVisit && (
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border-light)',
              background:'var(--surface-2)' }}>
              <div style={{ fontWeight:600, fontSize:13, marginBottom:12,
                color:'var(--text-primary)' }}>New Visit</div>
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
                <p>{isHR ? 'Add a visit using the button above.' : 'No visits have been scheduled yet.'}</p>
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
                    <th>Photos</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map(visit => {
                    const sc        = VISIT_STATUS[visit.status] || VISIT_STATUS.scheduled
                    const done      = Object.values(visit.checklist || {}).filter(Boolean).length
                    const total     = Object.keys(CHECKLIST_ITEMS).length
                    const isEditing = editVisit === visit.id
                    const isRescheduling = rescheduleId === visit.id
                    const isOverdue = visit.status === 'scheduled' && visit.scheduled_date < today
                    const canAct    = visit.status === 'scheduled' || visit.status === 'rescheduled'

                    return (
                      <tr key={visit.id} style={{ background: isOverdue ? '#FFFBF0' : '' }}>

                        {/* Date */}
                        <td style={{ fontFamily:'DM Mono,monospace', fontSize:12 }}>
                          {fmt(visit.scheduled_date)}
                          {isOverdue && (
                            <div style={{ fontSize:10, color:'#F04438', fontWeight:600 }}>OVERDUE</div>
                          )}
                          {visit.completed_date && visit.completed_date !== visit.scheduled_date && (
                            <div style={{ fontSize:10, color:'#12B76A' }}>
                              Done: {fmt(visit.completed_date)}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span style={{ background:sc.bg, color:sc.color,
                            padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {sc.label}
                          </span>
                        </td>

                        {/* Technician */}
                        <td style={{ fontSize:13 }}>
                          {visit.employees?.name || visit.technician_name || '—'}
                        </td>

                        {/* Checklist */}
                        <td>
                          {isEditing ? (
                            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                              {Object.entries(CHECKLIST_ITEMS).map(([key, label]) => (
                                <label key={key} style={{ display:'flex', alignItems:'center',
                                  gap:6, fontSize:11, cursor:'pointer',
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

                        {/* Remarks */}
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

                        {/* ── Photos ── */}
                        <td style={{ minWidth:160 }}>
                          {/* Thumbnail strip */}
                          {Array.isArray(visit.photo_urls) && visit.photo_urls.length > 0 && (
                            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginBottom:6 }}>
                              {visit.photo_urls.map((photo, pi) => (
                                <div key={pi} style={{ position:'relative', display:'inline-block' }}>
                                  {photo.type === 'pdf' ? (
                                    <a href={photo.url} target="_blank" rel="noreferrer"
                                      style={{ display:'flex', flexDirection:'column',
                                        alignItems:'center', justifyContent:'center',
                                        width:44, height:44, background:'#FEF3F2',
                                        border:'1px solid #FECDCA', borderRadius:6,
                                        fontSize:9, color:'#B42318', textDecoration:'none',
                                        fontWeight:600, gap:1 }}>
                                      <span style={{ fontSize:16 }}>📄</span>
                                      PDF
                                    </a>
                                  ) : (
                                    <img src={photo.url} alt={photo.name}
                                      onClick={() => setLightboxUrl(photo.url)}
                                      style={{ width:44, height:44, objectFit:'cover',
                                        borderRadius:6, cursor:'pointer',
                                        border:'1px solid #E4E7EC' }} />
                                  )}
                                  {/* Delete X button */}
                                  <button onClick={() => deletePhoto(visit.id, photo.url)}
                                    title="Remove photo"
                                    style={{ position:'absolute', top:-5, right:-5,
                                      width:16, height:16, background:'#F04438',
                                      border:'none', borderRadius:'50%', color:'#fff',
                                      fontSize:9, cursor:'pointer', lineHeight:'16px',
                                      padding:0, display:'flex', alignItems:'center',
                                      justifyContent:'center' }}>
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Upload section — shown for ALL users (HR + Technician) */}
                          {uploadVisitId === visit.id ? (
                            <div style={{ background:'#F9FAFB', border:'1px dashed #D0D5DD',
                              borderRadius:8, padding:'8px 10px', minWidth:200 }}>
                              <div style={{ fontSize:11, fontWeight:600,
                                color:'var(--text-muted)', marginBottom:6 }}>
                                📎 Attach Files
                                <span style={{ fontWeight:400, marginLeft:4 }}>
                                  (JPEG/PNG/WebP ≤2 MB, PDF ≤5 MB, max 5 files)
                                </span>
                              </div>
                              <input type="file" multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf"
                                onChange={e => stageFiles(e.target.files)}
                                style={{ fontSize:11, marginBottom:6, display:'block' }} />
                              {uploadFiles.length > 0 && (
                                <div style={{ fontSize:10, color:'#344054',
                                  marginBottom:6, lineHeight:'1.5' }}>
                                  {uploadFiles.map((f,i) => (
                                    <div key={i}>
                                      {f.name} <span style={{ color:'#667085' }}>
                                        ({(f.size/1024).toFixed(0)} KB)
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex gap-8">
                                <button className="btn btn-primary btn-sm"
                                  onClick={() => uploadPhotos(visit.id)}
                                  disabled={uploading || !uploadFiles.length}
                                  style={{ fontSize:11 }}>
                                  {uploading ? 'Uploading…' : `Upload ${uploadFiles.length || ''}`}
                                </button>
                                <button className="btn btn-outline btn-sm"
                                  onClick={() => { setUploadVisitId(null); setUploadFiles([]) }}
                                  style={{ fontSize:11 }}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button className="btn btn-outline btn-sm"
                              onClick={() => { setUploadVisitId(visit.id); setUploadFiles([]) }}
                              style={{ fontSize:11, color:'#344054', borderColor:'#D0D5DD' }}>
                              📎 {Array.isArray(visit.photo_urls) && visit.photo_urls.length
                                ? `Add More (${visit.photo_urls.length})`
                                : 'Attach'}
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td>
                          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>

                            {/* ── Normal action buttons ── */}
                            {canAct && !isEditing && !isRescheduling && (
                              <div className="flex gap-8">
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
                                <button className="btn btn-outline btn-sm"
                                  onClick={() => openReschedule(visit)}
                                  style={{ fontSize:11, color:'#F79009', borderColor:'#F79009' }}>
                                  📅 Reschedule
                                </button>
                                <button className="btn btn-outline btn-sm"
                                  onClick={() => openWhatsApp(visit)}
                                  title="Send WhatsApp reminder to customer"
                                  style={{ fontSize:11, color:'#25D366', borderColor:'#25D366',
                                    display:'flex', alignItems:'center', gap:4 }}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#25D366">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                                  </svg>
                                  WhatsApp
                                </button>
                                {isHR && (
                                  <button className="btn btn-outline btn-sm"
                                    onClick={() => deleteVisit(visit.id)}
                                    style={{ fontSize:11, color:'#F04438', borderColor:'#F04438' }}>
                                    🗑 Delete
                                  </button>
                                )}
                              </div>
                            )}

                            {/* ── Reschedule inline form ── */}
                            {isRescheduling && (
                              <div style={{ background:'#FFFAEB', border:'1px solid #FEF0C7',
                                borderRadius:8, padding:'12px 14px', minWidth:280 }}>
                                <div style={{ fontWeight:600, fontSize:12,
                                  color:'#B54708', marginBottom:10 }}>
                                  📅 Reschedule Visit
                                </div>
                                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                                  <div>
                                    <label style={{ fontSize:11, fontWeight:600,
                                      color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                                      New Date *
                                    </label>
                                    <input type="date"
                                      value={rescheduleForm.scheduled_date}
                                      min={today}
                                      onChange={e => setRescheduleForm(f =>
                                        ({ ...f, scheduled_date: e.target.value }))}
                                      style={{ width:'100%' }} />
                                  </div>
                                  <div>
                                    <label style={{ fontSize:11, fontWeight:600,
                                      color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                                      Technician
                                    </label>
                                    <select value={rescheduleForm.technician_id}
                                      onChange={e => setRescheduleForm(f =>
                                        ({ ...f, technician_id: e.target.value }))}
                                      style={{ width:'100%' }}>
                                      <option value="">Keep same / Unassigned</option>
                                      {employees.map(e => (
                                        <option key={e.id} value={e.id}>
                                          {e.emp_code} — {e.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label style={{ fontSize:11, fontWeight:600,
                                      color:'var(--text-muted)', display:'block', marginBottom:3 }}>
                                      Reason
                                    </label>
                                    <input placeholder="e.g. Client requested, technician unavailable"
                                      value={rescheduleForm.remarks}
                                      onChange={e => setRescheduleForm(f =>
                                        ({ ...f, remarks: e.target.value }))}
                                      style={{ width:'100%' }} />
                                  </div>
                                  <div className="flex gap-8" style={{ marginTop:4 }}>
                                    <button className="btn btn-primary btn-sm"
                                      onClick={saveReschedule} disabled={saving}
                                      style={{ fontSize:11 }}>
                                      {saving ? 'Saving...' : 'Confirm Reschedule'}
                                    </button>
                                    <button className="btn btn-outline btn-sm"
                                      onClick={() => setRescheduleId(null)}
                                      style={{ fontSize:11 }}>
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Edit mode save/cancel ── */}
                            {isEditing && (
                              <div className="flex gap-8">
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
                              </div>
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
            {isHR && (
              <button className="btn btn-outline btn-sm"
                onClick={() => setEditDetails(s => !s)}>
                {editDetails ? 'Cancel' : '✏ Edit'}
              </button>
            )}
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
                </div>
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
                <button className="btn btn-outline" onClick={() => setEditDetails(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:0 }}>
              {[
                ['Site Name',      site.client_name],
                ['Site Type',      site.site_type],
                ['System Size',    site.system_size_kw ? `${site.system_size_kw} kW` : '—'],
                ['AMC Valid Upto', site.amc_valid_upto
                  ? `${fmt(site.amc_valid_upto)}${daysLeft !== null
                    ? ` (${isExpired ? Math.abs(daysLeft)+' days expired' : daysLeft+' days left'})`
                    : ''}` : '—'],
                ['Contact Name',   site.contact_name  || '—'],
                ['Contact Phone',  site.contact_phone || '—'],
                ['Assigned To',    site.assigned_to_name
                  ? `${site.assigned_to_name} (${site.assigned_to_emp_code})` : '—'],
                ['Service Days',   serviceInfo || 'Not set'],
                ['Notes',          site.notes  || '—'],
              ].map(([label, value]) => (
                <div key={label} style={{ padding:'12px 0',
                  borderBottom:'1px solid var(--border-light)',
                  display:'grid', gridTemplateColumns:'160px 1fr', gap:16 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.05em', paddingTop:1 }}>
                    {label}
                  </div>
                  <div style={{ fontSize:13.5, color:'var(--text-primary)' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox ───────────────────────────────────────────────── */}
      {lightboxUrl && (
        <div onClick={() => setLightboxUrl(null)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)',
            zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center',
            cursor:'zoom-out' }}>
          <img src={lightboxUrl} alt="Preview"
            style={{ maxWidth:'92vw', maxHeight:'90vh', borderRadius:8,
              boxShadow:'0 8px 40px rgba(0,0,0,0.6)' }} />
          <button onClick={() => setLightboxUrl(null)}
            style={{ position:'absolute', top:20, right:24, background:'#fff',
              border:'none', borderRadius:'50%', width:36, height:36,
              fontSize:20, cursor:'pointer', display:'flex',
              alignItems:'center', justifyContent:'center' }}>
            ×
          </button>
        </div>
      )}
    </Layout>
  )
}
