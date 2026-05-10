import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'
import { applySandwichRule, refreshAttendanceSummary } from '../../../lib/attendanceUtils'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — fetch day-level details for one employee + month
  if (req.method === 'GET') {
    const { employee_id, month, year } = req.query
    if (!employee_id || !month || !year) {
      return res.status(400).json({ error: 'employee_id, month and year required' })
    }

    const { data, error } = await supabaseAdmin
      .from('attendance_details')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('date', `${year}-${String(month).padStart(2,'0')}-01`)
      .lte('date', `${year}-${String(month).padStart(2,'0')}-${new Date(year, month, 0).getDate()}`)
      .order('date')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // PUT — HR overrides a single day
  if (req.method === 'PUT') {
    let { employee_id, date, status, salary_cut, remark } = req.body
    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date required' })
    }

    // SECURE: Validate salary_cut bounds
    salary_cut = Math.min(Math.max(Number(salary_cut || 0), 0), 1)

    // Update the day record
    const { error: upsertErr } = await supabaseAdmin
      .from('attendance_details')
      .upsert([{ employee_id, date, status, salary_cut, remark }], { onConflict: 'employee_id,date' })

    if (upsertErr) return res.status(500).json({ error: upsertErr.message })

    const m = parseInt(date.split('-')[1])
    const y = parseInt(date.split('-')[0])

    // HIGH #6: Trigger sandwich rule check (Shared)
    const sandwichDates = await applySandwichRule(employee_id, m, y)
    
    // HIGH #14: Refresh summary (Shared)
    const summary = await refreshAttendanceSummary(employee_id, m, y)

    return res.status(200).json({
      message          : 'Attendance saved',
      sandwich_applied : sandwichDates.length > 0,
      sandwich_dates   : sandwichDates,
      summary
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
