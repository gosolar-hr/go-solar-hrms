import { supabaseAdmin } from '../../../lib/supabase'
import { getWeekOffDates } from '../../../lib/weekoffs'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { records, month, year } = req.body

  if (!records || !month || !year) {
    return res.status(400).json({ error: 'records, month and year are required' })
  }

  // Fetch week off + holiday dates from DB for this month
  const { weekOffDates, holidayDates } = await getWeekOffDates(year, month)

  // Fetch active employees
  const { data: employees, error: empErr } = await supabaseAdmin
    .from('employees')
    .select('id, emp_code, name')
    .eq('is_active', true)

  if (empErr) return res.status(500).json({ error: empErr.message })

  const empMap = {}
  employees.forEach(e => { if (e.emp_code) empMap[e.emp_code] = e.id })

  // Late mark slabs per Go Solar policy:
  // 0.0 = No deduction (present on time or within grace period 9:30-9:45)
  // 0.2 = 20% deduction (late 9:45-10:00)
  // 0.3 = 30% deduction (late 10:00-10:30)
  // 0.5 = 50% deduction (late after 10:30)
  const VALID_SLABS = new Set([0, 0.2, 0.3, 0.5])

  const grouped = {}  // summary totals
  const dayRows = []  // day-level detail rows
  const incomingCodes = new Set()

  for (const row of records) {
    const { emp_code, date, status, late_slab, remark = '' } = row
    if (!emp_code || !status || !date) continue

    incomingCodes.add(emp_code)

    const employee_id = empMap[emp_code]
    if (!employee_id) continue  // not in salary structure → ignore

    // ── DB OVERRIDE ──────────────────────────────────────────
    // Regardless of what biometric says, if the date is a
    // declared week off or holiday → force correct status
    let mapped = status.trim().toUpperCase()

    if (weekOffDates.has(date)) {
      mapped = 'W/O'   // Sunday, 2nd Sat, 4th Sat → always W/O
    } else if (holidayDates.has(date)) {
      mapped = 'H'     // Declared holiday → always H
    }

    const normalizeStatus = (s) => {
      if (s === 'P:P') return 'P'
      if (s === 'A:A') return 'A'
      return s
    }
    const finalStatus = normalizeStatus(mapped)
    // ─────────────────────────────────────────────────────────

    const slab = VALID_SLABS.has(parseFloat(late_slab))
      ? parseFloat(late_slab) : 0

    // Save to details table (full calendar view)
    dayRows.push({
      employee_id,
      date,
      status     : finalStatus,
      salary_cut : finalStatus === 'P:P' ? slab : 0,
      remark     : remark || null,
    })

    // Summary calculation — skip W/O and H
    if (finalStatus === 'W/O' || finalStatus === 'H') continue

    if (!grouped[emp_code]) {
      grouped[emp_code] = {
        employee_id,
        present_days: 0,
        absent_days : 0,
        late_marks  : 0,
      }
    }

    const s = finalStatus

    if (s === 'P' || s === 'P:P') {
      grouped[emp_code].present_days++
      if (slab > 0) grouped[emp_code].late_marks++
    }
    else if (s === 'PL') {
      grouped[emp_code].present_days++
    }
    else if (s === 'MO' || s === 'AO') {
      grouped[emp_code].present_days += 0.5
      grouped[emp_code].absent_days  += 0.5
    }
    else if (s === 'P:A' || s === 'A:P') {
      grouped[emp_code].present_days += 0.5
      grouped[emp_code].absent_days  += 0.5
    }
    else if (s === 'A' || s === 'A:A' || s === 'LWP' || s === 'LOP') {
      grouped[emp_code].absent_days++
    }
  }

  // Upsert day-level details
  if (dayRows.length > 0) {
    const { error: detErr } = await supabaseAdmin
      .from('attendance_details')
      .upsert(dayRows, { onConflict: 'employee_id,date' })
    if (detErr) return res.status(500).json({ error: detErr.message })
  }

  // Upsert attendance summary
  const results  = []
  const failures = []

  for (const [emp_code, totals] of Object.entries(grouped)) {
    const { data, error } = await supabaseAdmin
      .from('attendance')
      .upsert([{
        employee_id  : totals.employee_id,
        month,
        year,
        present_days : Math.round(totals.present_days),
        leaves       : totals.absent_days,
        late_marks   : totals.late_marks,
      }], { onConflict: 'employee_id,month,year' })
      .select()
      .single()

    if (error) failures.push({ emp_code, reason: error.message })
    else       results.push({ emp_code, ...totals })
  }

  const ignored = [...incomingCodes].filter(c => !empMap[c])

  return res.status(200).json({
    message      : `Attendance imported for ${results.length} employees`,
    month,
    year,
    week_offs    : [...weekOffDates].sort(),
    holidays     : [...holidayDates].sort(),
    imported     : results,
    ignored      : ignored.length  > 0 ? ignored  : undefined,
    failures     : failures.length > 0 ? failures : undefined,
  })
}

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } }
}
