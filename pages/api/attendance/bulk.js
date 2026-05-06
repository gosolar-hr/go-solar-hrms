import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { employee_id, month, year, dates, status, work_schedule } = req.body
  // dates = ['2026-04-01', '2026-04-02', ...]

  if (!employee_id || !dates?.length || !month || !year) {
    return res.status(400).json({ error: 'employee_id, dates, month, year required' })
  }

  // Upsert all days in one DB call
  const rows = dates.map(date => ({
    employee_id,
    date,
    status     : status || 'A',
    salary_cut : 0,
    remark     : null,
  }))

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

  const SKIP = new Set(['W/O', 'WO', 'H'])
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
    // W/O, H, WO → skip, don't count
  }

  // Upsert attendance summary
  const { error: sumErr } = await supabaseAdmin
    .from('attendance')
    .upsert([{
      employee_id,
      month,
      year,
      present_days : Math.round(present_days),
      leaves       : absent_days,
      late_marks,
    }], { onConflict: 'employee_id,month,year' })

  if (sumErr) return res.status(500).json({ error: sumErr.message })

  return res.status(200).json({
    message      : `Bulk attendance saved for ${dates.length} days`,
    present_days : Math.round(present_days),
    absent_days,
    late_marks,
  })
}
