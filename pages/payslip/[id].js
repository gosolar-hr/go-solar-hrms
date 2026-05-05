import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

export default function Payslip() {
  const router = useRouter()
  const { id, month, year } = router.query

  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!id || !month || !year) return
    fetch(`/api/payroll?month=${month}&year=${year}`)
      .then(r => r.json())
      .then(records => {
        const record = records.find(r => r.employee_id === id)
        if (!record) return setError('Payslip not found.')
        setData(record)
        setLoading(false)
      })
      .catch(() => setError('Failed to load payslip.'))
  }, [id, month, year])

  if (loading && !error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', fontFamily:'DM Sans, sans-serif', color:'#98A2B3' }}>
      Loading payslip...
    </div>
  )
  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', fontFamily:'DM Sans, sans-serif', color:'#F04438' }}>
      {error}
    </div>
  )

  const emp         = data.employees
  const monthLabel  = MONTHS[Number(month) - 1]
  const WORKING_DAYS = 30

  // Salary components — Full (CTC) values
  const fullBasic      = Number(emp.basic_salary)
  const fullHRA        = Number(emp.hra)
  const fullCCA        = Number(emp.cca        || 0)
  const fullConv       = Number(emp.conveyance  || 0)
  const fullAllowances = Number(emp.allowances  || 0)
  const fullGross      = fullBasic + fullHRA + fullCCA + fullConv + fullAllowances

  // Actual (earned) values from payroll
  const actualGross    = Number(data.gross_salary)
  const pf             = Number(data.pf_deduction)
  const esic           = Number(data.esic_deduction)
  const pt             = Number(data.pt_deduction)
  const tds            = Number(data.tds_deduction)
  const loan           = Number(data.loan      || 0)
  const advance        = Number(data.advance   || 0)
  const incentive      = Number(data.incentive || 0)
  const otherDeductions = Number(data.other_deductions || 0)
  const totalDeduct    = pf + esic + pt + tds + loan + advance + otherDeductions
  const netSalary      = Number(data.net_salary)

  // Present days + LOP from attendance
  const presentDays    = data.present_days || WORKING_DAYS
  const lop            = Math.max(0, WORKING_DAYS - presentDays)

  // Actual earnings per component (prorated)
  const ratio          = presentDays / WORKING_DAYS
  const actualBasic    = Math.round(fullBasic      * ratio)
  const actualHRA      = Math.round(fullHRA        * ratio)
  const actualCCA      = Math.round(fullCCA        * ratio)
  const actualConv     = Math.round(fullConv       * ratio)
  const actualAllow    = Math.round(fullAllowances * ratio)

  const fmt  = n => '₹' + Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  })
  const fmt0 = n => '₹' + Number(n).toLocaleString('en-IN')

  function toWords(n) {
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight',
      'Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
      'Seventeen','Eighteen','Nineteen']
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']
    if (n === 0) return 'Zero'
    const convert = x => {
      if (x < 20)  return ones[x]
      if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '')
      return ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' '+convert(x%100) : '')
    }
    let num = Math.floor(n), result = ''
    if (num >= 100000) { result += convert(Math.floor(num/100000)) + ' Lakh ';    num %= 100000 }
    if (num >= 1000)   { result += convert(Math.floor(num/1000))   + ' Thousand '; num %= 1000  }
    if (num > 0)       { result += convert(num) }
    return result.trim() + ' Only'
  }

  const overtimeAmount = Number(data.overtime_amount || 0)
  const overtimeHours  = Number(data.overtime_hours  || 0)

  const earnings = [
    { label: 'Basic',                     full: fullBasic,      actual: actualBasic    },
    { label: 'House Rent Allowance (HRA)',     full: fullHRA,        actual: actualHRA      },
    { label: 'City Compensatory (CCA)',        full: fullCCA,        actual: actualCCA      },
    { label: 'Conveyance',                     full: fullConv,       actual: actualConv     },
    { label: 'Other Allowances',               full: fullAllowances, actual: actualAllow    },
    ...(overtimeAmount > 0 ? [{
      label  : `Overtime (${overtimeHours} hrs)`,
      full   : overtimeAmount,
      actual : overtimeAmount,
      isBonus: true,
    }] : []),
    ...(incentive > 0 ? [{
      label  : 'Incentive',
      full   : incentive,
      actual : incentive,
      isBonus: true,
    }] : []),
  ].filter(e => e.full > 0)

  const deductions = [
    { label: 'Provident Fund (PF)', amount: pf   },
    { label: 'ESIC',                amount: esic  },
    { label: 'Professional Tax',    amount: pt    },
    { label: 'Income Tax (TDS)',    amount: tds   },
    // Other Deductions — shown only if > 0
    ...(otherDeductions > 0 ? [{
      label  : 'Other Deductions (Absent/Late)',
      amount : otherDeductions,
      isOther: true,
    }] : []),
    ...(loan    > 0 ? [{ label: 'Loan Recovery',    amount: loan    }] : []),
    ...(advance > 0 ? [{ label: 'Advance Recovery', amount: advance }] : []),
  ].filter(d => d.amount > 0)

  // Pad rows so earnings and deductions align
  const maxRows = Math.max(earnings.length, deductions.length)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }
        body {
          font-family: 'DM Sans', sans-serif;
          background: #F8F9FB;
          color: #101828;
          -webkit-font-smoothing: antialiased;
          font-size: 13px;
        }

        /* Action bar */
        .action-bar {
          max-width: 820px; margin: 32px auto 16px;
          display: flex; gap: 10px; justify-content: flex-end;
        }
        .btn {
          display: inline-flex; align-items: center; gap:6px;
          padding: 0 18px; height: 38px; border-radius: 8px;
          font-size: 13.5px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer; border: none; transition: all 0.15s;
        }
        .btn-primary { background:#F97316; color:#fff; }
        .btn-primary:hover { background:#EA6A05; }
        .btn-outline { background:#fff; color:#101828; border:1px solid #E4E7EC; }
        .btn-outline:hover { background:#F8F9FB; }

        /* Slip wrap */
        .slip-wrap {
          max-width: 820px; margin: 0 auto 40px;
          background: #fff;
          border: 1px solid #E4E7EC;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(16,24,40,0.08);
        }

        /* Company header */
        .slip-header {
          background: #101828; color: #fff;
          padding: 24px 32px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .company-logo-area { display: flex; align-items: center; gap: 12px; }
        .company-dot {
          width: 36px; height: 36px; border-radius: 8px;
          background: #F97316;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 800; color: #fff;
        }
        .company-name { font-size: 17px; font-weight: 700; }
        .company-sub  { font-size: 11px; color: #98A2B3; margin-top: 2px; }
        .slip-title-box { text-align: right; }
        .slip-title { font-size: 15px; font-weight: 600; color: #fff; }
        .slip-month { font-size: 20px; font-weight: 700; color: #F97316; margin-top: 2px; }

        /* Info grid */
        .info-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          border-bottom: 1px solid #E4E7EC;
        }
        .info-col {
          padding: 16px 32px;
          display: grid; grid-template-columns: auto 1fr; gap: 6px 20px;
          align-content: start;
        }
        .info-col:first-child { border-right: 1px solid #E4E7EC; }
        .info-label { font-size: 11px; color: #98A2B3; font-weight: 500; white-space: nowrap; }
        .info-value { font-size: 12.5px; color: #101828; font-weight: 500; }

        /* Work days strip */
        .days-strip {
          display: grid; grid-template-columns: repeat(4,1fr);
          background: #F8F9FB;
          border-bottom: 1px solid #E4E7EC;
        }
        .day-cell {
          padding: 12px 32px;
          border-right: 1px solid #E4E7EC;
        }
        .day-cell:last-child { border-right: none; }
        .day-label { font-size: 10px; color: #98A2B3; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em; }
        .day-value { font-size: 20px; font-weight: 700; color: #101828;
          font-family: 'DM Mono', monospace; margin-top: 4px; }
        .day-value.accent { color: #F97316; }
        .day-value.red    { color: #F04438; }

        /* Salary table */
        .salary-section { padding: 0 32px 24px; }
        .salary-table {
          width: 100%; border-collapse: collapse; margin-top: 20px;
        }
        .salary-table th {
          background: #F8F9FB;
          padding: 10px 12px;
          font-size: 10px; font-weight: 700; color: #475467;
          text-transform: uppercase; letter-spacing: 0.07em;
          border: 1px solid #E4E7EC;
          text-align: left;
        }
        .salary-table th.right { text-align: right; }
        .salary-table td {
          padding: 10px 12px;
          font-size: 12.5px; color: #101828;
          border: 1px solid #F2F4F7;
          vertical-align: middle;
        }
        .salary-table td.mono {
          font-family: 'DM Mono', monospace;
          font-size: 12px; text-align: right;
        }
        .salary-table td.label { color: #475467; }
        .salary-table td.deduct { color: #F04438; font-family:'DM Mono',monospace;
          font-size:12px; text-align:right; }
        .total-row td {
          background: #F8F9FB; font-weight: 700;
          border-top: 2px solid #E4E7EC;
        }
        .divider-col {
          width: 12px; background: #F8F9FB;
          border-top: 1px solid #E4E7EC !important;
          border-bottom: 1px solid #E4E7EC !important;
          border-left: none !important; border-right: none !important;
        }

        /* Net pay box */
        .net-box {
          margin: 0 32px 24px;
          background: #101828; border-radius: 10px;
          padding: 18px 24px;
          display: flex; justify-content: space-between; align-items: center;
        }
        .net-label { font-size: 11px; color: #98A2B3; text-transform: uppercase;
          letter-spacing: 0.06em; margin-bottom: 4px; }
        .net-amount { font-size: 26px; font-weight: 700; color: #F97316;
          font-family: 'DM Mono', monospace; }
        .net-words { text-align: right; }
        .net-words-label { font-size: 11px; color: #98A2B3; margin-bottom: 2px; }
        .net-words-value { font-size: 12px; color: #fff; font-weight: 500;
          max-width: 380px; line-height: 1.5; }

        /* Footer */
        .slip-footer {
          border-top: 1px solid #E4E7EC;
          padding: 14px 32px;
          display: flex; justify-content: space-between; align-items: center;
          background: #F8F9FB;
        }
        .slip-footer-note { font-size: 11px; color: #98A2B3; }
        .slip-footer-sign { font-size: 11px; color: #98A2B3; text-align: right; }

        /* Print */
        @media print {
          * { -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important; }
          body { background: #fff; }
          .action-bar { display: none !important; }
          .slip-wrap { margin: 0; box-shadow: none; border-radius: 0; border: none; }
        }
      `}</style>

      {/* Action bar */}
      <div className="action-bar">
        <button className="btn btn-outline" onClick={() => router.back()}>← Back</button>
        <button className="btn btn-primary" onClick={() => {
          alert('In print dialog:\n✅ Enable "Background graphics" for colors.')
          window.print()
        }}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="slip-wrap">

        {/* Header */}
        <div className="slip-header">
          <div className="company-logo-area">
            <div className="company-dot">G</div>
            <div>
              <div className="company-name">Go Solar Solutions</div>
              <div className="company-sub">Warrington Renewsol Pvt. Ltd · Maharashtra</div>
            </div>
          </div>
          <div className="slip-title-box">
            <div className="slip-title">PAYSLIP FOR THE MONTH OF</div>
            <div className="slip-month">{monthLabel.toUpperCase()} {year}</div>
          </div>
        </div>

        {/* Employee info grid */}
        <div className="info-grid">
          <div className="info-col">
            <span className="info-label">Employee Name</span>
            <span className="info-value">{emp.name}</span>
            <span className="info-label">Designation</span>
            <span className="info-value">{emp.designation || '—'}</span>
            <span className="info-label">Department</span>
            <span className="info-value">{emp.department || '—'}</span>
            <span className="info-label">Date of Joining</span>
            <span className="info-value">
              {new Date(emp.date_of_joining).toLocaleDateString('en-IN', {
                day:'2-digit', month:'short', year:'numeric'
              })}
            </span>
          </div>
          <div className="info-col">
            <span className="info-label">Employee No.</span>
            <span className="info-value">{emp.emp_code || '—'}</span>
            <span className="info-label">Bank Account No.</span>
            <span className="info-value">{emp.bank_account || 'PENDING'}</span>
            <span className="info-label">PAN Number</span>
            <span className="info-value">{emp.pan || 'PENDING'}</span>
            <span className="info-label">PF UAN</span>
            <span className="info-value">{emp.uan_number || 'PENDING'}</span>
          </div>
        </div>

        {/* Work days strip */}
        <div className="days-strip">
          <div className="day-cell">
            <div className="day-label">Days in Month</div>
            <div className="day-value">{WORKING_DAYS}</div>
          </div>
          <div className="day-cell">
            <div className="day-label">Effective Work Days</div>
            <div className="day-value accent">{presentDays}</div>
          </div>
          <div className="day-cell">
            <div className="day-label">LWP Days</div>
            <div className="day-value red">{lop}</div>
          </div>
          <div className="day-cell">
            <div className="day-label">Late Marks</div>
            <div className="day-value">{data.late_marks || 0}</div>
          </div>
        </div>

        {/* Salary table */}
        <div className="salary-section">
          <table className="salary-table">
            <thead>
              <tr>
                <th style={{ width:'30%' }}>Earnings</th>
                <th className="right" style={{ width:'15%' }}>Full Amount</th>
                <th className="right" style={{ width:'15%' }}>Actual Amount</th>
                <th className="divider-col"></th>
                <th style={{ width:'25%' }}>Deductions</th>
                <th className="right" style={{ width:'15%' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxRows }).map((_, i) => {
                const earn   = earnings[i]
                const deduct = deductions[i]
                return (
                  <tr key={i}>
                    <td className="label" style={{
                      color: earn?.isBonus ? '#027A48' : '' }}>
                      {earn ? earn.label : ''}
                      {earn?.isBonus && (
                        <span style={{ marginLeft:6, fontSize:10, fontWeight:700,
                          background:'#ECFDF3', color:'#027A48',
                          padding:'1px 6px', borderRadius:10 }}>
                          Variable
                        </span>
                      )}
                    </td>
                    <td className="mono" style={{
                      color: earn?.isBonus ? '#027A48' : '' }}>
                      {earn ? fmt0(earn.full) : ''}
                    </td>
                    <td className="mono" style={{
                      color: earn?.isBonus ? '#027A48' : '' }}>
                      {earn ? fmt0(earn.actual) : ''}
                    </td>
                    <td className="divider-col"></td>
                    <td className="label" style={{
                      color: deduct?.isOther ? '#F79009' : '' }}>
                      {deduct ? deduct.label : ''}
                    </td>
                    <td className="deduct" style={{
                      color: deduct?.isOther ? '#F79009' : '' }}>
                      {deduct ? fmt0(deduct.amount) : ''}
                    </td>
                  </tr>
                )
              })}
              {/* Totals row */}
              <tr className="total-row">
                <td>Total Earnings</td>
                <td className="mono">{fmt0(fullGross)}</td>
                <td className="mono">{fmt0(actualGross)}</td>
                <td className="divider-col"></td>
                <td>Total Deductions</td>
                <td className="deduct">{fmt0(totalDeduct)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net pay */}
        <div className="net-box">
          <div>
            <div className="net-label">Net Salary Payable</div>
            <div className="net-amount">{fmt(netSalary)}</div>
          </div>
          <div className="net-words">
            <div className="net-words-label">Amount in Words</div>
            <div className="net-words-value">{toWords(Math.round(netSalary))}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="slip-footer">
          <div className="slip-footer-note">
            This is a system-generated payslip and does not require a signature.
          </div>
          <div className="slip-footer-sign">
            Go Solar Solutions · Warrington Renewsol Pvt. Ltd
          </div>
        </div>

      </div>
    </>
  )
}
