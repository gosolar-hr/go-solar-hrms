import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'
import { applySandwichRule, refreshAttendanceSummary } from '../../../lib/attendanceUtils'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — fetch day-level details for one employee + month
  // Auto-initializes any missing days so the summary is always accurate
  if (req.method === 'GET') {
    const { employee_id, month, year } = req.query
    if (!employee_id || !month || !year) {
      return res.status(400).json({ error: 'employee_id, month and year required' })
    }

    const m = parseInt(month)
    const y = parseInt(year)
    const daysInMonth = new Date(y, m, 0).getDate()
    const pad = n => String(n).padStart(2, '0')
    const from = `${y}-${pad(m)}-01`
    const to   = `${y}-${pad(m)}-${daysInMonth}`

    // Fetch existing rows
    const { data: existing, error } = await supabaseAdmin
      .from('attendance_details')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('date', from)
      .lte('date', to)
      .order('date')

    if (error) return res.status(500).json({ error: error.message })

    // Find which days have no row yet
    const existingDates = new Set((existing || []).map(r => r.date))
    const missingDates  = []
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${pad(m)}-${pad(d)}`
      if (!existingDates.has(dateStr)) missingDates.push(dateStr)
    }

    // Auto-initialize missing days
    if (missingDates.length > 0) {
      // Fetch holidays so we can mark H correctly
      const { data: holidays } = await supabaseAdmin
        .from('holidays')
        .select('date')
        .eq('is_active', true)
        .gte('date', from)
        .lte('date', to)
      const holidaySet = new Set((holidays || []).map(h => h.date))

      // Fetch employee work_schedule
      const { data: emp } = await supabaseAdmin
        .from('employees')
        .select('work_schedule, date_of_joining')
        .eq('id', employee_id)
        .single()

      const workSchedule  = emp?.work_schedule || 'standard'
      const joiningDate   = emp?.date_of_joining ? new Date(emp.date_of_joining) : null

      // Build W/O logic matching weekoffs.js
      const saturdays = []
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m - 1, d)
        if (date.getDay() === 6) saturdays.push(d)
      }
      const woSaturdays = new Set(
        workSchedule === 'standard'
          ? saturdays.filter((_, i) => i === 1 || i === 3).map(d => `${y}-${pad(m)}-${pad(d)}`)
          : []
      )

      const newRows = missingDates.map(dateStr => {
        const date    = new Date(dateStr)
        const dow     = date.getDay() // 0=Sun, 6=Sat

        // Before joining date → no status
        if (joiningDate && date < joiningDate) {
          return { employee_id, date: dateStr, status: null, salary_cut: 0, remark: null }
        }

        let status
        if (holidaySet.has(dateStr)) {
          status = 'H'
        } else if (dow === 0 || woSaturdays.has(dateStr)) {
          status = 'W/O'
        } else {
          // Weekday with no record → default Present
          // HR corrects to A for actual absences
          status = 'P'
        }

        return { employee_id, date: dateStr, status, salary_cut: 0, remark: null }
      })

      // Insert the missing rows
      const { error: insertErr } = await supabaseAdmin
        .from('attendance_details')
        .upsert(newRows, { onConflict: 'employee_id,date' })

      if (insertErr) return res.status(500).json({ error: insertErr.message })

      // Refresh summary now that all days are filled
      await refreshAttendanceSummary(employee_id, m, y)

      // Return the full merged set
      const merged = [...(existing || []), ...newRows]
        .sort((a, b) => a.date.localeCompare(b.date))
      return res.status(200).json(merged)
    }

    return res.status(200).json(existing)
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

    // Trigger sandwich rule check
    const sandwichDates = await applySandwichRule(employee_id, m, y)

    // Refresh summary
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
