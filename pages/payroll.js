import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const LATE_SLABS = [
  { value: 0,   label: 'No Deduction (Grace)' },
  { value: 20,  label: '20% — Late (9:45–10:00)' },
  { value: 30,  label: '30% — Late (10:00–10:30)' },
  { value: 50,  label: '50% — Late after 10:30' },
]

export default function Payroll() {
  const now = new Date()
  const [month,      setMonth]      = useState(now.getMonth() + 1)
  const [year,       setYear]       = useState(now.getFullYear())
  const [slab,       setSlab]       = useState(50)
  const [payroll,    setPayroll]    = useState([])
  const [employees,  setEmployees]  = useState([])
  const [overrides,  setOverrides]  = useState({})
  
  const [showInputs, setShowInputs] = useState(false)
  const [running,    setRunning]    = useState(false)
  const [alert,      setAlert]      = useState(null)

  // Draft & Lock State
  const [isLocked,     setIsLocked]     = useState(false)
  const [savingDraft,  setSavingDraft]  = useState(false)
  const [reopening,    setReopening]    = useState(false)
  const [loanSummary,  setLoanSummary]  = useState({})
  const [draftMap,     setDraftMap]     = useState({})
  const [draftLoaded,  setDraftLoaded]  = useState(false)

  const loadPayroll = (m, y) =>
    fetch(`/api/payroll?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => setPayroll(Array.isArray(d) ? d : []))

  const loadDraft = async (m, y, emps) => {
    const res  = await fetch(`/api/payroll/draft?month=${m}&year=${y}`)
    const data = await res.json()

    setIsLocked(data.is_locked || false)

    const filled = {}
    emps.forEach(e => {
      const ls = loanSummary[e.id] || {}
      filled[e.id] = { 
        overtime: 0, incentive: 0, 
        loan: ls.loan_monthly_recovery || 0, 
        advance: ls.advance_monthly || 0 
      }
    })

    if (Array.isArray(data.entries) && data.entries.length > 0) {
      const map = {}
      data.entries.forEach(d => { map[d.employee_id] = d })
      setDraftMap(map)

      data.entries.forEach(d => {
        if (filled[d.employee_id] !== undefined) {
          filled[d.employee_id] = {
            overtime  : d.overtime_hours || 0,
            incentive : d.incentive      || 0,
            loan      : d.loan           || 0,
            advance   : d.advance        || 0,
          }
        }
      })
      setDraftLoaded(true)
    } else {
      setDraftMap({})
      setDraftLoaded(false)
    }
    setOverrides(filled)
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch('/api/loans/summary').then(r => r.json()),
    ]).then(([emps, ls]) => {
      if (Array.isArray(emps)) {
        setEmployees(emps)
        setLoanSummary(ls || {})
        loadDraft(month, year, emps)
      }
    })
  }, [])

  useEffect(() => { 
    loadPayroll(month, year)
    if (employees.length > 0) loadDraft(month, year, employees)
  }, [month, year])

  const onOverride = (empId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: Number(value) || 0 }
    }))
  }

  const saveDraft = async () => {
    setSavingDraft(true)
    const entries = Object.entries(overrides).map(([empId, vals]) => ({
      employee_id: empId,
      ...vals,
      overtime_hours: vals.overtime
    }))

    const res = await fetch('/api/payroll/draft', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ month, year, entries }),
    })
    
    setSavingDraft(false)
    if (res.ok) {
      setAlert({ type:'success', msg: 'Draft saved successfully.' })
      loadDraft(month, year, employees)
    } else {
      const data = await res.json()
      setAlert({ type:'error', msg: data.error })
    }
  }

  const reopenPayroll = async () => {
    if (!confirm(`Reopen payroll for ${MONTHS[month-1]} ${year}? This will allow edits.`)) return
    setReopening(true)
    const res = await fetch('/api/payroll/draft', {
      method  : 'PATCH',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ month, year, action: 'reopen' }),
    })
    setReopening(false)
    if (res.ok) {
      setIsLocked(false)
      setAlert({ type:'success', msg: 'Payroll reopened for editing.' })
    }
  }

  const runPayroll = async () => {
    setRunning(true)
    setAlert(null)

    const res = await fetch('/api/payroll/run', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ month, year, late_mark_slab: slab }),
    })

    const data = await res.json()
    setRunning(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    
    setAlert({ type:'success', msg: data.message })
    setIsLocked(true)
    loadPayroll(month, year)
    loadDraft(month, year, employees)
    setShowInputs(false)
  }

  const round = n => Math.round(n * 100) / 100
  const fmt = n => '₹' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2
  })
  const fmt0 = n => '₹' + Number(n).toLocaleString('en-IN')

  const totalGross = payroll.reduce((s,p) => s + Number(p.gross_salary), 0)
  const totalNet   = payroll.reduce((s,p) => s + Number(p.net_salary),   0)
  const totalInc   = payroll.reduce((s,p) => s + Number(p.incentive||0), 0)
  const totalOT    = payroll.reduce((s,p) => s + Number(p.overtime_amount||0), 0)

  const columns = [
    { field: 'incentive', label: 'Incentive (₹)',  sub: 'Adds to gross',     green: true,  type: 'amount' },
    { field: 'overtime',  label: 'Overtime (hrs)', sub: 'Auto-calculates pay', green: true,  type: 'hours'  },
    { field: 'loan',      label: 'Loan Recovery (₹)', sub: 'Deducted',        green: false, type: 'amount' },
    { field: 'advance',   label: 'Advance Recovery (₹)', sub: 'Deducted',     green: false, type: 'amount' },
  ]

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-sub">Run and review monthly payroll</p>
        </div>
        <div className="flex gap-8 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width:130 }}>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width:90 }}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={slab} onChange={e => setSlab(Number(e.target.value))} style={{ width:160 }}>
            {LATE_SLABS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <button className="btn btn-outline" onClick={() => setShowInputs(s => !s)}>
            {showInputs ? 'Hide Inputs' : '⚙ Variable Pay'}
          </button>
          <button 
            className="btn btn-primary" 
            onClick={runPayroll} 
            disabled={running || isLocked}
            style={{ opacity: isLocked ? 0.5 : 1 }}
          >
            {isLocked ? '🔒 Payroll Locked' : running ? 'Processing...' : '▶ Run Payroll'}
          </button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Lock Banner */}
      {isLocked && (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'12px 20px', background:'#ECFDF3', border:'1px solid #A9EFC5',
          borderRadius:10, marginBottom:20,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#12B76A' }} />
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#027A48' }}>
                Payroll Finalized — {MONTHS[month-1]} {year}
              </div>
              <div style={{ fontSize:12, color:'#039855', marginTop:1 }}>
                Locked. No further edits allowed. Payslips and salary sheet are ready.
              </div>
            </div>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={reopenPayroll}
            disabled={reopening}
            style={{ color:'#B42318', borderColor:'#FECDCA', background:'#fff' }}
          >
            {reopening ? 'Reopening...' : '🔓 Reopen'}
          </button>
        </div>
      )}

      {/* Variable pay inputs */}
      {showInputs && employees.length > 0 && (
        <div className="card" style={{ marginBottom:20 }}>
          <div className="card-header flex items-center justify-between">
            <div>
              <span className="card-title">Variable Pay Inputs — {MONTHS[month-1]} {year}</span>
              <div className="text-muted" style={{ fontSize:12 }}>
                {isLocked ? 'View only mode' : 'Changes are saved as a draft'}
              </div>
            </div>
            {!isLocked && (
              <button className="btn btn-primary btn-sm" onClick={saveDraft} disabled={savingDraft}>
                {savingDraft ? 'Saving...' : '💾 Save Draft'}
              </button>
            )}
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
              <colgroup>
                <col style={{ width:'28%' }} />
                <col style={{ width:'18%' }} />
                <col style={{ width:'18%' }} />
                <col style={{ width:'18%' }} />
                <col style={{ width:'18%' }} />
              </colgroup>
              <thead>
                <tr style={{ background:'var(--bg)' }}>
                  <th style={thStyle('left')}>Employee</th>
                  {columns.map(col => (
                    <th key={col.field} style={thStyle('center')}>
                      <span style={{ color: col.green ? '#027A48' : '#B42318' }}>{col.label}</span>
                      <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:400, marginTop:2 }}>{col.sub}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map(emp => {
                  const vals = overrides[emp.id] || {}
                  const ls   = loanSummary[emp.id] || {}

                  const totalCTC     = Number(emp.basic_salary||0) + Number(emp.hra||0) + Number(emp.cca||0) +
                                       Number(emp.conveyance||0) + Number(emp.allowances||0)
                  const hourlyRate   = (totalCTC / 30) / 9
                  const otPreview    = round(hourlyRate * (vals.overtime || 0))

                  return (
                    <tr key={emp.id} style={{ borderBottom:'1px solid var(--border-light)' }}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ fontWeight:500, fontSize:13.5 }}>{emp.name}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{emp.emp_code} · {emp.department}</div>
                        <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:2 }}>₹{round(hourlyRate)}/hr</div>
                      </td>
                      {columns.map(({ field, green, type }) => {
                        const autoFilled = field === 'loan' ? ls.loan_monthly_recovery > 0 :
                                          field === 'advance' ? ls.advance_monthly > 0 : false

                        return (
                          <td key={field} style={{ padding:'10px 16px', textAlign:'center' }}>
                            <input
                              type="number" min="0" step={type === 'hours' ? '0.5' : '1'}
                              value={vals[field] || ''} placeholder={type === 'hours' ? '0 hrs' : '0'}
                              onChange={e => onOverride(emp.id, field, e.target.value)}
                              disabled={isLocked}
                              style={{
                                width:'100%', height:38, textAlign:'right', fontFamily:'DM Mono, monospace', fontSize:13,
                                borderColor: green ? '#A9EFC5' : autoFilled ? '#B2DDFF' : 'var(--border)',
                                background : green ? '#F6FEF9' : autoFilled ? '#EFF8FF' : '#fff',
                                display:'block', margin:'0 auto',
                                opacity: isLocked ? 0.6 : 1,
                                pointerEvents: isLocked ? 'none' : 'auto',
                              }}
                            />
                            <div style={{ fontSize:10, marginTop:3, textAlign:'center' }}>
                              {field === 'overtime' && vals.overtime > 0 && (
                                <span style={{ color:'#027A48', fontWeight:600 }}>= ₹{otPreview}</span>
                              )}
                              {field === 'loan' && ls.loan_balance > 0 && (
                                <span style={{ color:'#F04438' }}>Balance: {fmt0(ls.loan_balance)}{autoFilled && <span style={{ color:'#2E90FA' }}> · Auto</span>}</span>
                              )}
                              {field === 'advance' && ls.advance_balance > 0 && (
                                <span style={{ color:'#F79009' }}>Balance: {fmt0(ls.advance_balance)}{autoFilled && <span style={{ color:'#2E90FA' }}> · Auto</span>}</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary strip */}
      {payroll.length > 0 && (
        <div className="flex gap-12" style={{ marginBottom:20 }}>
          <div className="card stat-card" style={{ flex:1, padding:'16px 20px' }}>
            <div className="stat-label">Employees</div>
            <div className="stat-value" style={{ fontSize:22 }}>{payroll.length}</div>
          </div>
          <div className="card stat-card" style={{ flex:1, padding:'16px 20px' }}>
            <div className="stat-label">Total Gross</div>
            <div className="stat-value" style={{ fontSize:18 }}>{fmt(totalGross)}</div>
          </div>
          {totalOT > 0 && (
            <div className="card stat-card" style={{ flex:1, padding:'16px 20px' }}>
              <div className="stat-label">Total Overtime</div>
              <div className="stat-value" style={{ fontSize:18, color:'#027A48' }}>{fmt(totalOT)}</div>
            </div>
          )}
          {totalInc > 0 && (
            <div className="card stat-card" style={{ flex:1, padding:'16px 20px', borderTop:'3px solid #12B76A' }}>
              <div className="stat-label">Total Incentive</div>
              <div className="stat-value" style={{ fontSize:18, color:'#12B76A' }}>{fmt(totalInc)}</div>
            </div>
          )}
          <div className="card stat-card stat-accent" style={{ flex:1, padding:'16px 20px' }}>
            <div className="stat-label">Total Net Payroll</div>
            <div className="stat-value" style={{ fontSize:18 }}>{fmt(totalNet)}</div>
          </div>
        </div>
      )}

      {/* Draft status banner */}
      {draftLoaded && !isLocked && payroll.length > 0 && (
        <div style={{
          display      : 'flex',
          alignItems   : 'center',
          gap          : 10,
          padding      : '10px 16px',
          background   : '#EFF8FF',
          border       : '1px solid #B2DDFF',
          borderRadius : 8,
          marginBottom : 16,
          fontSize     : 13,
        }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#2E90FA', flexShrink:0 }} />
          <div>
            <span style={{ fontWeight:600, color:'#1849A9' }}>Draft values saved.</span>
            <span style={{ color:'#3538CD', marginLeft:6 }}>
              OT hours and incentives are saved but not yet applied to payroll. Click <strong>Run Payroll</strong> to finalize.
            </span>
          </div>
        </div>
      )}

      {/* Payroll table */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">{MONTHS[month-1]} {year} · Payroll Register</span>
          {payroll.length > 0 && <span className="badge badge-green">{payroll.length} records</span>}
        </div>
        <div className="table-wrap">
          {payroll.length === 0 ? (
            <div className="empty-state"><strong>No payroll run yet</strong><p>Select month and click Run Payroll.</p></div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Gross</th>
                  <th style={{ color:'#027A48' }}>OT Hrs</th>
                  <th style={{ color:'#027A48' }}>OT Pay</th>
                  <th style={{ color:'#027A48' }}>Incentive</th>
                  <th>PF</th>
                  <th>ESIC</th>
                  <th>PT</th>
                  <th>Net Salary</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payroll.map(p => {
                  const draft         = draftMap[p.employee_id] || {}
                  const draftOTHours  = Number(draft.overtime_hours || 0)
                  const draftOTPay    = Number(p.overtime_amount    || 0)
                  const draftIncentive= Number(draft.incentive      || 0)

                  const emp           = employees.find(e => e.id === p.employee_id)
                  const totalCTC      = emp
                    ? Number(emp.basic_salary||0) + Number(emp.hra||0) +
                      Number(emp.cca||0) + Number(emp.conveyance||0) +
                      Number(emp.allowances||0)
                    : 0
                  const hourlyRate    = (totalCTC / 30) / 9
                  const otPreview     = draftOTHours > 0 && draftOTPay === 0
                    ? Math.round(hourlyRate * draftOTHours * 100) / 100
                    : draftOTPay

                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight:500 }}>{p.employees?.name || '—'}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{p.employees?.emp_code} · {p.employees?.department}</div>
                      </td>
                      <td className="mono">{fmt(p.gross_salary)}</td>
                      <td className="mono" style={{ color: draftOTHours > 0 ? '#027A48' : 'var(--text-muted)' }}>
                        {draftOTHours > 0 ? (
                          <div>
                            {draftOTHours}h
                            {draftOTPay === 0 && <div style={{ fontSize:10, color:'#2E90FA' }}>Draft</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="mono" style={{ color: otPreview > 0 ? '#027A48' : 'var(--text-muted)' }}>
                        {otPreview > 0 ? (
                          <div>
                            {fmt(otPreview)}
                            {draftOTPay === 0 && draftOTHours > 0 && <div style={{ fontSize:10, color:'#2E90FA' }}>Preview</div>}
                          </div>
                        ) : '—'}
                      </td>
                      <td className="mono" style={{
                        color: draftIncentive > 0 ? '#027A48' : Number(p.incentive) > 0 ? '#027A48' : 'var(--text-muted)'
                      }}>
                        {draftIncentive > 0 ? (
                          <div>
                            {fmt(draftIncentive)}
                            {Number(p.incentive) === 0 && <div style={{ fontSize:10, color:'#2E90FA' }}>Draft</div>}
                          </div>
                        ) : Number(p.incentive) > 0 ? fmt(p.incentive) : '—'}
                      </td>
                      <td className="mono">{fmt(p.pf_deduction)}</td>
                      <td className="mono">{fmt(p.esic_deduction)}</td>
                      <td className="mono">{fmt(p.pt_deduction)}</td>
                      <td className="mono" style={{ fontWeight:700, color:'var(--success)' }}>{fmt(p.net_salary)}</td>
                      <td>
                        <Link href={`/payslip/${p.employee_id}?month=${month}&year=${year}`}
                          style={{ fontSize:12, fontWeight:600, color:'var(--accent)', textDecoration:'none' }}>View →</Link>
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

const thStyle = (align = 'right') => ({
  padding:'10px 16px', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
  letterSpacing:'0.06em', borderBottom:'1px solid var(--border)', textAlign:align, background:'var(--bg)',
  whiteSpace:'nowrap',
})
