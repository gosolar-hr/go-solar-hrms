import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun',
                'Jul','Aug','Sep','Oct','Nov','Dec']

export default function Dashboard() {
  const now   = new Date()
  const month = now.getMonth() + 1
  const year  = now.getFullYear()

  const [employees, setEmployees] = useState([])
  const [payroll,   setPayroll]   = useState([])
  const [amcAlerts, setAmcAlerts] = useState(null)
  const [birthdays, setBirthdays] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch(`/api/payroll?month=${month}&year=${year}`).then(r => r.json()),
      fetch('/api/amc/alerts').then(r => r.json()),
      fetch('/api/employees/birthdays').then(r => r.json()),
    ]).then(([emp, pay, amc, bdays]) => {
      setEmployees(Array.isArray(emp) ? emp.filter(e => e.is_active) : [])
      setPayroll(Array.isArray(pay) ? pay : [])
      setAmcAlerts(amc)
      setBirthdays(Array.isArray(bdays) ? bdays : [])
      setLoading(false)
    })
  }, [])

  const totalGross  = payroll.reduce((s,p) => s + Number(p.gross_salary),  0)
  const totalNet    = payroll.reduce((s,p) => s + Number(p.net_salary),    0)
  const totalPF     = payroll.reduce((s,p) => s + Number(p.pf_deduction),  0)

  const fmt = n => '₹' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2
  })

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-sub">
          {MONTHS[month-1]} {year} · Go Solar Solutions
        </p>
      </div>

      {loading ? <p className="text-muted">Loading...</p> : (
        <>
          <div className="stats-grid">
            <div className="card stat-card stat-accent">
              <div className="stat-label">Active Employees</div>
              <div className="stat-value">{employees.length}</div>
              <div className="stat-hint">Total headcount</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Gross Payroll</div>
              <div className="stat-value" style={{ fontSize:20 }}>
                {payroll.length > 0 ? fmt(totalGross) : '—'}
              </div>
              <div className="stat-hint">
                {payroll.length > 0 ? 'This month' : 'Payroll not run yet'}
              </div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">Net Payroll</div>
              <div className="stat-value" style={{ fontSize:20 }}>
                {payroll.length > 0 ? fmt(totalNet) : '—'}
              </div>
              <div className="stat-hint">After all deductions</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">PF Contribution</div>
              <div className="stat-value" style={{ fontSize:20 }}>
                {payroll.length > 0 ? fmt(totalPF) : '—'}
              </div>
              <div className="stat-hint">Employee share</div>
            </div>
            {amcAlerts && (
              <Link href="/amc" style={{ textDecoration:'none' }}>
                <div className="card stat-card" style={{ borderTop:'3px solid #F04438' }}>
                  <div className="stat-label">O&M Alerts</div>
                  <div className="stat-value" style={{ color:'#F04438' }}>
                    {amcAlerts.counts?.expired || 0}
                  </div>
                  <div className="stat-hint">Expired AMC contracts</div>
                </div>
              </Link>
            )}
          </div>

          {/* ── Birthday Reminders ── */}
          {(() => {
            const todayBdays   = birthdays.filter(b => b.is_today)
            const weekBdays    = birthdays.filter(b => b.is_this_week && !b.is_today)
            const monthBdays   = birthdays.filter(b => b.is_this_month && !b.is_today && !b.is_this_week)
            const hasAny       = todayBdays.length > 0 || weekBdays.length > 0 || monthBdays.length > 0
            if (!hasAny) return null

            const MONTHS_FULL  = ['January','February','March','April','May','June',
                                  'July','August','September','October','November','December']

            const fmtBday = (emp) => {
              const m = MONTHS_FULL[emp.dob_month - 1]
              const d = emp.dob_day
              const suffix = d === 1||d===21||d===31 ? 'st' : d===2||d===22 ? 'nd' : d===3||d===23 ? 'rd' : 'th'
              return `${d}${suffix} ${m}`
            }

            return (
              <div className="card" style={{ marginBottom:20, overflow:'hidden' }}>
                <div style={{ background:'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)',
                  padding:'14px 20px', display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:22 }}>🎂</span>
                  <div>
                    <div style={{ fontWeight:700, color:'#fff', fontSize:15 }}>
                      Birthday Reminders
                    </div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.85)' }}>
                      {todayBdays.length > 0
                        ? `${todayBdays.length} birthday${todayBdays.length>1?'s':''} today! 🎉`
                        : `Upcoming in ${MONTHS_FULL[month-1]}`}
                    </div>
                  </div>
                </div>

                <div style={{ padding:'16px 20px' }}>

                  {/* Today */}
                  {todayBdays.length > 0 && (
                    <div style={{ marginBottom: weekBdays.length||monthBdays.length ? 16 : 0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#FF6B6B',
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                        🎉 Today
                      </div>
                      {todayBdays.map(emp => (
                        <div key={emp.id} style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'10px 14px', borderRadius:10, marginBottom:8,
                          background:'linear-gradient(135deg, #FFF5F5 0%, #FFF0E8 100%)',
                          border:'1.5px solid #FFD0B5',
                        }}>
                          <div style={{ width:40, height:40, borderRadius:'50%',
                            background:'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                            display:'flex', alignItems:'center', justifyContent:'center',
                            fontSize:18, flexShrink:0 }}>
                            🎂
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:700, fontSize:14, color:'#1D2939' }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize:12, color:'#667085' }}>
                              {emp.designation || emp.department || '—'}
                              {emp.emp_code ? ` · ${emp.emp_code}` : ''}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:20, fontWeight:800,
                              color:'#FF6B6B', lineHeight:1 }}>
                              {emp.age}
                            </div>
                            <div style={{ fontSize:10, color:'#FF8E53',
                              fontWeight:600, textTransform:'uppercase' }}>
                              years old
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* This week */}
                  {weekBdays.length > 0 && (
                    <div style={{ marginBottom: monthBdays.length ? 16 : 0 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:'#F79009',
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                        📅 This Week
                      </div>
                      {weekBdays.map(emp => (
                        <div key={emp.id} style={{
                          display:'flex', alignItems:'center', gap:12,
                          padding:'9px 14px', borderRadius:10, marginBottom:6,
                          background:'#FFFAEB', border:'1px solid #FEF0C7',
                        }}>
                          <div style={{ width:34, height:34, borderRadius:'50%',
                            background:'#FEF0C7', display:'flex', alignItems:'center',
                            justifyContent:'center', fontSize:16, flexShrink:0 }}>
                            🎈
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:13, color:'#1D2939' }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize:11, color:'#667085' }}>
                              {emp.designation || '—'}
                            </div>
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <div style={{ fontSize:12, fontWeight:600, color:'#B54708' }}>
                              {fmtBday(emp)}
                            </div>
                            <div style={{ fontSize:11, color:'#F79009' }}>
                              in {emp.days_until} day{emp.days_until !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rest of this month */}
                  {monthBdays.length > 0 && (
                    <div>
                      <div style={{ fontSize:11, fontWeight:700, color:'#667085',
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                        🗓 Later This Month
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                        {monthBdays.map(emp => (
                          <div key={emp.id} style={{
                            display:'flex', alignItems:'center', gap:8,
                            padding:'7px 12px', borderRadius:20,
                            background:'#F8F9FB', border:'1px solid #E4E7EC',
                          }}>
                            <span style={{ fontSize:14 }}>🎂</span>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600,
                                color:'#344054' }}>
                                {emp.name.split(' ')[0]}
                              </div>
                              <div style={{ fontSize:10, color:'#667085' }}>
                                {fmtBday(emp)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )
          })()}

          {/* Payroll table */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">
                Payroll Summary — {MONTHS[month-1]} {year}
              </span>
              {payroll.length > 0
                ? <span className="badge badge-green">{payroll.length} processed</span>
                : <span className="badge badge-orange">Not run yet</span>
              }
            </div>
            <div className="table-wrap">
              {payroll.length === 0 ? (
                <div className="empty-state">
                  <strong>No payroll run for {MONTHS[month-1]} {year}</strong>
                  <p>Go to Payroll → Run Payroll to process this month.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Department</th>
                      <th>Gross</th>
                      <th>PF</th>
                      <th>ESIC</th>
                      <th>PT</th>
                      <th>TDS</th>
                      <th>Net Salary</th>
                      <th>Payslip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payroll.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight:500 }}>
                          <div>{p.employees?.name || '—'}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {p.employees?.emp_code}
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-gray">
                            {p.employees?.department || '—'}
                          </span>
                        </td>
                        <td className="mono">{fmt(p.gross_salary)}</td>
                        <td className="mono">{fmt(p.pf_deduction)}</td>
                        <td className="mono">{fmt(p.esic_deduction)}</td>
                        <td className="mono">{fmt(p.pt_deduction)}</td>
                        <td className="mono">{fmt(p.tds_deduction)}</td>
                        <td className="mono" style={{ fontWeight:700, color:'var(--success)' }}>
                          {fmt(p.net_salary)}
                        </td>
                        <td>
                          <Link
                            href={`/payslip/${p.employee_id}?month=${month}&year=${year}`}
                            style={{ fontSize:12, fontWeight:600,
                              color:'var(--accent)', textDecoration:'none' }}
                          >
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}
