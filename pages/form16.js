import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'

const FY_OPTIONS = ['2024-25', '2023-24', '2022-23', '2021-22']

export default function Form16() {
  const [employees,  setEmployees]  = useState([])
  const [empId,      setEmpId]      = useState('')
  const [fy,         setFY]         = useState('2024-25')
  const [form16,     setForm16]     = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [alert,      setAlert]      = useState(null)
  const printRef = useRef()

  useEffect(() => {
    fetch('/api/form16').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setEmployees(d)
    })
  }, [])

  const generate = async () => {
    if (!empId) return setAlert({ type:'error', msg:'Please select an employee.' })
    setLoading(true)
    setForm16(null)
    const res  = await fetch(`/api/form16?employee_id=${empId}&fy=${fy}`)
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert(null)
    setForm16(data)
  }

  const handlePrint = () => {
    const content = printRef.current.innerHTML
    const win     = window.open('', '_blank')
    win.document.write(`
      <!DOCTYPE html><html><head>
      <title>Form 16 - ${form16?.employee?.name} - ${form16?.period?.fy}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Times New Roman', serif; font-size: 12px; color: #000; background: #fff; }
        .f16-wrap { max-width: 720px; margin: 0 auto; padding: 24px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
        .center { text-align: center; }
        .right { text-align: right; }
        .bold { font-weight: bold; }
        .title-row td { text-align: center; font-weight: bold; font-size: 14px; }
        .section-head td { background: #f0f0f0; font-weight: bold; }
        .no-border { border: none !important; }
        .amt { text-align: right; font-family: monospace; }
        .signature-block { margin-top: 24px; }
        @page { size: A4; margin: 15mm; }
        @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
      </style>
      </head><body><div class="f16-wrap">${content}</div></body></html>
    `)
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 500)
  }

  const fmtAmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const s      = form16?.summary   || {}
  const emp    = form16?.employee  || {}
  const er     = form16?.employer  || {}
  const period = form16?.period    || {}

  return (
    <Layout>
      <div className="page-header">
        <div>
          <h1 className="page-title">Form 16 Generator</h1>
          <p className="page-subtitle">Generate TDS certificate u/s 203 — Income Tax Act 1961</p>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom:16 }}>
          {alert.msg}
        </div>
      )}

      {/* Controls */}
      <div className="card" style={{ marginBottom:24 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:16, alignItems:'end' }}>
          <div className="form-group" style={{ margin:0 }}>
            <label>Employee</label>
            <select value={empId} onChange={e => setEmpId(e.target.value)}>
              <option value="">Select employee…</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} {e.emp_code ? `(${e.emp_code})` : ''} {!e.pan ? '⚠ No PAN' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin:0 }}>
            <label>Financial Year</label>
            <select value={fy} onChange={e => setFY(e.target.value)}>
              {FY_OPTIONS.map(f => <option key={f} value={f}>FY {f}</option>)}
            </select>
          </div>
          <button className="btn btn-primary" onClick={generate} disabled={loading || !empId}>
            {loading ? 'Generating…' : 'Generate Form 16'}
          </button>
        </div>
        {empId && employees.find(e => e.id === empId) && !employees.find(e => e.id === empId)?.pan && (
          <div style={{ marginTop:12, padding:'8px 12px', background:'#FFFAEB',
            border:'1px solid #FEF0C7', borderRadius:6, fontSize:12, color:'#B54708' }}>
            ⚠ This employee has no PAN on record. Update it in the employee profile before issuing Form 16.
          </div>
        )}
      </div>

      {/* Form 16 Document */}
      {form16 && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Toolbar */}
          <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)',
            display:'flex', alignItems:'center', justifyContent:'space-between',
            background:'var(--surface)' }}>
            <div style={{ fontSize:13, fontWeight:500 }}>
              Form 16 — {emp.name} — {period.fy}
            </div>
            <button className="btn btn-primary btn-sm" onClick={handlePrint}>
              🖨 Print / Save PDF
            </button>
          </div>

          {/* The actual Form 16 document */}
          <div ref={printRef} style={{ padding:'28px 32px', background:'#fff',
            fontFamily:"'Times New Roman', serif", fontSize:12, color:'#000', lineHeight:1.5 }}>

            {/* Header */}
            <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:0 }}>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ border:'1px solid #000', textAlign:'center',
                    fontWeight:'bold', fontSize:14, padding:'8px' }}>
                    FORM NO. 16 [See rule 31(1)(a)]
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border:'1px solid #000', textAlign:'center',
                    padding:'4px 8px', fontSize:11 }}>
                    Certificate under section 203 of the Income-tax Act, 1961 for tax deducted at source on salary
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Employer + Employee side by side */}
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'8px', width:'50%',
                    verticalAlign:'top', borderTop:'none' }}>
                    <div style={{ fontWeight:'bold', marginBottom:4 }}>Details of Employer</div>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', width:120, fontSize:11 }}>Name of Employer</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{er.full_name}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>Address</td>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>{er.address}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>PAN</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{er.pan}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>TAN</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{er.tan}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td style={{ border:'1px solid #000', padding:'8px', width:'50%',
                    verticalAlign:'top', borderTop:'none', borderLeft:'none' }}>
                    <div style={{ fontWeight:'bold', marginBottom:4 }}>Details of Employee</div>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <tbody>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', width:120, fontSize:11 }}>Name of Employee</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{emp.name}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>PAN</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{emp.pan}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>Period with Employer</td>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>{period.from} to {period.to}</td>
                        </tr>
                        <tr>
                          <td style={{ border:'none', padding:'2px 0', fontSize:11 }}>Assessment Year</td>
                          <td style={{ border:'none', padding:'2px 0', fontWeight:'bold', fontSize:11 }}>{period.assessment_year}</td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Part B heading */}
            <table style={{ width:'100%', borderCollapse:'collapse', marginTop:16 }}>
              <tbody>
                <tr>
                  <td colSpan={2} style={{ border:'1px solid #000', background:'#f0f0f0',
                    fontWeight:'bold', padding:'5px 8px', textAlign:'center' }}>
                    Part B (Annexure)
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border:'1px solid #000', padding:'4px 8px',
                    textAlign:'center', fontSize:11, borderTop:'none' }}>
                    Details of salary paid and any other income and tax deducted
                  </td>
                </tr>

                {/* Column headers */}
                <tr style={{ background:'#f8f8f8' }}>
                  <td style={{ border:'1px solid #000', fontWeight:'bold', padding:'5px 8px', borderTop:'none' }}>
                    Particulars
                  </td>
                  <td style={{ border:'1px solid #000', fontWeight:'bold', padding:'5px 8px',
                    textAlign:'right', borderTop:'none', borderLeft:'none', width:160 }}>
                    Amount (Rs.)
                  </td>
                </tr>

                {/* Salary section */}
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none' }}>
                    Salary as per section 17(1)
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.gross_salary_17_1)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none' }}>
                    Value of perquisites u/s 17(2)
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(0)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none' }}>
                    Profits in lieu of salary u/s 17(3)
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(0)}
                  </td>
                </tr>
                <tr style={{ background:'#f8f8f8' }}>
                  <td style={{ border:'1px solid #000', padding:'5px 8px',
                    fontWeight:'bold', borderTop:'none' }}>
                    Gross Salary
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', fontWeight:'bold', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.gross_salary_total)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none', paddingLeft:20 }}>
                    Less: Standard Deduction u/s 16(ia)
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.standard_deduction)}
                  </td>
                </tr>
                <tr style={{ background:'#f8f8f8' }}>
                  <td style={{ border:'1px solid #000', padding:'5px 8px',
                    fontWeight:'bold', borderTop:'none' }}>
                    Income chargeable under the head 'Salaries'
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', fontWeight:'bold', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.income_under_salary)}
                  </td>
                </tr>

                {/* Deductions VI-A */}
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none' }}>
                    Deductions under Chapter VI-A (80C, 80D, etc.)
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.deductions_vi_a)}
                  </td>
                </tr>
                <tr style={{ background:'#f8f8f8' }}>
                  <td style={{ border:'1px solid #000', padding:'5px 8px',
                    fontWeight:'bold', borderTop:'none' }}>
                    Total Income
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', fontWeight:'bold', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.total_income)}
                  </td>
                </tr>

                {/* Tax computation */}
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none' }}>
                    Tax on Total Income
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.tax_on_income)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', borderTop:'none', paddingLeft:20 }}>
                    Add: Health and Education Cess @ 4%
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.health_edu_cess)}
                  </td>
                </tr>
                <tr style={{ background:'#f8f8f8' }}>
                  <td style={{ border:'1px solid #000', padding:'5px 8px',
                    fontWeight:'bold', borderTop:'none' }}>
                    Tax Payable
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', fontWeight:'bold', borderTop:'none', borderLeft:'none' }}>
                    {fmtAmt(s.tax_payable)}
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', fontWeight:'bold',
                    borderTop:'none', background: s.tds_deducted > 0 ? '#F0FDF9' : '#fff' }}>
                    Tax Deducted at Source
                  </td>
                  <td style={{ border:'1px solid #000', padding:'5px 8px', textAlign:'right',
                    fontFamily:'monospace', fontWeight:'bold', borderTop:'none', borderLeft:'none',
                    background: s.tds_deducted > 0 ? '#F0FDF9' : '#fff' }}>
                    {fmtAmt(s.tds_deducted)}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Verification */}
            <table style={{ width:'100%', borderCollapse:'collapse', marginTop:0 }}>
              <tbody>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'10px 8px', borderTop:'none',
                    fontSize:11, lineHeight:1.7 }}>
                    <strong>Verification</strong><br/>
                    I, _____________, working in the capacity of _____________, do hereby certify that the
                    information given above is true, complete, and correct and is based on the books of account,
                    documents, TDS statements, TDS deposited and other available records.
                  </td>
                </tr>
                <tr>
                  <td style={{ border:'1px solid #000', padding:'16px 8px', borderTop:'none' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end' }}>
                      <div style={{ fontSize:11 }}>
                        <div>Place: _________________________</div>
                        <div style={{ marginTop:8 }}>Date: __________________________</div>
                      </div>
                      <div style={{ textAlign:'right', fontSize:11 }}>
                        <div style={{ marginBottom:24 }}>Signature of the person responsible for</div>
                        <div>deduction of tax at source</div>
                        <div style={{ marginTop:4 }}>Full Name: _______________________</div>
                        <div style={{ marginTop:4 }}>Designation: ____________________</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Monthly breakdown (for internal reference — not part of official Form 16) */}
            {form16.breakdown && form16.breakdown.some(m => m.gross_salary > 0) && (
              <div style={{ marginTop:24 }}>
                <div style={{ fontWeight:'bold', fontSize:12, marginBottom:8, borderBottom:'2px solid #000',
                  paddingBottom:4 }}>
                  Monthly Salary Breakdown (Internal Reference — Not Part of Form 16)
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'#f0f0f0' }}>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'left' }}>Month</th>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right' }}>Gross Salary</th>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right' }}>PF Deducted</th>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right' }}>ESIC</th>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right' }}>PT</th>
                      <th style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right' }}>Net Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form16.breakdown.map((m, i) => (
                      <tr key={i} style={{ background: m.gross_salary === 0 ? '#fafafa' : '#fff' }}>
                        <td style={{ border:'1px solid #000', padding:'3px 6px',
                          color: m.gross_salary === 0 ? '#aaa' : '#000' }}>
                          {m.month_label}
                        </td>
                        <td style={{ border:'1px solid #000', padding:'3px 6px', textAlign:'right',
                          fontFamily:'monospace', color: m.gross_salary === 0 ? '#aaa' : '#000' }}>
                          {m.gross_salary === 0 ? '—' : fmtAmt(m.gross_salary)}
                        </td>
                        <td style={{ border:'1px solid #000', padding:'3px 6px', textAlign:'right',
                          fontFamily:'monospace' }}>{m.pf_deduction > 0 ? fmtAmt(m.pf_deduction) : '—'}</td>
                        <td style={{ border:'1px solid #000', padding:'3px 6px', textAlign:'right',
                          fontFamily:'monospace' }}>{m.esic_deduction > 0 ? fmtAmt(m.esic_deduction) : '—'}</td>
                        <td style={{ border:'1px solid #000', padding:'3px 6px', textAlign:'right',
                          fontFamily:'monospace' }}>{m.pt_deduction > 0 ? fmtAmt(m.pt_deduction) : '—'}</td>
                        <td style={{ border:'1px solid #000', padding:'3px 6px', textAlign:'right',
                          fontFamily:'monospace', color: m.gross_salary === 0 ? '#aaa' : '#000' }}>
                          {m.net_salary === 0 ? '—' : fmtAmt(m.net_salary)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    <tr style={{ background:'#f0f0f0', fontWeight:'bold' }}>
                      <td style={{ border:'1px solid #000', padding:'4px 6px' }}>Total</td>
                      <td style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right',
                        fontFamily:'monospace' }}>
                        {fmtAmt(form16.breakdown.reduce((s,m) => s + m.gross_salary, 0))}
                      </td>
                      <td style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right',
                        fontFamily:'monospace' }}>
                        {fmtAmt(form16.breakdown.reduce((s,m) => s + m.pf_deduction, 0))}
                      </td>
                      <td style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right',
                        fontFamily:'monospace' }}>
                        {fmtAmt(form16.breakdown.reduce((s,m) => s + m.esic_deduction, 0))}
                      </td>
                      <td style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right',
                        fontFamily:'monospace' }}>
                        {fmtAmt(form16.breakdown.reduce((s,m) => s + m.pt_deduction, 0))}
                      </td>
                      <td style={{ border:'1px solid #000', padding:'4px 6px', textAlign:'right',
                        fontFamily:'monospace' }}>
                        {fmtAmt(form16.breakdown.reduce((s,m) => s + m.net_salary, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {!form16 && !loading && (
        <div className="card" style={{ textAlign:'center', padding:'48px 24px',
          color:'var(--text-muted)', fontSize:13 }}>
          Select an employee and financial year, then click Generate Form 16.
        </div>
      )}
    </Layout>
  )
}
