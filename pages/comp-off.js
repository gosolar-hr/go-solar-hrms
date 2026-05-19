import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const STATUS_CONFIG = {
  pending  : { label: 'Pending',  color: '#B54708', bg: '#FFFAEB', border: '#FEF0C7' },
  approved : { label: 'Approved', color: '#027A48', bg: '#ECFDF3', border: '#A9EFC5' },
  rejected : { label: 'Rejected', color: '#B42318', bg: '#FEF3F2', border: '#FECDCA' },
  availed  : { label: 'Availed',  color: '#344054', bg: '#F8F9FB', border: '#E4E7EC' },
}

const DAY_TYPE = {
  holiday : { label: 'Holiday', color: '#6941C6', bg: '#F4F3FF' },
  weekoff : { label: 'Week Off', color: '#344054', bg: '#F8F9FB' },
}

export default function CompOff() {
  const [requests,       setRequests]       = useState([])
  const [loading,        setLoading]        = useState(true)
  const [alert,          setAlert]          = useState(null)
  const [filterStatus,   setFilterStatus]   = useState('pending')
  const [rejectModal,    setRejectModal]    = useState(null)
  const [rejectReason,   setRejectReason]   = useState('')
  const [processing,     setProcessing]     = useState(null)

  const load = async (status = filterStatus) => {
    setLoading(true)
    const qs = status ? `?status=${status}` : ''
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

  const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—'

  const pending  = requests.filter(r => r.status === 'pending').length
  const approved = requests.filter(r => r.status === 'approved').length

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Comp Off Requests</h1>
          <p className="page-subtitle">Review and approve compensatory off requests from employees</p>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: 16 }}>
          {alert.msg}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending Review', value: pending,  color: '#B54708', bg: '#FFFAEB' },
          { label: 'Approved',       value: approved, color: '#027A48', bg: '#ECFDF3' },
          { label: 'Total This View', value: requests.length, color: '#344054', bg: '#F8F9FB' },
        ].map(card => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.color}22`,
            borderRadius: 12, padding: '14px 18px',
          }}>
            <div style={{ fontSize: 12, color: card.color, fontWeight: 500, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['', 'pending', 'approved', 'rejected', 'availed'].map(s => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, cursor: 'pointer',
              border: '1px solid',
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
            No {filterStatus || ''} requests found.
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
                  <th>Applied On</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {requests.map(r => {
                  const sc  = STATUS_CONFIG[r.status] || {}
                  const dtc = DAY_TYPE[r.worked_day_type] || {}
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{r.employees?.name || '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.employees?.emp_code} · {r.employees?.department}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{fmt(r.worked_date)}</td>
                      <td>
                        <span style={{ background: dtc.bg, color: dtc.color,
                          fontSize: 11, fontWeight: 500, padding: '2px 8px',
                          borderRadius: 12 }}>
                          {dtc.label || r.worked_day_type}
                        </span>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', maxWidth: 200 }}>
                        {r.reason}
                        {r.rejection_reason && (
                          <div style={{ color: '#B42318', marginTop: 2 }}>
                            Reason: {r.rejection_reason}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{fmt(r.requested_avail_date)}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(r.created_at)}</td>
                      <td>
                        <span style={{
                          background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                          fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 12,
                        }}>
                          {sc.label}
                          {r.status === 'availed' && r.availed_date && (
                            <span style={{ fontWeight: 400, marginLeft: 4 }}>({fmt(r.availed_date)})</span>
                          )}
                        </span>
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
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            by {r.approved_by || 'HR'}
                          </span>
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

      {/* Reject modal */}
      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div className="card" style={{ width: 440, padding: 24 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>Reject Comp Off</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 16px' }}>
              {rejectModal.employees?.name} — worked on {fmt(rejectModal.worked_date)}
            </p>
            <label style={{ fontSize: 13, fontWeight: 500 }}>Reason for rejection</label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Enter reason…"
              style={{ width: '100%', marginTop: 6, marginBottom: 16, resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
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
    </Layout>
  )
}
