import { supabaseAdmin } from '../../../lib/supabase'
import ExcelJS          from 'exceljs'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { month, year } = req.query
  if (!month || !year) return res.status(400).json({ error: 'month and year required' })

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  const monthLabel = MONTHS[parseInt(month) - 1]

  // Fetch payroll
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

  if (error) return res.status(500).json({ error: error.message })
  if (!records?.length) return res.status(404).json({ error: 'No payroll data found' })

  // Fetch attendance for LWP/paid days
  const { data: attendanceList } = await supabaseAdmin
    .from('attendance')
    .select('employee_id, present_days, leaves, late_marks')
    .eq('month', parseInt(month))
    .eq('year',  parseInt(year))

  const attendanceMap = {}
  ;(attendanceList || []).forEach(a => { attendanceMap[a.employee_id] = a })

  // ── Build Excel ──────────────────────────────────────
  const wb   = new ExcelJS.Workbook()
  wb.creator = 'Go Solar HRMS'
  wb.created = new Date()
  const ws   = wb.addWorksheet(`Salary Sheet ${monthLabel} ${year}`)

  // ── Styles ───────────────────────────────────────────
  const S = {
    darkFill   : { type:'pattern', pattern:'solid', fgColor:{ argb:'FF101828' } },
    greenFill  : { type:'pattern', pattern:'solid', fgColor:{ argb:'FF027A48' } },
    redFill    : { type:'pattern', pattern:'solid', fgColor:{ argb:'FFB42318' } },
    orangeFill : { type:'pattern', pattern:'solid', fgColor:{ argb:'FFEA6A05' } },
    white      : { bold:true, color:{ argb:'FFFFFFFF' }, size:10, name:'Arial' },
    normal     : { color:{ argb:'FF344054' }, size:10, name:'Arial' },
    border     : {
      top   :{ style:'thin', color:{ argb:'FFE4E7EC' } },
      left  :{ style:'thin', color:{ argb:'FFE4E7EC' } },
      bottom:{ style:'thin', color:{ argb:'FFE4E7EC' } },
      right :{ style:'thin', color:{ argb:'FFE4E7EC' } },
    },
  }

  // Total columns = 22
  const TOTAL_COLS = 'V'

  // ── Row 1: Company ────────────────────────────────────
  ws.mergeCells(`A1:${TOTAL_COLS}1`)
  const t1 = ws.getCell('A1')
  t1.value = 'GO SOLAR SOLUTIONS — Warrington Renewsol Pvt. Ltd'
  t1.font  = { bold:true, size:13, name:'Arial', color:{ argb:'FF101828' } }
  t1.alignment = { horizontal:'center' }
  ws.getRow(1).height = 22

  // ── Row 2: Month ──────────────────────────────────────
  ws.mergeCells(`A2:${TOTAL_COLS}2`)
  const t2 = ws.getCell('A2')
  t2.value = `SALARY SHEET — ${monthLabel.toUpperCase()} ${year}`
  t2.font  = { bold:true, size:11, name:'Arial', color:{ argb:'FFF97316' } }
  t2.alignment = { horizontal:'center' }
  ws.getRow(2).height = 18

  ws.addRow([]) // blank row

  // ── Row 4: Headers ────────────────────────────────────
  const headers = [
    { label:'EMP NO',      fill: S.darkFill  },
    { label:'NAME',        fill: S.darkFill  },
    { label:'DESIGNATION', fill: S.darkFill  },
    { label:'JOIN DATE',   fill: S.darkFill  },
    { label:'DAYS',        fill: S.darkFill  },
    { label:'LWP',         fill: S.darkFill  },
    { label:'BASIC',       fill: S.greenFill },
    { label:'HRA',         fill: S.greenFill },
    { label:'CCA',         fill: S.greenFill },
    { label:'CONV',        fill: S.greenFill },
    { label:'OTHER ALLOW', fill: S.greenFill },
    { label:'INCENTIVE',   fill: S.greenFill },
    { label:'OT PAY',      fill: S.greenFill },
    { label:'GROSS',       fill: S.greenFill },
    { label:'PF',          fill: S.redFill   },
    { label:'ESIC',        fill: S.redFill   },
    { label:'PT',          fill: S.redFill   },
    { label:'LOAN',        fill: S.redFill   },
    { label:'ADVANCE',     fill: S.redFill   },
    { label:'OTHER DED',   fill: S.redFill   },
    { label:'TOTAL DED',   fill: S.redFill   },
    { label:'NET PAY',     fill: S.orangeFill},
  ]

  const headerRow = ws.addRow(headers.map(h => h.label))
  headerRow.eachCell((cell, colNum) => {
    cell.font      = S.white
    cell.fill      = headers[colNum - 1].fill
    cell.border    = S.border
    cell.alignment = { horizontal:'center', vertical:'middle', wrapText:true }
  })
  ws.getRow(4).height = 28

  // ── Data rows ─────────────────────────────────────────
  const dataStartRow = 5

  // FIX: actual days in the payroll month (handles 28/29/31-day months)
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate()

  records.forEach((r, idx) => {
    const e        = r.employees || {}
    const att      = attendanceMap[r.employee_id] || {}
    const lwpDays  = Number(att.leaves || 0)
    // FIX: use actual days in month, not hardcoded 30
    const paidDays = Math.max(0, daysInMonth - lwpDays)

    const loan      = Number(r.loan              || 0)
    const advance   = Number(r.advance           || 0)
    const otherDed  = Number(r.other_deductions  || 0)
    const totalDed  = Number(r.pf_deduction      || 0) +
                      Number(r.esic_deduction    || 0) +
                      Number(r.pt_deduction      || 0) +
                      loan + advance + otherDed

    // FIX: derive prorated (earned) salary components — avoids showing full
    // CTC when employee had LWP days. Same ratio logic as salary-statement.js.
    const fullGross   = Number(e.basic_salary||0) + Number(e.hra||0) +
                        Number(e.cca||0) + Number(e.conveyance||0) + Number(e.allowances||0)
    const earnedCTC   = Number(r.gross_salary||0) - Number(r.overtime_amount||0) - Number(r.incentive||0)
    const ratio       = fullGross > 0 ? earnedCTC / fullGross : 0

    const earnedBasic = Math.round(Number(e.basic_salary||0) * ratio)
    const earnedHRA   = Math.round(Number(e.hra||0)          * ratio)
    const earnedCCA   = Math.round(Number(e.cca||0)          * ratio)
    const earnedConv  = Math.round(Number(e.conveyance||0)   * ratio)
    const earnedAllow = Math.round(Number(e.allowances||0)   * ratio)

    const row = ws.addRow([
      e.emp_code       || '—',
      e.name           || '—',
      e.designation    || '—',
      e.date_of_joining
        ? new Date(e.date_of_joining).toLocaleDateString('en-IN',
            { day:'2-digit', month:'short', year:'numeric' })
        : '—',
      paidDays,        // E — DAYS  (actual days minus LWP)
      lwpDays,         // F — LWP
      earnedBasic,     // G — BASIC (prorated)
      earnedHRA,       // H — HRA   (prorated)
      earnedCCA,       // I — CCA   (prorated)
      earnedConv,      // J — CONV  (prorated)
      earnedAllow,     // K — OTHER ALLOW (prorated)
      Number(r.incentive      || 0),      // L
      Number(r.overtime_amount|| 0),      // M
      Number(r.gross_salary   || 0),      // N
      Number(r.pf_deduction   || 0),      // O
      Number(r.esic_deduction || 0),      // P
      Number(r.pt_deduction   || 0),      // Q
      loan,                               // R — LOAN
      advance,                            // S — ADVANCE
      otherDed,                           // T — OTHER DED
      totalDed,                           // U — TOTAL DED
      Number(r.net_salary     || 0),      // V — NET PAY
    ])

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'

    row.eachCell((cell, colNum) => {
      cell.font   = S.normal
      cell.border = S.border
      cell.fill   = { type:'pattern', pattern:'solid', fgColor:{ argb: rowBg } }

      if (colNum >= 5) {
        cell.alignment = { horizontal:'right', vertical:'middle' }
        if (colNum >= 7) cell.numFmt = '₹#,##0.00'
      } else {
        cell.alignment = { vertical:'middle' }
      }

      // Net pay — bold green
      if (colNum === 22) {
        cell.font = { bold:true, color:{ argb:'FF027A48' }, size:10, name:'Arial' }
      }
      // LWP — red if > 0
      if (colNum === 6 && lwpDays > 0) {
        cell.font = { bold:true, color:{ argb:'FFF04438' }, size:10, name:'Arial' }
      }
      // Loan/Advance/Other — orange if > 0
      if ([18,19,20].includes(colNum) && Number(row.getCell(colNum).value) > 0) {
        cell.font = { bold:true, color:{ argb:'FFB42318' }, size:10, name:'Arial' }
      }
    })
    row.height = 20
  })

  // ── Totals row ────────────────────────────────────────
  const lastDataRow = dataStartRow + records.length - 1
  const colLetters  = ['G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V']

  const totalValues = [
    'TOTAL','','','','','',
    ...colLetters.map(c => `=SUM(${c}${dataStartRow}:${c}${lastDataRow})`)
  ]

  const totalRow = ws.addRow(totalValues)
  totalRow.eachCell((cell, colNum) => {
    cell.fill      = S.darkFill
    cell.font      = S.white
    cell.border    = S.border
    cell.alignment = { horizontal: colNum >= 5 ? 'right' : 'left', vertical:'middle' }
    if (colNum >= 7) cell.numFmt = '₹#,##0.00'
    if (colNum === 22) {
      cell.font = { bold:true, color:{ argb:'FFF97316' }, size:10, name:'Arial' }
    }
  })
  totalRow.height = 22

  // ── Column widths ─────────────────────────────────────
  const colWidths = [
    8,   // A  Emp No
    24,  // B  Name
    22,  // C  Designation
    14,  // D  Join Date
    7,   // E  Days
    7,   // F  LWP
    12,  // G  Basic
    10,  // H  HRA
    10,  // I  CCA
    10,  // J  Conv
    14,  // K  Other Allow
    12,  // L  Incentive
    10,  // M  OT Pay
    14,  // N  Gross
    10,  // O  PF
    10,  // P  ESIC
    8,   // Q  PT
    10,  // R  Loan
    10,  // S  Advance
    12,  // T  Other Ded
    12,  // U  Total Ded
    14,  // V  Net Pay
  ]
  colWidths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

  // ── Freeze panes ──────────────────────────────────────
  ws.views = [{ state:'frozen', xSplit:2, ySplit:4 }]

  // ── Stream ────────────────────────────────────────────
  const filename = `SalarySheet_${monthLabel}_${year}.xlsx`
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  await wb.xlsx.write(res)
  res.end()
}
