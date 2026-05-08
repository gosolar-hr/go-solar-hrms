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
      height:'100vh', fontFamily:'Arial, sans-serif', color:'#666' }}>
      Loading payslip...
    </div>
  )
  if (error) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100vh', fontFamily:'Arial, sans-serif', color:'red' }}>
      {error}
    </div>
  )

  const emp        = data.employees
  const monthLabel = MONTHS[Number(month) - 1]
  let WORKING_DAYS = 30

  // Pro-rata for new joiners
  const joining      = new Date(emp.date_of_joining)
  const joiningMonth = joining.getMonth() + 1
  const joiningYear  = joining.getFullYear()
  if (joiningYear === Number(year) && joiningMonth === Number(month)) {
    const daysInMonth = new Date(Number(year), Number(month), 0).getDate()
    WORKING_DAYS      = daysInMonth - joining.getDate() + 1
  }

  // Full (CTC) salary components
  const fullBasic      = Number(emp.basic_salary   || 0)
  const fullHRA        = Number(emp.hra             || 0)
  const fullCCA        = Number(emp.cca             || 0)
  const fullConv       = Number(emp.conveyance      || 0)
  const fullAllowances = Number(emp.allowances      || 0)
  const fullGross      = fullBasic + fullHRA + fullCCA + fullConv + fullAllowances

  // Actual earned values from payroll record
  const actualGross     = Number(data.gross_salary)
  const pf              = Number(data.pf_deduction      || 0)
  const esic            = Number(data.esic_deduction    || 0)
  const pt              = Number(data.pt_deduction      || 0)
  const tds             = Number(data.tds_deduction     || 0)
  const loan            = Number(data.loan              || 0)
  const advance         = Number(data.advance           || 0)
  const incentive       = Number(data.incentive         || 0)
  const otherDeductions = Number(data.other_deductions  || 0)
  const totalDeduct     = pf + esic + pt + tds + loan + advance + otherDeductions
  const netSalary       = Number(data.net_salary)
  const overtimeAmount  = Number(data.overtime_amount   || 0)
  const overtimeHours   = Number(data.overtime_hours    || 0)

  // Attendance
  const presentDays = data.present_days || 0
  const lop         = Math.max(0, WORKING_DAYS - presentDays)

  // Prorated actual per component
  const ratio      = fullGross > 0 ? actualGross / fullGross : 0
  const actualBasic = Math.round(fullBasic      * ratio)
  const actualHRA   = Math.round(fullHRA        * ratio)
  const actualCCA   = Math.round(fullCCA        * ratio)
  const actualConv  = Math.round(fullConv       * ratio)
  const actualAllow = Math.round(fullAllowances * ratio)

  const fmt0 = n => Number(n).toLocaleString('en-IN')

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
    if (num >= 100000) { result += convert(Math.floor(num/100000)) + ' Lakh ';     num %= 100000 }
    if (num >= 1000)   { result += convert(Math.floor(num/1000))   + ' Thousand '; num %= 1000  }
    if (num > 0)       { result += convert(num) }
    return result.trim() + ' Only'
  }

  // Earnings rows — only show non-zero rows
  const earnings = [
    { label: 'BASIC',                  full: fullBasic,      actual: actualBasic  },
    { label: 'HRA',                    full: fullHRA,        actual: actualHRA    },
    { label: 'CCA',                    full: fullCCA,        actual: actualCCA    },
    { label: 'CONVEYANCE',             full: fullConv,       actual: actualConv   },
    { label: 'OTHER ALLOWANCES',       full: fullAllowances, actual: actualAllow  },
    ...(overtimeAmount > 0 ? [{
      label: `OVERTIME (${overtimeHours} HRS)`, full: overtimeAmount, actual: overtimeAmount,
    }] : []),
    ...(incentive > 0 ? [{
      label: 'INCENTIVE', full: incentive, actual: incentive,
    }] : []),
  ].filter(e => e.full > 0)

  // Deduction rows — only show non-zero rows
  const deductions = [
    { label: 'PF',                           amount: pf             },
    { label: 'ESIC',                         amount: esic           },
    { label: 'PROFESSIONAL TAX',             amount: pt             },
    { label: 'INCOME TAX (TDS)',             amount: tds            },
    { label: 'OTHER DEDUCTIONS (ABSENT/LATE)', amount: otherDeductions },
    { label: 'LOAN RECOVERY',               amount: loan           },
    { label: 'ADVANCE RECOVERY',            amount: advance        },
  ].filter(d => d.amount > 0)

  const maxRows = Math.max(earnings.length, deductions.length)

  const borderStyle = '1px solid #000'

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: Arial, Helvetica, sans-serif;
          font-size: 12px;
          color: #000;
          background: #f0f0f0;
        }
        .action-bar {
          max-width: 800px;
          margin: 24px auto 12px;
          display: flex; gap: 8px;
          justify-content: flex-end;
        }
        .btn {
          padding: 7px 18px;
          font-size: 12px;
          font-family: Arial, sans-serif;
          cursor: pointer;
          border-radius: 4px;
          border: 1px solid #ccc;
          background: #fff;
          font-weight: 600;
        }
        .btn-print {
          background: #000;
          color: #fff;
          border-color: #000;
        }
        .slip-wrap {
          max-width: 800px;
          margin: 0 auto 40px;
          background: #fff;
          border: 1px solid #000;
        }
        /* Company header */
        .slip-header {
          border-bottom: 2px solid #000;
          padding: 14px 20px 10px;
          text-align: center;
        }
        .company-name {
          font-size: 18px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .company-addr {
          font-size: 10px;
          color: #333;
          margin-top: 2px;
        }
        .slip-month-title {
          font-size: 13px;
          font-weight: 700;
          margin-top: 6px;
          text-decoration: underline;
          letter-spacing: 0.5px;
        }
        /* Info table */
        .info-table {
          width: 100%;
          border-collapse: collapse;
          border-bottom: 2px solid #000;
        }
        .info-table td {
          padding: 5px 10px;
          font-size: 11.5px;
          vertical-align: top;
          border: 1px solid #ccc;
        }
        .info-label {
          font-weight: 600;
          white-space: nowrap;
          width: 130px;
          color: #222;
        }
        .info-value {
          color: #000;
          min-width: 140px;
        }
        /* Work days strip */
        .days-row {
          display: flex;
          border-bottom: 2px solid #000;
        }
        .day-cell {
          flex: 1;
          padding: 7px 10px;
          border-right: 1px solid #000;
          text-align: center;
        }
        .day-cell:last-child { border-right: none; }
        .day-lbl {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #555;
        }
        .day-val {
          font-size: 18px;
          font-weight: 700;
          color: #000;
          margin-top: 2px;
        }
        /* Salary table */
        .salary-table {
          width: 100%;
          border-collapse: collapse;
        }
        .salary-table th {
          background: #f0f0f0;
          border: 1px solid #000;
          padding: 7px 10px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          text-align: center;
        }
        .salary-table th.left { text-align: left; }
        .salary-table td {
          border: 1px solid #ccc;
          padding: 6px 10px;
          font-size: 11.5px;
          vertical-align: middle;
        }
        .salary-table td.right {
          text-align: right;
          font-family: 'Courier New', monospace;
          font-size: 11.5px;
        }
        .salary-table tr.total-row td {
          background: #f0f0f0;
          font-weight: 700;
          border-top: 2px solid #000;
          border-bottom: 2px solid #000;
        }
        .divider-col {
          width: 10px;
          background: #fff;
          border-left: 2px solid #000 !important;
          border-right: none !important;
        }
        /* Net pay */
        .net-row {
          padding: 10px 20px;
          border-top: 2px solid #000;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 20px;
        }
        .net-amount-box {}
        .net-lbl {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #555;
        }
        .net-amount {
          font-size: 22px;
          font-weight: 700;
          color: #000;
          font-family: 'Courier New', monospace;
          margin-top: 3px;
        }
        .net-words {
          font-size: 11px;
          color: #000;
          margin-top: 6px;
          font-style: italic;
        }
        /* Footer */
        .slip-footer {
          border-top: 1px solid #ccc;
          padding: 8px 20px;
          font-size: 10px;
          color: #555;
          text-align: center;
        }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #fff; }
          .action-bar { display: none !important; }
          .slip-wrap { margin: 0; border: none; }
        }
      `}</style>

      {/* Action bar */}
      <div className="action-bar">
        <button className="btn" onClick={() => router.back()}>← Back</button>
        <button className="btn btn-print" onClick={() => window.print()}>
          🖨 Print / Save PDF
        </button>
      </div>

      <div className="slip-wrap">

        {/* Header */}
        <div className="slip-header">
          <div className="company-name">Go Solar Solutions</div>
          <div className="company-addr">Warrington Renewsol Pvt. Ltd · Maharashtra</div>
          <div className="slip-month-title">
            Payslip for the month of {monthLabel} {year}
          </div>
        </div>

        {/* Employee Info — two columns like reference */}
        <table className="info-table">
          <tbody>
            <tr>
              <td className="info-label">Name</td>
              <td className="info-value">{emp.name}</td>
              <td className="info-label">Employee No</td>
              <td className="info-value">{emp.emp_code || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Joining Date</td>
              <td className="info-value">
                {new Date(emp.date_of_joining).toLocaleDateString('en-IN',
                  { day:'2-digit', month:'short', year:'numeric' })}
              </td>
              <td className="info-label">Bank Name</td>
              <td className="info-value">{emp.bank_name || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Designation</td>
              <td className="info-value">{emp.designation || '—'}</td>
              <td className="info-label">Bank Account No</td>
              <td className="info-value">{emp.bank_account || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Department</td>
              <td className="info-value">{emp.department || '—'}</td>
              <td className="info-label">PAN Number</td>
              <td className="info-value">{emp.pan || '—'}</td>
            </tr>
            <tr>
              <td className="info-label">Location</td>
              <td className="info-value">{emp.location || 'Navi Mumbai'}</td>
              <td className="info-label">PF UAN</td>
              <td className="info-value">{emp.uan_number || '—'}</td>
            </tr>
          </tbody>
        </table>

        {/* Work days strip */}
        <div className="days-row">
          <div className="day-cell">
            <div className="day-lbl">Effective Work Days</div>
            <div className="day-val">{presentDays}</div>
          </div>
          <div className="day-cell">
            <div className="day-lbl">LOP Days</div>
            <div className="day-val">{lop}</div>
          </div>
          <div className="day-cell">
            <div className="day-lbl">Late Marks</div>
            <div className="day-val">{data.late_marks || 0}</div>
          </div>
          <div className="day-cell">
            <div className="day-lbl">Days in Month</div>
            <div className="day-val">{WORKING_DAYS}</div>
          </div>
        </div>

        {/* Earnings + Deductions table */}
        <table className="salary-table">
          <thead>
            <tr>
              <th className="left" style={{ width:'28%' }}>Earnings</th>
              <th style={{ width:'13%' }}>Full</th>
              <th style={{ width:'13%' }}>Actual</th>
              <th className="divider-col"></th>
              <th className="left" style={{ width:'28%' }}>Deductions</th>
              <th style={{ width:'14%' }}>Actual</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxRows }).map((_, i) => {
              const earn   = earnings[i]
              const deduct = deductions[i]
              return (
                <tr key={i}>
                  <td>{earn   ? earn.label   : ''}</td>
                  <td className="right">{earn   ? fmt0(earn.full)     : ''}</td>
                  <td className="right">{earn   ? fmt0(earn.actual)   : ''}</td>
                  <td className="divider-col"></td>
                  <td>{deduct ? deduct.label  : ''}</td>
                  <td className="right">{deduct ? fmt0(deduct.amount) : ''}</td>
                </tr>
              )
            })}
            {/* Totals row */}
            <tr className="total-row">
              <td>Total Earnings: INR.</td>
              <td className="right">{fmt0(fullGross)}</td>
              <td className="right">{fmt0(actualGross)}</td>
              <td className="divider-col"></td>
              <td>Total Deductions: INR.</td>
              <td className="right">{fmt0(totalDeduct)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net Pay */}
        <div className="net-row">
          <div className="net-amount-box">
            <div className="net-lbl">Net Pay for the month (Total Earnings − Total Deductions)</div>
            <div className="net-amount">{fmt0(netSalary)}</div>
          </div>
          <div style={{ textAlign:'right', paddingTop: 4 }}>
            <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase',
              letterSpacing:'0.06em', color:'#555', marginBottom:2 }}>
              Amount in Words
            </div>
            <div style={{ fontSize:11, fontStyle:'italic', maxWidth:320, textAlign:'right' }}>
              ({toWords(Math.round(netSalary))})
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="slip-footer">
          This is a system generated payslip and does not require signature.
        </div>

      </div>
    </>
  )
}
