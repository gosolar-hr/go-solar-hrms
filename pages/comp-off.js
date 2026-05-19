import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const STATUS_CONFIG = {
  pending  : { label: 'Pending',  color: '#B54708', bg: '#FFFAEB', border: '#FEF0C7' },
  approved : { label: 'Approved', color: '#027A48', bg: '#ECFDF3', border: '#A9EFC5' },
  rejected : { label: 'Rejected', color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  availed  : { label: 'Availed',  color: '#344054', bg: '#F8F9FB', border: '#E4E7EC' },
}

const EXPIRY_DAYS = 30

export default function CompOff() {
  const [requests,     setRequests]     = useState([])
  const [employees,    setEmployees]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [alert,        setAlert]        = useState(null)
  const [filterStatus, setFilterStatus] = useState('pending')
  const [processing,   setProcessing]   = useState(null)

  // Add record form
  const [showForm,   setShowForm]   = useState(false)
  const [form,       setForm]       = useState({ employee_id: '', worked_date: '', worked_day_type: 'holiday', reason: '', requested_avail_date: '' })
  const [submitting, setSubmitting] = useState(false)

  // Modals
  const [rejectModal,  setRejectModal]  = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [availModal,   setAvailModal]   = useState(null)
  const [availDate,    setAvailDate]    = useState('')
  const [availLoading, setAvailLoading] = useState(false)

  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setEmployees(d.filter(e => e.is_active !== false))
    })
  }, [])

  const load = async (status = filterStatus) => {
    setLoading(true)
    const qs  = status ? `?status=${status}` : ''
    const res = await fetch(`/api/comp-off${qs}`)
    const data = await res.json()
    setRequests(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [filterStatus])

  const showAlert = (type, msg) => {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 4000)
  }

  // HR adds a new comp off record
  const handleAdd = async () => {
    if (!form.employee_id || !form.worked_date || !form.reason.trim()) {
      return showAlert('error', 'Employee, worked date and reason are all required.')
    }
    setSubmitting(true)
    const res  = await fetch('/api/comp-off', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) return showAlert('error', data.error)
    showAlert('success', 'Comp off record added.')
    setShowForm(false)
    setForm({ employee_id: '', worked_date: '', worked_day_type: 'holiday', reason: '', requested_avail_date: '' })
    setFilterStatus('pending')
    load('pending')
  }

  // Approve / Reject
  const handleAction = async (id, action, extra = {}) => {
    setProcessing(id + action)
    const res  = await fetch('/api/comp-off', {
      method  : 'PUT',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ id, action, ...extra }),
    })
    const data = await res.json()
    setProcessing(null)
    if (!res.ok) return showAlert('error', data.error)
    showAlert('success', data.message)
    setRejectModal(null)
    setRejectReason('')
    load()
  }

  // Avail
  const handleAvail = async () => {
    if (!availDate) return showAlert('error', 'Please select the avail date.')
    setAvailLoading(true)
    const res  = await fetch('/api/comp-off/avail', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ id: availModal.id, availed_date: availDate }),
    })
    const data = await res.json()
    setAvailLoading(false)
    if (!res.ok) return showAlert('error', data.error)
    showAlert('success', `Availed. Remaining balance: ${data.balance}`)
    setAvailModal(null)
    setAvailDate('')
    load()
  }

  const fmt      = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const todayStr = new Date().toISOString().split('T')[0]
  const pending  = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Comp Off</h1>
          <p className="page-subtitle">Record, approve and track compensatory offs for employees</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add Comp Off
        </button>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: 16 }}>
          {alert.msg}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending Review', value: pending,         color: '#B54708', bg: '#FFFAEB' },
          { label: 'Approved',       value: approved,        color: '#027A48', bg: '#ECFDF3' },
          { label: 'Total',          value: requests.length, color: '#344054', bg: '#F8F9FB' },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, border: `1px solid ${c.color}22`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 12, color: c.color, fontWeight: 500, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'pending', 'approved', 'rejected', 'availed'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer', border: '1px solid',
              background : filterStatus === s ? 'var(--primary)' : 'transparent',
              color      : filterStatus === s ? '#fff' : 'var(--text-secondary)',
              borderColor: filterStatus === s ? 'var(--primary)' : 'var(--border)',
            }}>
            {s ? (STATUS_CONFIG[s]?.label || s) : 'All'}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
        ) : requests.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No {filterStatus || ''} records found.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Worked On</th>
                  <th>Day Type</th>
                  <th>Reason</th>
                  <th>Preferred Avail</th>
                  <th>Added On</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const sc = STATUS_CONFIG[r.status] || {}
                  const expiryDate = new Date(r.worked_date)
                  expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)
                  const daysLeft = Math.ceil((expiryDate - new Date()) / 86400000)
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.employees?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {r.employees?.emp_code} · {r.employees?.department}
                        </div>
                      </td>
                      <td style={{ fontSize: 13 }}>{fmt(r.worked_date)}</td>
                      <td>
                        <span style={{
                          background: r.worked_day_type === 'holiday' ? '#F4F3FF' : '#F8F9FB',
                          color      : r.worked_day_type === 'holiday' ? '#6941C6' : '#344054',
                          fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 12,
                        }}>
                          {r.worked_day_type === 'holiday' ? 'Holiday' : 'Week Off'}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                        {r.reason}
                        {r.rejection_reason && (
                          <div style={{ color: '#B42318', marginTop: 2, fontSize: 11 }}>
                            ✕ {r.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{fmt(r.requested_avail_date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(r.created_at)}</td>
                      <td>
                        <div>
                          <span style={{
                            background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                            fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 12,
                          }}>
                            {sc.label}
                            {r.status === 'availed' && r.availed_date && (
                              <span style={{ fontWeight: 400, marginLeft: 4 }}>({fmt(r.availed_date)})</span>
                            )}
                          </span>
                          {r.status === 'approved' && daysLeft <= 7 && daysLeft > 0 && (
                            <div style={{ fontSize: 10, color: '#B54708', marginTop: 3 }}>
                              Expires in {daysLeft}d
                            </div>
                          )}
                          {r.status === 'approved' && daysLeft <= 0 && (
                            <div style={{ fontSize: 10, color: '#B42318', marginTop: 3 }}>Expired</div>
                          )}
                        </div>
                      </td>
                      <td>
                        {r.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm"
                              disabled={!!processing}
                              onClick={() => handleAction(r.id, 'approve')}
                              style={{ fontSize: 11 }}>
                              {processing === r.id + 'approve' ? '…' : 'Approve'}
                            </button>
                            <button className="btn btn-outline btn-sm"
                              disabled={!!processing}
                              onClick={() => { setRejectModal(r); setRejectReason('') }}
                              style={{ fontSize: 11, color: '#B42318', borderColor: '#FECDCA' }}>
                              Reject
                            </button>
                          </div>
                        )}
                        {r.status === 'approved' && (
                          <button className="btn btn-outline btn-sm"
                            onClick={() => { setAvailModal(r); setAvailDate('') }}
                            style={{ fontSize: 11, color: '#027A48', borderColor: '#A9EFC5' }}>
                            Mark Availed
                          </button>
                        )}
                        {(r.status === 'rejected' || r.status === 'availed') && (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add record modal ── */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width: 480, padding: 28 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 16 }}>Add Comp Off Record</h3>

            <div className="form-group">
              <label>Employee</label>
              <select value={form.employee_id} onChange={e => setForm(p => ({ ...p, employee_id: e.target.value }))}>
                <option value="">Select employee…</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>{e.name} {e.emp_code ? `(${e.emp_code})` : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label>Date worked</label>
                <input type="date" value={form.worked_date} max={todayStr}
                  onChange={e => setForm(p => ({ ...p, worked_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Day type</label>
                <select value={form.worked_day_type}
                  onChange={e => setForm(p => ({ ...p, worked_day_type: e.target.value }))}>
                  <option value="holiday">Public Holiday</option>
                  <option value="weekoff">Week Off</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Work done / Reason</label>
              <textarea rows={3} value={form.reason}
                onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
                placeholder="Briefly describe the work done on this day…" />
            </div>

            <div className="form-group">
              <label>Preferred avail date <span style={{ fontWeight:400, color:'var(--text-muted)' }}>(optional)</span></label>
              <input type="date" value={form.requested_avail_date}
                onChange={e => setForm(p => ({ ...p, requested_avail_date: e.target.value }))} />
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary"
                disabled={submitting || !form.employee_id || !form.worked_date || !form.reason.trim()}
                onClick={handleAdd}>
                {submitting ? 'Saving…' : 'Save Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width: 440, padding: 24 }}>
            <h3 style={{ margin:'0 0 4px', fontSize:16 }}>Reject Comp Off</h3>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 16px' }}>
              {rejectModal.employees?.name} — worked on {fmt(rejectModal.worked_date)}
            </p>
            <div className="form-group">
              <label>Reason for rejection</label>
              <textarea rows={3} value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Enter reason…" />
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setRejectModal(null)}>Cancel</button>
              <button className="btn btn-primary"
                disabled={!rejectReason.trim() || !!processing}
                onClick={() => handleAction(rejectModal.id, 'reject', { rejection_reason: rejectReason })}>
                {processing ? '…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mark Availed modal ── */}
      {availModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:999, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h3 style={{ margin:'0 0 4px', fontSize:16 }}>Mark Comp Off as Availed</h3>
            <p style={{ fontSize:13, color:'var(--text-secondary)', margin:'0 0 16px' }}>
              {availModal.employees?.name} — worked on {fmt(availModal.worked_date)}
            </p>
            <div className="form-group">
              <label>Date taken off</label>
              <input type="date" value={availDate}
                onChange={e => setAvailDate(e.target.value)} />
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                This day will be marked as <strong>CO</strong> in attendance automatically.
              </div>
            </div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
              <button className="btn btn-outline" onClick={() => { setAvailModal(null); setAvailDate('') }}>Cancel</button>
              <button className="btn btn-primary"
                disabled={!availDate || availLoading}
                onClick={handleAvail}>
                {availLoading ? '…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
