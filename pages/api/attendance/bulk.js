import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { employee_id, month, year, dates, status, include_weekoffs } = req.body

  if (!employee_id || !dates?.length || !month || !year) {
    return res.status(400).json({ error: 'employee_id, dates, month, year required' })
  }

  // Fetch joining date for this employee
  const { data: empData } = await supabaseAdmin
    .from('employees')
    .select('date_of_joining')
    .eq('id', employee_id)
    .single()

  const joiningDate = empData?.date_of_joining
    ? new Date(empData.date_of_joining)
    : null

  // Filter dates to only after joining
  const validDates = dates.filter(date => {
    if (!joiningDate) return true
    // Compare date strings (YYYY-MM-DD)
    return date >= joiningDate.toISOString().split('T')[0]
  })

  // Upsert valid days in one DB call
  const rows = validDates.map(date => {
    const dow      = new Date(date).getDay()
    const isSunday = dow === 0

    let finalStatus = status || 'A'

    // If include_weekoffs = true → mark ALL days as A (full month LWP)
    // If include_weekoffs = false/undefined → protect WO days
    if (!include_weekoffs) {
      if ((status === 'A' || status === 'P') && isSunday) {
        finalStatus = 'W/O'
      }
    }

    return {
      employee_id,
      date,
      status     : finalStatus,
      salary_cut : 0,
      remark     : include_weekoffs ? 'Full month LWP' : null,
    }
  })

  const { error: detErr } = await supabaseAdmin
    .from('attendance_details')
    .upsert(rows, { onConflict: 'employee_id,date' })

  if (detErr) return res.status(500).json({ error: detErr.message })

  // Recalculate summary ONCE from all days in the month
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: allDays } = await supabaseAdmin
    .from('attendance_details')
    .select('status, salary_cut')
    .eq('employee_id', employee_id)
    .gte('date', from)
    .lte('date', to)

  let present_days = 0
  let absent_days  = 0
  let late_marks   = 0

  for (const d of allDays || []) {
    const s = (d.status || '').toUpperCase().trim()

    if (s === 'P' || s === 'P:P') {
      present_days++
      if (d.salary_cut > 0) late_marks++
    }
    else if (s === 'PL') {
      present_days++  // paid leave = full present for salary
    }
    else if (s === 'MO' || s === 'AO') {
      present_days += 0.5
      absent_days  += 0.5
    }
    else if (s === 'P:A' || s === 'A:P') {
      present_days += 0.5
      absent_days  += 0.5
    }
    else if (s === 'A' || s === 'A:A' || s === 'LWP' || s === 'LOP') {
      absent_days++
    }
    // WO, W/O, H → skip (paid by default)
  }

  // Upsert attendance summary
  const { error: sumErr } = await supabaseAdmin
    .from('attendance')
    .upsert([{
      employee_id,
      month,
      year,
      present_days,
      leaves       : absent_days,
      late_marks,
    }], { onConflict: 'employee_id,month,year' })

  if (sumErr) return res.status(500).json({ error: sumErr.message })

  return res.status(200).json({
    message      : `Bulk attendance saved`,
    present_days : present_days,
    absent_days,
    late_marks,
  })
}
