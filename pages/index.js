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
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/employees').then(r => r.json()),
      fetch(`/api/payroll?month=${month}&year=${year}`).then(r => r.json()),
    ]).then(([emp, pay]) => {
      setEmployees(Array.isArray(emp) ? emp.filter(e => e.is_active) : [])
      setPayroll(Array.isArray(pay) ? pay : [])
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
          </div>

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
