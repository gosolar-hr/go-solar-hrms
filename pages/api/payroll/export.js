import { supabaseAdmin } from '../../../lib/supabase'
import ExcelJS          from 'exceljs'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { month, year } = req.query
  if (!month || !year) return res.status(400).json({ error: 'month and year required' })

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  const monthLabel = MONTHS[parseInt(month) - 1]

  // ── Fetch payroll ─────────────────────────────────────
  const { data: records, error } = await supabaseAdmin
    .from('payroll')
    .select(`
      *,
      employees (
        emp_code, name, designation, department,
        date_of_joining, basic_salary, hra, cca,
        conveyance, allowances, gender
      )
    `)
    .eq('month', parseInt(month))
    .eq('year',  parseInt(year))
    .order('created_at')

  if (error)           return res.status(500).json({ error: error.message })
  if (!records?.length) return res.status(404).json({ error: 'No payroll data found' })

  // ── Fetch attendance ──────────────────────────────────
  const { data: attendanceList } = await supabaseAdmin
    .from('attendance')
    .select('employee_id, present_days, leaves, late_marks')
    .eq('month', parseInt(month))
    .eq('year',  parseInt(year))

  const attendanceMap = {}
  ;(attendanceList || []).forEach(a => { attendanceMap[a.employee_id] = a })

  // ── Workbook ──────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Go Solar HRMS'
  wb.created = new Date()
  const ws  = wb.addWorksheet(`Salary Sheet ${monthLabel} ${year}`)

  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()

  // ── Colour palette ────────────────────────────────────
  const C = {
    headerBg : 'FF101828',  // dark navy   — employee info
    attendBg : 'FF1D4ED8',  // blue        — attendance
    masterBg : 'FF6B21A8',  // purple      — master salary
    earnedBg : 'FF027A48',  // green       — monthly earning
    deductBg : 'FFB42318',  // red         — deductions
    netBg    : 'FFEA6A05',  // orange      — net salary
    white    : 'FFFFFFFF',
    border   : 'FFD0D5DD',
  }

  const fill  = (argb) => ({ type:'pattern', pattern:'solid', fgColor:{ argb } })
  const font  = (argb, bold=true, size=9) => ({ bold, color:{ argb }, size, name:'Arial' })
  const bord  = { top:{style:'thin',color:{argb:C.border}}, left:{style:'thin',color:{argb:C.border}},
                  bottom:{style:'thin',color:{argb:C.border}}, right:{style:'thin',color:{argb:C.border}} }

  // ── Column definitions ────────────────────────────────
  // Each: { header, section, width, isNum, isCurrency }
  const COLS = [
    // Employee info
    { h:'SR NO',         s:'info',   w:6  },
    { h:'NAME',          s:'info',   w:22 },
    // Attendance
    { h:'REG\nPAY DAYS', s:'attend', w:8,  isNum:true },
    { h:'ABSENT\nDAYS',  s:'attend', w:8,  isNum:true },
    { h:'OT\nDAYS',      s:'attend', w:7,  isNum:true },
    { h:'WO\nELIGIBLE',  s:'attend', w:8,  isNum:true },
    { h:'PAY\nDAY',      s:'attend', w:7,  isNum:true },
    { h:'OT\nHOURS',     s:'attend', w:7,  isNum:true },
    // Master Salary (fixed CTC)
    { h:'BASIC+DA',      s:'master', w:10, isCurrency:true },
    { h:'HRA',           s:'master', w:9,  isCurrency:true },
    { h:'CONVEYANCE',    s:'master', w:10, isCurrency:true },
    { h:'CCA',           s:'master', w:9,  isCurrency:true },
    { h:'OTHER\nALLOW',  s:'master', w:10, isCurrency:true },
    { h:'GROSS\nSALARY', s:'master', w:11, isCurrency:true },
    // Monthly Earning (prorated + OT)
    { h:'BASIC+DA',      s:'earned', w:10, isCurrency:true },
    { h:'HRA',           s:'earned', w:9,  isCurrency:true },
    { h:'CONVEYANCE',    s:'earned', w:10, isCurrency:true },
    { h:'CCA',           s:'earned', w:9,  isCurrency:true },
    { h:'OTHER\nALLOW',  s:'earned', w:10, isCurrency:true },
    { h:'OT\nPAY',       s:'earned', w:10, isCurrency:true },
    { h:'INCENTIVE',     s:'earned', w:10, isCurrency:true },
    { h:'GROSS\nSALARY', s:'earned', w:11, isCurrency:true },
    // Deductions
    { h:'PF',            s:'deduct', w:9,  isCurrency:true },
    { h:'ESIC',          s:'deduct', w:9,  isCurrency:true },
    { h:'PT',            s:'deduct', w:7,  isCurrency:true },
    { h:'MLWF',          s:'deduct', w:7,  isCurrency:true },
    { h:'OTHER\nDED',    s:'deduct', w:9,  isCurrency:true },
    { h:'LOAN &\nADV',   s:'deduct', w:10, isCurrency:true },
    { h:'TOTAL\nDED',    s:'deduct', w:11, isCurrency:true },
    // Net
    { h:'NET\nSALARY',   s:'net',    w:12, isCurrency:true },
  ]

  const NCOLS     = COLS.length  // 30
  const lastColL  = ws.getColumn(NCOLS).letter  // gets 'AD'

  const sectionColor = {
    info   : C.headerBg,
    attend : C.attendBg,
    master : C.masterBg,
    earned : C.earnedBg,
    deduct : C.deductBg,
    net    : C.netBg,
  }

  // ── Row 1: Company title ──────────────────────────────
  ws.mergeCells(`A1:AD1`)
  const r1 = ws.getCell('A1')
  r1.value     = 'GO SOLAR SOLUTIONS — Warrington Renewsol Pvt. Ltd'
  r1.font      = { bold:true, size:13, name:'Arial', color:{ argb:'FF101828' } }
  r1.alignment = { horizontal:'center', vertical:'middle' }
  ws.getRow(1).height = 22

  // ── Row 2: Month title ────────────────────────────────
  ws.mergeCells(`A2:AD2`)
  const r2 = ws.getCell('A2')
  r2.value     = `SALARY SHEET — ${monthLabel.toUpperCase()} ${year}`
  r2.font      = { bold:true, size:11, name:'Arial', color:{ argb:'FFEA6A05' } }
  r2.alignment = { horizontal:'center', vertical:'middle' }
  ws.getRow(2).height = 18

  // ── Row 3: Section group header ───────────────────────
  // Group spans: info(A-B), attend(C-H), master(I-N), earned(O-V), deduct(W-AC), net(AD)
  const groups = [
    { label:'EMPLOYEE INFO',   from:'A', to:'B',  color: C.headerBg },
    { label:'ATTENDANCE',      from:'C', to:'H',  color: C.attendBg },
    { label:'MASTER SALARY',   from:'I', to:'N',  color: C.masterBg },
    { label:'MONTHLY EARNING', from:'O', to:'V',  color: C.earnedBg },
    { label:'DEDUCTIONS',      from:'W', to:'AC', color: C.deductBg },
    { label:'NET',             from:'AD',to:'AD', color: C.netBg    },
  ]

  groups.forEach(g => {
    ws.mergeCells(`${g.from}3:${g.to}3`)
    const cell = ws.getCell(`${g.from}3`)
    cell.value     = g.label
    cell.fill      = fill(g.color)
    cell.font      = font(C.white, true, 9)
    cell.alignment = { horizontal:'center', vertical:'middle' }
    cell.border    = bord
  })
  ws.getRow(3).height = 16

  // ── Row 4: Column headers ─────────────────────────────
  const headerRow = ws.addRow(COLS.map(c => c.h))
  headerRow.eachCell((cell, colNum) => {
    const col = COLS[colNum - 1]
    cell.fill      = fill(sectionColor[col.s])
    cell.font      = font(C.white, true, 8)
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
    cell.border    = bord
  })
  ws.getRow(4).height = 30

  // ── Set column widths ─────────────────────────────────
  COLS.forEach((col, i) => {
    ws.getColumn(i + 1).width = col.w
  })

  // ── Data rows ─────────────────────────────────────────
  const dataStartRow = 5

  // Accumulate totals
  const totals = new Array(NCOLS).fill(0)

  records.forEach((r, idx) => {
    const e = r.employees || {}

    // Attendance
    const att      = attendanceMap[r.employee_id] || {}
    const lwpDays  = Number(att.leaves       || 0)
    const paidDays = Math.max(0, daysInMonth - lwpDays)
    const otHours  = Number(r.overtime_hours || 0)

    // Master salary (fixed CTC)
    const mBasic = Number(e.basic_salary || 0)
    const mHRA   = Number(e.hra          || 0)
    const mConv  = Number(e.conveyance   || 0)
    const mCCA   = Number(e.cca          || 0)
    const mAllow = Number(e.allowances   || 0)
    const mGross = mBasic + mHRA + mConv + mCCA + mAllow

    // Monthly earning (prorated)
    const fullGross  = mGross
    const earnedCTC  = Number(r.gross_salary || 0)
                     - Number(r.overtime_amount || 0)
                     - Number(r.incentive || 0)
    const ratio      = fullGross > 0 ? earnedCTC / fullGross : 0

    const eBasic = Math.round(mBasic * ratio)
    const eHRA   = Math.round(mHRA   * ratio)
    const eConv  = Math.round(mConv  * ratio)
    const eCCA   = Math.round(mCCA   * ratio)
    const eAllow = Math.round(mAllow * ratio)
    const eOT    = Number(r.overtime_amount || 0)
    const eInc   = Number(r.incentive       || 0)
    const eGross = Number(r.gross_salary    || 0)

    // Deductions
    const pf       = Number(r.pf_deduction    || 0)
    const esic     = Number(r.esic_deduction  || 0)
    const pt       = Number(r.pt_deduction    || 0)
    const mlwf     = 0
    const otherDed = Number(r.other_deductions || 0)
    const loanAdv  = Number(r.loan || 0) + Number(r.advance || 0)
    const totalDed = pf + esic + pt + mlwf + otherDed + loanAdv
    const net      = Number(r.net_salary || 0)

    const rowData = [
      idx + 1,    // SR NO
      e.name || '—',
      paidDays,   // REG PAY DAYS
      lwpDays,    // ABSENT DAYS
      0,          // OT DAYS (not tracked as day count)
      0,          // WO ELIGIBLE
      paidDays,   // PAY DAY
      otHours,    // OT HOURS
      mBasic, mHRA, mConv, mCCA, mAllow, mGross,      // MASTER SALARY
      eBasic, eHRA, eConv, eCCA, eAllow, eOT, eInc, eGross, // MONTHLY EARNING
      pf, esic, pt, mlwf, otherDed, loanAdv, totalDed,       // DEDUCTIONS
      net,
    ]

    const row = ws.addRow(rowData)

    const isEven = idx % 2 === 0
    const rowBg  = isEven ? 'FFFFFFFF' : 'FFF8FAFC'

    row.eachCell((cell, colNum) => {
      const col = COLS[colNum - 1]
      cell.border = bord
      cell.fill   = { type:'pattern', pattern:'solid', fgColor:{ argb: rowBg } }
      cell.font   = { color:{ argb:'FF344054' }, size:9, name:'Arial' }

      if (col.isCurrency) {
        cell.numFmt    = '#,##0.00'
        cell.alignment = { horizontal:'right', vertical:'middle' }
        // Accumulate totals for numeric cols
        totals[colNum - 1] += Number(cell.value) || 0
      } else if (col.isNum) {
        cell.numFmt    = '#,##0.##'
        cell.alignment = { horizontal:'center', vertical:'middle' }
        if (colNum >= 3) totals[colNum - 1] += Number(cell.value) || 0
      } else {
        cell.alignment = { vertical:'middle', wrapText: colNum === 2 }
      }

      // Highlight absent days red
      if (colNum === 4 && lwpDays > 0) {
        cell.font = { bold:true, color:{ argb:'FFF04438' }, size:9, name:'Arial' }
      }
      // Master gross — bold purple
      if (colNum === 14) {
        cell.font = { bold:true, color:{ argb:'FF6B21A8' }, size:9, name:'Arial' }
      }
      // Earned gross — bold green
      if (colNum === 22) {
        cell.font = { bold:true, color:{ argb:'FF027A48' }, size:9, name:'Arial' }
      }
      // Net salary — bold orange
      if (colNum === 30) {
        cell.font = { bold:true, color:{ argb:'FFEA6A05' }, size:9, name:'Arial' }
      }
      // Total deductions — bold red
      if (colNum === 29) {
        cell.font = { bold:true, color:{ argb:'FFB42318' }, size:9, name:'Arial' }
      }
    })

    row.height = 18
  })

  // ── Totals row ────────────────────────────────────────
  const totalRowData = COLS.map((col, i) => {
    if (i === 0) return 'TOTAL'
    if (i === 1) return `${records.length} Employees`
    if (col.isCurrency || col.isNum) return totals[i]
    return ''
  })

  const totalRow = ws.addRow(totalRowData)
  totalRow.eachCell((cell, colNum) => {
    const col = COLS[colNum - 1]
    cell.fill   = fill(C.headerBg)
    cell.font   = font(C.white, true, 9)
    cell.border = bord

    if (col.isCurrency) {
      cell.numFmt    = '#,##0.00'
      cell.alignment = { horizontal:'right', vertical:'middle' }
    } else if (col.isNum) {
      cell.numFmt    = '#,##0.##'
      cell.alignment = { horizontal:'center', vertical:'middle' }
    } else {
      cell.alignment = { vertical:'middle' }
    }

    // Highlight key totals
    if (colNum === 14) cell.font = font('FFDA8FFF', true, 9)  // master gross
    if (colNum === 22) cell.font = font('FF6EE7B7', true, 9)  // earned gross
    if (colNum === 30) cell.font = font('FFFED7AA', true, 9)  // net salary
  })
  totalRow.height = 20

  // ── Freeze panes: freeze employee name + scroll right ─
  ws.views = [{ state:'frozen', xSplit:2, ySplit:4 }]

  // ── Stream response ───────────────────────────────────
  const filename = `SalarySheet_${monthLabel}_${year}.xlsx`
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  await wb.xlsx.write(res)
  res.end()
}
