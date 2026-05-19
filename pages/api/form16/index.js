import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// ── Indian Tax Slabs FY 2024-25 (New Regime — default) ──────────────
// Old regime slabs also included for reference
const STANDARD_DEDUCTION = 50000

function calcTaxNewRegime(taxableIncome) {
  // New regime slabs (FY 2024-25)
  // 0–3L = 0%, 3–7L = 5%, 7–10L = 10%, 10–12L = 15%, 12–15L = 20%, >15L = 30%
  // Rebate u/s 87A: if total income <= 7,00,000, full tax rebate
  let tax = 0
  const slabs = [
    { limit: 300000,  rate: 0    },
    { limit: 700000,  rate: 0.05 },
    { limit: 1000000, rate: 0.10 },
    { limit: 1200000, rate: 0.15 },
    { limit: 1500000, rate: 0.20 },
  ]
  let remaining = taxableIncome
  let prev = 0
  for (const slab of slabs) {
    const band = slab.limit - prev
    if (remaining <= 0) break
    const taxable = Math.min(remaining, band)
    tax += taxable * slab.rate
    remaining -= taxable
    prev = slab.limit
  }
  if (remaining > 0) tax += remaining * 0.30

  // Rebate u/s 87A: total income <= 7,00,000 → no tax
  if (taxableIncome <= 700000) tax = 0

  // Health & Education Cess 4%
  const cess = Math.round(tax * 0.04)
  return { tax: Math.round(tax), cess, total: Math.round(tax) + cess }
}

function getFYLabel(fy) {
  // fy = "2024-25" → "FY 2024-25"
  return `FY ${fy}`
}

function getAssessmentYear(fy) {
  // fy = "2024-25" → "2025-2026"
  const [start, end] = fy.split('-')
  const startY = parseInt(start)
  const endY   = startY + 1
  // end is 2-digit "25" → full year endY
  return `${endY}-${endY + 1}`
}

