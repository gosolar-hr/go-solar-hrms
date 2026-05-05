import { supabaseAdmin } from '../../../lib/supabase'
import ExcelJS          from 'exceljs'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { month, year } = req.query
  if (!month || !year) return res.status(400).json({ error: 'month and year required' })

  const MONTHS = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  const monthLabel = MONTHS[parseInt(month) - 1]

  // Fetch payroll data
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
  if (!records?.length) {
    return res.status(404).json({ error: 'No payroll data found for this month' })
  }

  // ── Build Excel ──────────────────────────────────────
  const wb    = new ExcelJS.Workbook()
  wb.creator  = 'Go Solar HRMS'
  wb.created  = new Date()

  const ws = wb.addWorksheet(`Salary Sheet ${monthLabel} ${year}`)

  // ── Styles ───────────────────────────────────────────
  const headerFill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FF101828' }
  }
  const earningFill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFECFDF3' }
  }
  const deductFill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFFEF3F2' }
  }
  const totalFill = {
    type: 'pattern', pattern: 'solid',
    fgColor: { argb: 'FFFFF4ED' }
  }
  const boldWhite = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10, name: 'Arial' }
  const boldDark  = { bold: true, color: { argb: 'FF101828' }, size: 10, name: 'Arial' }
  const normal    = { color: { argb: 'FF344054' }, size: 10, name: 'Arial' }
  const thinBorder = {
    top   : { style: 'thin', color: { argb: 'FFE4E7EC' } },
    left  : { style: 'thin', color: { argb: 'FFE4E7EC' } },
    bottom: { style: 'thin', color: { argb: 'FFE4E7EC' } },
    right : { style: 'thin', color: { argb: 'FFE4E7EC' } },
  }

  // ── Row 1: Company title ──────────────────────────────
  ws.mergeCells('A1:S1')
  const titleCell  = ws.getCell('A1')
  titleCell.value  = 'GO SOLAR SOLUTIONS — Warrington Renewsol Pvt. Ltd'
  titleCell.font   = { bold: true, size: 13, name: 'Arial', color: { argb: 'FF101828' } }
  titleCell.alignment = { horizontal: 'center' }
  ws.getRow(1).height = 22

  // ── Row 2: Month title ───────────────────────────────
  ws.mergeCells('A2:S2')
  const subCell    = ws.getCell('A2')
  subCell.value    = `SALARY SHEET — ${monthLabel.toUpperCase()} ${year}`
  subCell.font     = { bold: true, size: 11, name: 'Arial', color: { argb: 'FFF97316' } }
  subCell.alignment = { horizontal: 'center' }
  ws.getRow(2).height = 18

  ws.addRow([]) // blank row

  // ── Row 4: Group headers ──────────────────────────────
  const groupRow = ws.addRow([
    'EMP NO', 'NAME', 'DESIGNATION', 'JOIN DATE',
    'DAYS', 'LWP',
    'BASIC', 'HRA', 'CCA', 'CONV', 'OTHER ALLOW', 'INCENTIVE', 'OT PAY', 'GROSS',
    'PF', 'ESIC', 'PT', 'TOTAL DED',
    'NET PAY'
  ])

  groupRow.eachCell((cell, colNum) => {
    cell.font      = boldWhite
    cell.fill      = headerFill
    cell.border    = thinBorder
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }

    // Color earnings columns green
    if (colNum >= 7 && colNum <= 14) {
      cell.fill = { type:'pattern', pattern:'solid', fgColor: { argb: 'FF027A48' } }
    }
    // Color deduction columns red
    if (colNum >= 15 && colNum <= 18) {
      cell.fill = { type:'pattern', pattern:'solid', fgColor: { argb: 'FFB42318' } }
    }
    // Net pay orange
    if (colNum === 19) {
      cell.fill = { type:'pattern', pattern:'solid', fgColor: { argb: 'FFEA6A05' } }
    }
  })
  ws.getRow(4).height = 28

  // ── Data rows ─────────────────────────────────────────
  const dataStartRow = 5

  records.forEach((r, idx) => {
    const e      = r.employees || {}
    const lop    = Math.max(0, 30 - (r.present_days || 30))
    const deduct = Number(r.pf_deduction) + Number(r.esic_deduction) +
                   Number(r.pt_deduction)

    const row = ws.addRow([
      e.emp_code         || '—',
      e.name             || '—',
      e.designation      || '—',
      e.date_of_joining
        ? new Date(e.date_of_joining).toLocaleDateString('en-IN',
            { day:'2-digit', month:'short', year:'numeric' })
        : '—',
      r.present_days     || 30,
      lop,
      Number(e.basic_salary  || 0),
      Number(e.hra           || 0),
      Number(e.cca           || 0),
      Number(e.conveyance    || 0),
      Number(e.allowances    || 0),
      Number(r.incentive     || 0),
      Number(r.overtime_amount || 0),
      Number(r.gross_salary  || 0),
      Number(r.pf_deduction  || 0),
      Number(r.esic_deduction|| 0),
      Number(r.pt_deduction  || 0),
      deduct,
      Number(r.net_salary    || 0),
    ])

    const rowBg = idx % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'

    row.eachCell((cell, colNum) => {
      cell.font   = normal
      cell.border = thinBorder
      cell.fill   = { type:'pattern', pattern:'solid', fgColor: { argb: rowBg } }

      // Numbers right-aligned
      if (colNum >= 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
        if (colNum >= 7) {
          cell.numFmt = '₹#,##0.00'
        }
      } else {
        cell.alignment = { vertical: 'middle' }
      }

      // Highlight net pay green
      if (colNum === 19) {
        cell.font = { bold: true, color: { argb: 'FF027A48' }, size: 10, name: 'Arial' }
      }
      // Highlight LWP red if > 0
      if (colNum === 6 && lop > 0) {
        cell.font = { bold: true, color: { argb: 'FFF04438' }, size: 10, name: 'Arial' }
      }
    })
    row.height = 20
  })

  // ── Totals row ────────────────────────────────────────
  const lastDataRow = dataStartRow + records.length - 1
  const totalRow    = ws.addRow([
    'TOTAL', '', '', '', '', '',
    `=SUM(G${dataStartRow}:G${lastDataRow})`,
    `=SUM(H${dataStartRow}:H${lastDataRow})`,
    `=SUM(I${dataStartRow}:I${lastDataRow})`,
    `=SUM(J${dataStartRow}:J${lastDataRow})`,
    `=SUM(K${dataStartRow}:K${lastDataRow})`,
    `=SUM(L${dataStartRow}:L${lastDataRow})`,
    `=SUM(M${dataStartRow}:M${lastDataRow})`,
    `=SUM(N${dataStartRow}:N${lastDataRow})`,
    `=SUM(O${dataStartRow}:O${lastDataRow})`,
    `=SUM(P${dataStartRow}:P${lastDataRow})`,
    `=SUM(Q${dataStartRow}:Q${lastDataRow})`,
    `=SUM(R${dataStartRow}:R${lastDataRow})`,
    `=SUM(S${dataStartRow}:S${lastDataRow})`,
  ])

  totalRow.eachCell((cell, colNum) => {
    cell.fill   = headerFill
    cell.font   = { ...boldWhite }
    cell.border = thinBorder
    cell.alignment = { horizontal: colNum >= 5 ? 'right' : 'left', vertical: 'middle' }
    if (colNum >= 7) cell.numFmt = '₹#,##0.00'
    if (colNum === 19) {
      cell.font = { bold: true, color: { argb: 'FFF97316' }, size: 10, name: 'Arial' }
    }
  })
  totalRow.height = 22

  // ── Column widths ─────────────────────────────────────
  const colWidths = [
    8,   // Emp No
    24,  // Name
    22,  // Designation
    14,  // Join Date
    7,   // Days
    7,   // LWP
    12,  // Basic
    12,  // HRA
    10,  // CCA
    10,  // Conv
    14,  // Other Allow
    12,  // Incentive
    10,  // OT Pay
    14,  // Gross
    12,  // PF
    12,  // ESIC
    10,  // PT
    14,  // Total Ded
    14,  // Net Pay
  ]
  colWidths.forEach((w, i) => {
    ws.getColumn(i + 1).width = w
  })

  // ── Freeze header rows ────────────────────────────────
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 4 }]

  // ── Stream response ───────────────────────────────────
  const filename = `SalarySheet_${monthLabel}_${year}.xlsx`
  res.setHeader('Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)

  await wb.xlsx.write(res)
  res.end()
}
