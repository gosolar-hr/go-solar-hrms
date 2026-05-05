import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

export default function SalaryStatement() {
  const now = new Date()
  const [month,     setMonth]     = useState(now.getMonth() + 1)
  const [year,      setYear]      = useState(now.getFullYear())
  const [records,   setRecords]   = useState([])
  const [loading,   setLoading]   = useState(false)

  const load = (m, y) => {
    setLoading(true)
    fetch(`/api/payroll/statement?month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => { setRecords(Array.isArray(d) ? d : []); setLoading(false) })
  }

  useEffect(() => { load(month, year) }, [month, year])

  const fmt = n => Number(n).toLocaleString('en-IN')

  // Totals
  const totals = records.reduce((acc, r) => ({
    basic    : acc.basic    + Number(r.employees?.basic_salary || 0),
    hra      : acc.hra      + Number(r.employees?.hra          || 0),
    cca      : acc.cca      + Number(r.employees?.cca          || 0),
    conv     : acc.conv     + Number(r.employees?.conveyance   || 0),
    other    : acc.other    + Number(r.employees?.allowances   || 0),
    gross    : acc.gross    + Number(r.gross_salary),
    incentive: acc.incentive+ Number(r.incentive               || 0),
    pf       : acc.pf       + Number(r.pf_deduction),
    esic     : acc.esic     + Number(r.esic_deduction),
    pt       : acc.pt       + Number(r.pt_deduction),
    tds      : acc.tds      + Number(r.tds_deduction),
    loan     : acc.loan     + Number(r.loan                    || 0),
    advance  : acc.advance  + Number(r.advance                 || 0),
    otherDed : acc.otherDed + Number(r.other_deductions         || 0),
    net      : acc.net      + Number(r.net_salary),
  }), {
    basic:0, hra:0, cca:0, conv:0, other:0, gross:0,
    incentive:0, pf:0, esic:0, pt:0, tds:0, loan:0, advance:0, otherDed:0, net:0
  })

  const onPrint = () => {
    alert('In print dialog:\n✅ Enable "Background graphics"\n✅ Set orientation to Landscape')
    window.print()
  }

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Salary Sheet</h1>
          <p className="page-sub">Monthly PF & Salary Register</p>
        </div>
        <div className="flex gap-8 items-center">
          <select value={month} onChange={e => setMonth(Number(e.target.value))}
            style={{ width:130 }}>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ width:90 }}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {/* Excel Download */}
          <a
            href={`/api/payroll/export?month=${month}&year=${year}`}
            download
            className="btn btn-outline"
            style={{
              textDecoration : 'none',
              display        : 'flex',
              alignItems     : 'center',
              gap            : 6,
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Excel
          </a>

          {/* Print */}
          <button className="btn btn-outline" onClick={onPrint}>
            🖨 Print
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .sidebar, .page-header, .no-print { display: none !important; }
          .main-content { margin-left: 0 !important; padding: 0 !important; }
          body { font-size: 11px; }
          .stmt-table th, .stmt-table td { padding: 6px 8px !important; font-size: 10px !important; }
        }
      `}</style>

      {/* Print header — only shows on print */}
      <div style={{ display:'none' }} className="print-only">
        <div style={{ textAlign:'center', marginBottom: 12 }}>
          <strong style={{ fontSize: 16 }}>Go Solar Solutions</strong><br/>
          <span style={{ fontSize: 12 }}>Warrington Renewsol Pvt. Ltd</span><br/>
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Salary Statement for the Month of {MONTHS[month-1]} {year}
          </span>
        </div>
      </div>

      <div className="card" style={{ overflowX:'auto' }}>
        <div className="card-header">
          <span className="card-title">
            Salary Statement — {MONTHS[month-1]} {year}
          </span>
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
            <table className="stmt-table" style={{
              width:'100%', borderCollapse:'collapse',
              fontSize: 12, whiteSpace:'nowrap'
            }}>
              <thead>
                <tr style={{ background:'#F8F9FB' }}>
                  <th colSpan={4} style={th()}>Employee Details</th>
                  <th colSpan={2} style={th()}>Attendance</th>
                  <th colSpan={7} style={{ ...th(), background:'#ECFDF3', color:'#027A48' }}>Earnings</th>
                  <th colSpan={7} style={{ ...th(), background:'#FEF3F2', color:'#B42318' }}>Deductions</th>
                  <th colSpan={1} style={{ ...th(), background:'#FFF4ED', color:'#EA6A05' }}>Net</th>
                </tr>
                <tr style={{ background:'#F8F9FB' }}>
                  <th style={th('left')}>Emp No</th>
                  <th style={th('left')}>Name</th>
                  <th style={th('left')}>Designation</th>
                  <th style={th('left')}>Join Date</th>
                  <th style={th()}>Days</th>
                  <th style={th()}>LOP</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>Basic</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>HRA</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>CCA</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>Conv.</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>Other Allow.</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>Gross</th>
                  <th style={{ ...th(), background:'#ECFDF3' }}>Incentive</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>PF</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>ESIC</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>PT</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>TDS</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>Loan</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>Advance</th>
                  <th style={{ ...th(), background:'#FEF3F2' }}>Other Ded.</th>
                  <th style={{ ...th(), background:'#FFF4ED' }}>Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, idx) => {
                  const e      = r.employees
                  const lop    = Math.max(0, 30 - (r.present_days || 30))
                  return (
                    <tr key={r.id} style={{ background: idx%2===0 ? '#fff' : '#FAFAFA' }}>
                      <td style={td('left')}>{e?.emp_code || '—'}</td>
                      <td style={{ ...td('left'), fontWeight:500 }}>{e?.name}</td>
                      <td style={td('left')}>{e?.designation || '—'}</td>
                      <td style={td('left')}>
                        {e?.date_of_joining
                          ? new Date(e.date_of_joining).toLocaleDateString('en-IN',
                              { day:'2-digit', month:'short', year:'numeric' })
                          : '—'}
                      </td>
                      <td style={td()}>{r.present_days || 30}</td>
                      <td style={{ ...td(), color: lop > 0 ? '#F04438' : '#98A2B3' }}>{lop}</td>
                      <td style={{ ...td(), background:'#F6FEF9' }}>{fmt(e?.basic_salary || 0)}</td>
                      <td style={{ ...td(), background:'#F6FEF9' }}>{fmt(e?.hra          || 0)}</td>
                      <td style={{ ...td(), background:'#F6FEF9' }}>{fmt(e?.cca          || 0)}</td>
                      <td style={{ ...td(), background:'#F6FEF9' }}>{fmt(e?.conveyance   || 0)}</td>
                      <td style={{ ...td(), background:'#F6FEF9' }}>{fmt(e?.allowances   || 0)}</td>
                      <td style={{ ...td(), background:'#F6FEF9', fontWeight:600 }}>
                        {fmt(r.gross_salary)}
                      </td>
                      <td style={{ ...td(), background:'#F6FEF9', color:'#027A48' }}>
                        {fmt(r.incentive || 0)}
                      </td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.pf_deduction)}</td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.esic_deduction)}</td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.pt_deduction)}</td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.tds_deduction)}</td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.loan     || 0)}</td>
                      <td style={{ ...td(), background:'#FFF5F5' }}>{fmt(r.advance  || 0)}</td>
                      <td style={{ ...td(), background:'#FFF5F5', color:'#F79009' }}>{fmt(r.other_deductions || 0)}</td>
                      <td style={{ ...td(), background:'#FFF9F5', fontWeight:700, color:'#027A48' }}>
                        {fmt(r.net_salary)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Totals row */}
              <tfoot>
                <tr style={{ background:'#101828', color:'#fff', fontWeight:700 }}>
                  <td colSpan={4} style={{ ...td('left'), color:'#fff' }}>TOTAL</td>
                  <td style={td()}></td>
                  <td style={td()}></td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.basic)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.hra)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.cca)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.conv)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.other)}</td>
                  <td style={{ ...td(), color:'#F97316' }}>{fmt(totals.gross)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.incentive)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.pf)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.esic)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.pt)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.tds)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.loan)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.advance)}</td>
                  <td style={{ ...td(), color:'#fff' }}>{fmt(totals.otherDed)}</td>
                  <td style={{ ...td(), color:'#F97316' }}>{fmt(totals.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}

// Style helpers
const th = (align='right') => ({
  padding:'10px 12px', fontSize:10, fontWeight:700,
  color:'#475467', textTransform:'uppercase',
  letterSpacing:'0.06em', border:'1px solid #E4E7EC',
  textAlign: align, whiteSpace:'nowrap',
})
const td = (align='right') => ({
  padding:'10px 12px', fontSize:12,
  border:'1px solid #F2F4F7',
  fontFamily:'DM Mono, monospace',
  textAlign: align,
})