function fyToMonthRange(fy) {
  // "2024-25" → months Apr 2024 – Mar 2025
  const startYear = parseInt(fy.split('-')[0])
  return [
    { month: 4,  year: startYear },
    { month: 5,  year: startYear },
    { month: 6,  year: startYear },
    { month: 7,  year: startYear },
    { month: 8,  year: startYear },
    { month: 9,  year: startYear },
    { month: 10, year: startYear },
    { month: 11, year: startYear },
    { month: 12, year: startYear },
    { month: 1,  year: startYear + 1 },
    { month: 2,  year: startYear + 1 },
    { month: 3,  year: startYear + 1 },
  ]
}

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — list employees for selection
  if (req.method === 'GET' && !req.query.employee_id) {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('id, name, emp_code, department, pan, date_of_joining')
      .order('emp_code')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // GET with employee_id + fy → generate Form 16 data
  if (req.method === 'GET' && req.query.employee_id) {
    const { employee_id, fy } = req.query

    if (!fy) return res.status(400).json({ error: 'fy (financial year e.g. 2024-25) required' })

    // Fetch employee
    const { data: emp, error: empErr } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single()

    if (empErr || !emp) return res.status(404).json({ error: 'Employee not found' })

    // Fetch payroll rows for this FY
    const months = fyToMonthRange(fy)
    const startY = parseInt(fy.split('-')[0])

    const { data: payrollRows, error: payErr } = await supabaseAdmin
      .from('payroll')
      .select('*')
      .eq('employee_id', employee_id)
      .in('month', months.map(m => m.month))
      .gte('year', startY)
      .lte('year', startY + 1)
      .order('year').order('month')

    if (payErr) return res.status(500).json({ error: payErr.message })

    // Build monthly breakdown
    const monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    const breakdown = months.map(({ month, year }) => {
      const row = (payrollRows || []).find(p => p.month === month && p.year === year)
      return {
        month_label : `${monthNames[month]} ${year}`,
        month, year,
        gross_salary   : row ? Number(row.gross_salary   || 0) : 0,
        pf_deduction   : row ? Number(row.pf_deduction   || 0) : 0,
        esic_deduction : row ? Number(row.esic_deduction || 0) : 0,
        pt_deduction   : row ? Number(row.pt_deduction   || 0) : 0,
        net_salary     : row ? Number(row.net_salary     || 0) : 0,
        tds            : 0,  // TDS per month (currently 0 for all employees)
      }
    })

    // Period with employer: from joining date within this FY or FY start, whichever is later
    const fyStart = new Date(`${startY}-04-01`)
    const fyEnd   = new Date(`${startY + 1}-03-31`)
    const joining = emp.date_of_joining ? new Date(emp.date_of_joining) : null
    const periodFrom = joining && joining > fyStart ? joining : fyStart
    const periodTo   = fyEnd

    const fmtDate = d => d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
      .replace(/ /g, '-')

    // Annual totals
    const grossSalary17_1 = breakdown.reduce((s, m) => s + m.gross_salary, 0)
    const totalPF         = breakdown.reduce((s, m) => s + m.pf_deduction, 0)
    const totalESIC       = breakdown.reduce((s, m) => s + m.esic_deduction, 0)
    const totalPT         = breakdown.reduce((s, m) => s + m.pt_deduction, 0)
    const totalTDS        = breakdown.reduce((s, m) => s + m.tds, 0)
    const totalNet        = breakdown.reduce((s, m) => s + m.net_salary, 0)

    // Form 16 tax computation
    const standardDeduction = Math.min(STANDARD_DEDUCTION, grossSalary17_1)
    const incomeUnderSalary = Math.max(0, grossSalary17_1 - standardDeduction)
    const deductions80C     = totalPF  // PF counts under 80C (old regime only; keep for reference)
    const totalIncome       = incomeUnderSalary  // no 80C in new regime
    const { tax, cess, total: taxPayable } = calcTaxNewRegime(totalIncome)
    const tdsAlreadyDeducted = totalTDS
    const taxRefundable      = Math.max(0, tdsAlreadyDeducted - taxPayable)
    const taxBalance         = Math.max(0, taxPayable - tdsAlreadyDeducted)

    return res.status(200).json({
      employee: {
        name           : emp.name,
        pan            : emp.pan  || 'NOT PROVIDED',
        uan            : emp.uan_number || null,
        pf_number      : emp.pf_number  || null,
        designation    : emp.designation || '',
        department     : emp.department  || '',
        emp_code       : emp.emp_code    || '',
      },
      employer: {
        name    : 'Go Solar Solutions',
        full_name: 'Warrington Renewsol Pvt. Ltd.',
        address : 'Bengaluru, Karnataka',
        pan     : 'NOT PROVIDED',  // Update with actual company PAN
        tan     : 'NOT PROVIDED',  // Update with actual TAN
      },
      period: {
        from           : fmtDate(periodFrom),
        to             : fmtDate(periodTo),
        fy             : getFYLabel(fy),
        assessment_year: getAssessmentYear(fy),
      },
      summary: {
        gross_salary_17_1  : Math.round(grossSalary17_1),
        perquisites_17_2   : 0,
        profits_lieu_17_3  : 0,
        gross_salary_total : Math.round(grossSalary17_1),
        standard_deduction : Math.round(standardDeduction),
        income_under_salary: Math.round(incomeUnderSalary),
        deductions_vi_a    : 0,
        total_income       : Math.round(totalIncome),
        tax_on_income      : tax,
        health_edu_cess    : cess,
        tax_payable        : taxPayable,
        tds_deducted       : tdsAlreadyDeducted,
        tax_balance        : taxBalance,
        tax_refundable     : taxRefundable,
      },
      deductions: {
        pf   : Math.round(totalPF),
        esic : Math.round(totalESIC),
        pt   : Math.round(totalPT),
        net  : Math.round(totalNet),
      },
      breakdown,
      fy,
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
