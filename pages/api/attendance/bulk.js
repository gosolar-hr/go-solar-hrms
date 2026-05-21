import { supabaseAdmin } from '../../../lib/supabase'
import { applySandwichRule, refreshAttendanceSummary } from '../../../lib/attendanceUtils'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { employee_id, month, year, dates, status, include_weekoffs } = req.body
  if (!employee_id || !dates?.length || !month || !year) {
    return res.status(400).json({ error: 'employee_id, dates, month, year required' })
  }

  // Fetch joining date
  const { data: empData } = await supabaseAdmin.from('employees').select('date_of_joining').eq('id', employee_id).single()
  const joiningDate = empData?.date_of_joining ? new Date(empData.date_of_joining) : null

  // Filter dates to only after joining
  const validDates = dates.filter(date => {
    if (!joiningDate) return true
    const d = new Date(joiningDate)
    const joinDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return date >= joinDateStr
  })

  // Upsert valid days
  const rows = validDates.map(date => {
    const dow = new Date(date).getDay()
    const isSunday = dow === 0
    let finalStatus = status || 'A'
    if (!include_weekoffs) {
      if ((status === 'A' || status === 'P') && isSunday) finalStatus = 'W/O'
    }
    return { employee_id, date, status: finalStatus, salary_cut: 0, remark: include_weekoffs ? 'Full month LWP' : null }
  })

  const { error: detErr } = await supabaseAdmin.from('attendance_details').upsert(rows, { onConflict: 'employee_id,date' })
  if (detErr) return res.status(500).json({ error: detErr.message })

  // HIGH #6: Trigger sandwich rule check (Shared)
  await applySandwichRule(employee_id, month, year)
  
  // HIGH #14: Refresh summary (Shared)
  const summary = await refreshAttendanceSummary(employee_id, month, year)

  return res.status(200).json({
    message: 'Bulk attendance saved and synced',
    ...summary
  })
}
