import { supabaseAdmin } from '../../../lib/supabase'
import { getWeekOffDates } from '../../../lib/weekoffs'
import { applySandwichRule, refreshAttendanceSummary } from '../../../lib/attendanceUtils'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { records, month, year } = req.body
  if (!records || !month || !year) {
    return res.status(400).json({ error: 'records, month and year are required' })
  }

  const { holidayDates } = await getWeekOffDates(year, month)
  const { data: employees, error: empErr } = await supabaseAdmin.from('employees').select('id, emp_code, work_schedule').eq('is_active', true)
  if (empErr) return res.status(500).json({ error: empErr.message })

  const empMap = {}, scheduleMap = {}
  employees.forEach(e => { if (e.emp_code) { empMap[e.emp_code] = e.id; scheduleMap[e.emp_code] = e.work_schedule || 'standard' } })

  const VALID_SLABS = new Set([0, 0.2, 0.3, 0.5])
  const dayRows = []
  const importedEmpIds = new Set()

  for (const row of records) {
    const { emp_code, date, status, late_slab, remark } = row
    const employee_id = empMap[emp_code]
    if (!employee_id) continue

    const schedule = scheduleMap[emp_code] || 'standard'
    const dObj = new Date(date), dow = dObj.getDay()
    const isSunday = dow === 0, satNum = dow === 6 ? Math.ceil(dObj.getDate() / 7) : 0
    const is2nd4th = [2, 4].includes(satNum)
    const isWO = schedule === '7day' ? false : schedule === '6day' ? isSunday : (isSunday || is2nd4th)

    let finalStatus = status.trim().toUpperCase()
    if (isWO) finalStatus = 'W/O'
    else if (holidayDates.has(date)) finalStatus = 'H'

    const slab = VALID_SLABS.has(parseFloat(late_slab)) ? parseFloat(late_slab) : 0

    dayRows.push({ employee_id, date, status: finalStatus, salary_cut: (finalStatus === 'P' || finalStatus === 'P:P') ? slab : 0, remark: remark || null })
    importedEmpIds.add(employee_id)
  }

  if (dayRows.length > 0) {
    const { error: detErr } = await supabaseAdmin.from('attendance_details').upsert(dayRows, { onConflict: 'employee_id,date' })
    if (detErr) return res.status(500).json({ error: detErr.message })
  }

  // HIGH #6: For each imported employee, apply sandwich rule and refresh summary
  for (const employee_id of importedEmpIds) {
    await applySandwichRule(employee_id, month, year)
    await refreshAttendanceSummary(employee_id, month, year)
  }

  return res.status(200).json({ message: `Attendance imported and synced for ${importedEmpIds.size} employees` })
}

export const config = {
  api: { bodyParser: { sizeLimit: '5mb' } }
}
