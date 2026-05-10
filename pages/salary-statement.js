import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

export default function SalaryStatement() {
  const now = new Date()
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [year,    setYear]    = useState(now.getFullYear())
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  const load = (m, y) => {
    setLoading(true)
    fetch(`/api/payroll/statement?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => { setRecords(Array.isArray(d) ? d : []); setLoading(false) })
  }

  useEffect(() => { load(month, year) }, [month, year])

  const fmt = n => Number(n || 0).toLocaleString('en-IN')

  // Column totals
  const totals = records.reduce((acc, r) => ({
    basic      : acc.basic       + Number(r.employees?.basic_salary || 0),
    hra        : acc.hra         + Number(r.employees?.hra          || 0),
    cca        : acc.cca         + Number(r.employees?.cca          || 0),
    conv       : acc.conv        + Number(r.employees?.conveyance   || 0),
    allowances : acc.allowances  + Number(r.employees?.allowances   || 0),
    gross      : acc.gross       + Number(r.gross_salary            || 0),
    incentive  : acc.incentive   + Number(r.incentive               || 0),
    ot         : acc.ot          + Number(r.overtime_amount         || 0),
    pf         : acc.pf          + Number(r.pf_deduction            || 0),
    esic       : acc.esic        + Number(r.esic_deduction          || 0),
    pt         : acc.pt          + Number(r.pt_deduction            || 0),
    tds        : acc.tds         + Number(r.tds_deduction           || 0),
    loan       : acc.loan        + Number(r.loan                    || 0),
    advance    : acc.advance     + Number(r.advance                 || 0),
    otherDed   : acc.otherDed    + Number(r.other_deductions        || 0),
    totalDed   : acc.totalDed    + Number(r.pf_deduction||0) + Number(r.esic_deduction||0)
                                 + Number(r.pt_deduction||0) + Number(r.tds_deduction||0)
                                 + Number(r.loan||0) + Number(r.advance||0)
                                 + Number(r.other_deductions||0),
    net        : acc.net         + Number(r.net_salary              || 0),
  }), {
    basic:0, hra:0, cca:0, conv:0, allowances:0, gross:0,
    incentive:0, ot:0, pf:0, esic:0, pt:0, tds:0,
    loan:0, advance:0, otherDed:0, totalDed:0, net:0,
  })

  const onPrint = () => {
    window.print()
  }

  return (
    <Layout>
      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sidebar, .page-header, .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 8px !important; }
          body, .card { font-size: 10px !important; }
          .stmt-wrap { padding: 0 !important; }
          .print-header { display: block !important; }
        }
        .print-header { display: none; }
        .stmt-table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
        .stmt-table th {
          background: #f2f2f2;
          border: 1px solid #999;
          padding: 6px 8px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: center;
        }
        .stmt-table th.left { text-align: left; }
        .stmt-table td {
          border: 1px solid #ccc;
          padding: 6px 8px;
          font-size: 11px;
          font-family: 'Courier New', monospace;
          text-align: right;
        }
        .stmt-table td.left {
          text-align: left;
          font-family: Arial, sans-serif;
        }
        .stmt-table tbody tr:nth-child(even) { background: #fafafa; }
        .stmt-table tbody tr:hover { background: #f5f5f5; }
        .stmt-table tfoot tr td {
          background: #f2f2f2;
          font-weight: 700;
          border-top: 2px solid #333;
          border-bottom: 2px solid #333;
        }
        /* Group header rows */
        .th-group-earn { background: #e8f5e9 !important; color: #1b5e20 !important; }
        .th-group-deduct { background: #fce4ec !important; color: #880e4f !important; }
        .th-group-net { background: #fff3e0 !important; color: #bf360c !important; }
        .td-earn { background: #f9fff9 !important; }
        .td-deduct { background: #fff9fa !important; }
        .td-net { background: #fffdf8 !important; font-weight: 700 !important; }
        .td-gross { font-weight: 700 !important; }
      `}</style>

      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Salary Sheet</h1>
          <p className="page-sub">Monthly Salary Register — Go Solar Solutions</p>
        </div>
        <div className="flex gap-8 items-center no-print">
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width:130 }}>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width:90 }}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <a href={`/api/payroll/export?month=${month}&year=${year}`} download
            className="btn btn-outline no-print"
            style={{ textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
            ⬇ Excel
          </a>
          <button className="btn btn-outline no-print" onClick={onPrint}>🖨 Print</button>
        </div>
      </div>

      {/* Print-only company header */}
      <div className="print-header" style={{ textAlign:'center', marginBottom:12, fontFamily:'Arial, sans-serif' }}>
        <div style={{ fontSize:16, fontWeight:700 }}>Go Solar Solutions</div>
        <div style={{ fontSize:11 }}>Warrington Renewsol Pvt. Ltd · Maharashtra</div>
        <div style={{ fontSize:13, fontWeight:600, marginTop:4 }}>
          Salary Statement for the Month of {MONTHS[month-1]} {year}
        </div>
      </div>

      <div className="card stmt-wrap">
        <div className="card-header no-print">
          <span className="card-title">Salary Statement — {MONTHS[month-1]} {year}</span>
          <span className="badge badge-orange">{records.length} employees</span>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <strong>No payroll data found</strong>
            <p>Run payroll for {MONTHS[month-1]} {year} first.</p>
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table className="stmt-table">
              <thead>
                {/* Group header row */}
                <tr>
                  <th className="left" colSpan={5}>Employee Details</th>
                  <th colSpan={2}>Attendance</th>
                  <th className="th-group-earn" colSpan={8}>Earnings</th>
                  <th className="th-group-deduct" colSpan={7}>Deductions</th>
                  <th className="th-group-net" colSpan={1}>Net Pay</th>
                </tr>
                {/* Column header row */}
                <tr>
                  {/* Employee Details */}
                  <th className="left" style={{ minWidth:36 }}>Sr. No.</th>
                  <th className="left" style={{ minWidth:70 }}>Emp Code</th>
                  <th className="left" style={{ minWidth:160 }}>Employee Name</th>
                  <th className="left" style={{ minWidth:100 }}>Designation</th>
                  <th className="left" style={{ minWidth:80 }}>Join Date</th>
                  {/* Attendance */}
                  <th style={{ minWidth:60 }}>Work Days</th>
                  <th style={{ minWidth:50 }}>LOP</th>
                  {/* Earnings */}
                  <th className="th-group-earn" style={{ minWidth:70 }}>Basic</th>
                  <th className="th-group-earn" style={{ minWidth:60 }}>HRA</th>
                  <th className="th-group-earn" style={{ minWidth:50 }}>CCA</th>
                  <th className="th-group-earn" style={{ minWidth:70 }}>Conveyance</th>
                  <th className="th-group-earn" style={{ minWidth:70 }}>Allowances</th>
                  <th className="th-group-earn" style={{ minWidth:60 }}>OT Amt</th>
                  <th className="th-group-earn" style={{ minWidth:70 }}>Incentive</th>
                  <th className="th-group-earn" style={{ minWidth:80 }}>Gross Earned</th>
                  {/* Deductions */}
                  <th className="th-group-deduct" style={{ minWidth:60 }}>PF</th>
                  <th className="th-group-deduct" style={{ minWidth:60 }}>ESIC</th>
                  <th className="th-group-deduct" style={{ minWidth:50 }}>PT</th>
                  <th className="th-group-deduct" style={{ minWidth:50 }}>TDS</th>
                  <th className="th-group-deduct" style={{ minWidth:60 }}>Loan</th>
                  <th className="th-group-deduct" style={{ minWidth:70 }}>Advance</th>
                  <th className="th-group-deduct" style={{ minWidth:80 }}>Other Ded.</th>
                  {/* Net */}
                  <th className="th-group-net" style={{ minWidth:90 }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const e = r.employees
                  const lop = Math.max(0, 30 - (r.present_days || 30))
                  const totalDed = Number(r.pf_deduction||0) + Number(r.esic_deduction||0)
                                 + Number(r.pt_deduction||0) + Number(r.tds_deduction||0)
                                 + Number(r.loan||0) + Number(r.advance||0)
                                 + Number(r.other_deductions||0)
                  const fullGross = Number(e?.basic_salary||0) + Number(e?.hra||0) + Number(e?.cca||0) + 
                                   Number(e?.conveyance||0) + Number(e?.allowances||0)
                  const earnedCTC = Number(r.gross_salary) - Number(r.overtime_amount||0) - Number(r.incentive||0)
                  const ratio = fullGross > 0 ? earnedCTC / fullGross : 0

                  const earnedBasic = Math.round(Number(e?.basic_salary||0) * ratio)
                  const earnedHRA   = Math.round(Number(e?.hra||0)          * ratio)
                  const earnedCCA   = Math.round(Number(e?.cca||0)          * ratio)
                  const earnedConv  = Math.round(Number(e?.conveyance||0)   * ratio)
                  const earnedAllow = Math.round(Number(e?.allowances||0)   * ratio)

                  return (
                    <tr key={r.id}>
                      {/* Employee Details */}
                      <td className="left" style={{ textAlign:'center' }}>{idx + 1}</td>
                      <td className="left">{e?.emp_code || '—'}</td>
                      <td className="left" style={{ fontWeight:500, fontFamily:'Arial, sans-serif' }}>
                        <Link href={`/payslip/${r.employee_id}?month=${month}&year=${year}`}
                          style={{ color:'#000', textDecoration:'none' }}
                          title="View Payslip">
                          {e?.name}
                        </Link>
                      </td>
                      <td className="left">{e?.designation || '—'}</td>
                      <td className="left">
                        {e?.date_of_joining
                          ? new Date(e.date_of_joining).toLocaleDateString('en-IN',
                              { day:'2-digit', month:'short', year:'numeric' })
                          : '—'}
                      </td>
                      {/* Attendance */}
                      <td>{r.present_days || 30}</td>
                      <td style={{ color: lop > 0 ? '#c00' : '#999' }}>{lop}</td>
                      {/* Earnings — HIGH #8: Show Earned (Prorated) components */}
                      <td className="td-earn">{fmt(earnedBasic)}</td>
                      <td className="td-earn">{fmt(earnedHRA)}</td>
                      <td className="td-earn">{fmt(earnedCCA)}</td>
                      <td className="td-earn">{fmt(earnedConv)}</td>
                      <td className="td-earn">{fmt(earnedAllow)}</td>
                      <td className="td-earn">{fmt(r.overtime_amount || 0)}</td>
                      <td className="td-earn">{fmt(r.incentive      || 0)}</td>
                      <td className="td-earn td-gross">{fmt(r.gross_salary)}</td>
                      {/* Deductions */}
                      <td className="td-deduct">{fmt(r.pf_deduction)}</td>
                      <td className="td-deduct">{fmt(r.esic_deduction)}</td>
                      <td className="td-deduct">{fmt(r.pt_deduction)}</td>
                      <td className="td-deduct">{fmt(r.tds_deduction)}</td>
                      <td className="td-deduct">{fmt(r.loan     || 0)}</td>
                      <td className="td-deduct">{fmt(r.advance  || 0)}</td>
                      <td className="td-deduct">{fmt(r.other_deductions || 0)}</td>
                      {/* Net */}
                      <td className="td-net">{fmt(r.net_salary)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td className="left" colSpan={5} style={{ fontFamily:'Arial, sans-serif', fontWeight:700 }}>
                    TOTAL ({records.length} Employees)
                  </td>
                  <td></td>
                  <td></td>
                  <td>{fmt(totals.basic)}</td>
                  <td>{fmt(totals.hra)}</td>
                  <td>{fmt(totals.cca)}</td>
                  <td>{fmt(totals.conv)}</td>
                  <td>{fmt(totals.allowances)}</td>
                  <td>{fmt(totals.ot)}</td>
                  <td>{fmt(totals.incentive)}</td>
                  <td style={{ fontWeight:700 }}>{fmt(totals.gross)}</td>
                  <td>{fmt(totals.pf)}</td>
                  <td>{fmt(totals.esic)}</td>
                  <td>{fmt(totals.pt)}</td>
                  <td>{fmt(totals.tds)}</td>
                  <td>{fmt(totals.loan)}</td>
                  <td>{fmt(totals.advance)}</td>
                  <td>{fmt(totals.otherDed)}</td>
                  <td style={{ fontWeight:700 }}>{fmt(totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
