import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const STATUS_CONFIG = {
  pending  : { label: 'Pending',  color: '#B54708', bg: '#FFFAEB', border: '#FEF0C7' },
  approved : { label: 'Approved', color: '#027A48', bg: '#ECFDF3', border: '#A9EFC5' },
  rejected : { label: 'Rejected', color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  availed  : { label: 'Availed',  color: '#344054', bg: '#F8F9FB', border: '#E4E7EC' },
}

const MAX_APPLY_DAYS = 7
const EXPIRY_DAYS    = 30

export default function MyCompOff() {
  const [requests,     setRequests]     = useState([])
  const [balance,      setBalance]      = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [alert,        setAlert]        = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [availModal,   setAvailModal]   = useState(null)
  const [availDate,    setAvailDate]    = useState('')
  const [availLoading, setAvailLoading] = useState(false)
  const [employees,    setEmployees]    = useState([])
  const [myEmpId,      setMyEmpId]      = useState(null)

  // Form state
  const [form, setForm] = useState({
    worked_date         : '',
    worked_day_type     : 'holiday',
    reason              : '',
    requested_avail_date: '',
  })

  // Get current employee id from session / cookie
  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setEmployees(data)
      })
    // Derive employeeId from cookie set at login
    const empId = document.cookie.split('; ')
      .find(c => c.startsWith('hrms_employee_id='))?.split('=')[1]
    if (empId) setMyEmpId(empId)
  }, [])

  const load = async () => {
    setLoading(true)
    const res  = await fetch('/api/comp-off')
    const data = await res.json()
    if (Array.isArray(data)) {
      setRequests(data)
      // Balance = approved requests not yet availed
      setBalance(data.filter(r => r.status === 'approved').length)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const showAlert = (type, msg) => {
    setAlert({ type, msg })
    setTimeout(() => setAlert(null), 5000)
  }

  const handleSubmit = async () => {
    if (!form.worked_date || !form.reason.trim()) {
      return showAlert('error', 'Worked date and reason are required.')
    }

    // Client-side: validate within 7 days
    const worked  = new Date(form.worked_date)
    const today   = new Date()
    today.setHours(0, 0, 0, 0)
    const days    = Math.floor((today - worked) / 86400000)
    if (days > MAX_APPLY_DAYS) {
      return showAlert('error', `You can only apply within ${MAX_APPLY_DAYS} days of working. This date was ${days} days ago.`)
    }
    if (worked > today) {
      return showAlert('error', 'Worked date cannot be in the future.')
    }

    setSubmitting(true)
    const res  = await fetch('/api/comp-off', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ ...form, employee_id: myEmpId }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) return showAlert('error', data.error)
    showAlert('success', 'Comp off request submitted successfully.')
    setForm({ worked_date: '', worked_day_type: 'holiday', reason: '', requested_avail_date: '' })
    load()
  }

  const handleAvail = async () => {
    if (!availDate) return showAlert('error', 'Please select the date you want to avail.')
    setAvailLoading(true)
    const res  = await fetch('/api/comp-off/avail', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ id: availModal.id, availed_date: availDate }),
    })
    const data = await res.json()
    setAvailLoading(false)
    if (!res.ok) return showAlert('error', data.error)
    showAlert('success', `Comp off availed on ${availDate}. Remaining balance: ${data.balance}`)
    setAvailModal(null)
    setAvailDate('')
    load()
  }

  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  // Min avail date = tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minAvail = tomorrow.toISOString().split('T')[0]

  // Max worked date = today
  const todayStr = new Date().toISOString().split('T')[0]

  // Min worked date for applying = today - 7 days
  const minWorked = new Date()
  minWorked.setDate(minWorked.getDate() - MAX_APPLY_DAYS)
  const minWorkedStr = minWorked.toISOString().split('T')[0]

  const approvedReqs = requests.filter(r => r.status === 'approved')

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">My Comp Off</h1>
          <p className="page-subtitle">Apply for compensatory off when you work on holidays or week offs</p>
        </div>
        {/* Balance chip */}
        <div style={{
          background: balance > 0 ? '#ECFDF3' : '#F8F9FB',
          border: `1px solid ${balance > 0 ? '#A9EFC5' : '#E4E7EC'}`,
          borderRadius: 12, padding: '10px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: balance > 0 ? '#027A48' : '#667085' }}>Available Balance</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: balance > 0 ? '#027A48' : '#344054' }}>{balance}</div>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: 16 }}>
          {alert.msg}
        </div>
      )}

      {/* Policy note */}
      <div style={{
        background: '#F0F9FF', border: '1px solid #B9E6FE',
        borderRadius: 10, padding: '12px 16px', marginBottom: 24,
        fontSize: 12, color: '#026AA2', lineHeight: 1.7,
      }}>
        <strong>Policy:</strong> Apply within <strong>{MAX_APPLY_DAYS} days</strong> of working on a holiday or week off.
        Comp off must be availed within <strong>{EXPIRY_DAYS} days</strong> of the worked date.
        Maximum balance at any time: <strong>3 comp offs</strong>.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* Apply form */}
        <div className="card">
          <h3 style={{ margin: '0 0 20px', fontSize: 15, fontWeight: 600 }}>Apply for Comp Off</h3>

          <div className="form-group">
            <label>Date you worked</label>
            <input type="date"
              value={form.worked_date}
              min={minWorkedStr}
              max={todayStr}
              onChange={e => setForm(p => ({ ...p, worked_date: e.target.value }))} />
          </div>

          <div className="form-group">
            <label>Day type</label>
            <select value={form.worked_day_type}
              onChange={e => setForm(p => ({ ...p, worked_day_type: e.target.value }))}>
              <option value="holiday">Public Holiday</option>
              <option value="weekoff">Week Off (Sunday / 2nd–4th Saturday)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Reason / Work done</label>
            <textarea rows={3}
              value={form.reason}
              onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="Briefly describe what work was done on this day…" />
          </div>

          <div className="form-group">
            <label>Preferred avail date <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
            <input type="date"
              value={form.requested_avail_date}
              min={minAvail}
              onChange={e => setForm(p => ({ ...p, requested_avail_date: e.target.value }))} />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              HR may or may not approve this specific date
            </div>
          </div>

          <button className="btn btn-primary"
            disabled={submitting || !form.worked_date || !form.reason.trim()}
            onClick={handleSubmit}
            style={{ width: '100%', marginTop: 4 }}>
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>

        {/* Approved — ready to avail */}
        <div>
          {approvedReqs.length > 0 && (
            <div className="card" style={{ marginBottom: 16, background: '#F0FDF9', borderColor: '#99E6DA' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, color: '#0E9384' }}>
                ✓ Ready to Avail ({approvedReqs.length})
              </h3>
              {approvedReqs.map(r => {
                const expiry = new Date(r.worked_date)
                expiry.setDate(expiry.getDate() + EXPIRY_DAYS)
                const daysLeft = Math.ceil((expiry - new Date()) / 86400000)
                return (
                  <div key={r.id} style={{
                    background: '#fff', border: '1px solid #99E6DA',
                    borderRadius: 8, padding: '12px 14px', marginBottom: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>Worked: {fmt(r.worked_date)}</div>
                      <div style={{ fontSize: 11, color: daysLeft <= 7 ? '#B54708' : 'var(--text-muted)', marginTop: 2 }}>
                        {daysLeft > 0 ? `Expires in ${daysLeft} days` : 'Expired'}
                      </div>
                    </div>
                    <button className="btn btn-primary btn-sm"
                      disabled={daysLeft <= 0}
                      onClick={() => { setAvailModal(r); setAvailDate('') }}
                      style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      Avail Now
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* All history */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 14 }}>Request History</h3>
            </div>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading…</div>
            ) : requests.length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                No requests yet.
              </div>
            ) : (
              <div>
                {requests.map(r => {
                  const sc = STATUS_CONFIG[r.status] || {}
                  return (
                    <div key={r.id} style={{
                      padding: '12px 18px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex', alignItems: 'flex-start',
                      justifyContent: 'space-between', gap: 12,
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          Worked: {fmt(r.worked_date)}
                          <span style={{
                            marginLeft: 8, fontSize: 11, fontWeight: 400,
                            background: '#F8F9FB', padding: '1px 6px', borderRadius: 4,
                            color: 'var(--text-muted)',
                          }}>
                            {r.worked_day_type === 'holiday' ? 'Holiday' : 'Week Off'}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                          {r.reason}
                        </div>
                        {r.rejection_reason && (
                          <div style={{ fontSize: 11, color: '#B42318', marginTop: 3 }}>
                            Rejected: {r.rejection_reason}
                          </div>
                        )}
                        {r.availed_date && (
                          <div style={{ fontSize: 11, color: '#027A48', marginTop: 3 }}>
                            Availed on {fmt(r.availed_date)}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                          Applied {fmt(r.created_at)}
                        </div>
                      </div>
                      <span style={{
                        background: sc.bg, color: sc.color,
                        border: `1px solid ${sc.border}`,
                        fontSize: 11, fontWeight: 500, padding: '3px 10px',
                        borderRadius: 12, whiteSpace: 'nowrap', flexShrink: 0,
                      }}>
                        {sc.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Avail modal */}
      {availModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Avail Comp Off</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px' }}>
              For work done on <strong>{fmt(availModal.worked_date)}</strong>
            </p>
            <div className="form-group">
              <label>Date to take off</label>
              <input type="date"
                value={availDate}
                min={minAvail}
                onChange={e => setAvailDate(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                This day will be marked as Comp Off in your attendance.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-outline"
                onClick={() => { setAvailModal(null); setAvailDate('') }}>
                Cancel
              </button>
              <button className="btn btn-primary"
                disabled={!availDate || availLoading}
                onClick={handleAvail}>
                {availLoading ? '…' : 'Confirm Avail'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
