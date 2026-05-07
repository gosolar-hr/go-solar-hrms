import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // GET — fetch day-level details for one employee + month
  if (req.method === 'GET') {
    const { employee_id, month, year } = req.query

    if (!employee_id || !month || !year) {
      return res.status(400).json({ error: 'employee_id, month and year required' })
    }

    // Build date range for the month
    const from = `${year}-${String(month).padStart(2,'0')}-01`
    const to   = new Date(year, month, 0).toISOString().split('T')[0] // last day

    const { data, error } = await supabaseAdmin
      .from('attendance_details')
      .select('*')
      .eq('employee_id', employee_id)
      .gte('date', from)
      .lte('date', to)
      .order('date')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // PUT — HR overrides a single day's salary_cut and remark
  if (req.method === 'PUT') {
    const { employee_id, date, status, salary_cut, remark } = req.body

    if (!employee_id || !date) {
      return res.status(400).json({ error: 'employee_id and date required' })
    }

    // Update the day record
    const { data, error } = await supabaseAdmin
      .from('attendance_details')
      .upsert([{ employee_id, date, status, salary_cut, remark }],
              { onConflict: 'employee_id,date' })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Recalculate and update the attendance summary for that month
    const month = parseInt(date.split('-')[1])
    const year  = parseInt(date.split('-')[0])
    const from  = `${year}-${String(month).padStart(2,'0')}-01`
    const to    = new Date(year, month, 0).toISOString().split('T')[0]

    const { data: allDays } = await supabaseAdmin
      .from('attendance_details')
      .select('status, salary_cut')
      .eq('employee_id', employee_id)
      .gte('date', from)
      .lte('date', to)

    const SKIP = new Set(['W/O', 'WO', 'H'])
    let present_days = 0, absent_days = 0, late_marks = 0

    // ── Sandwich Rule Check ──────────────────────────────────
    const sandwichDates = await checkSandwichRule(
      employee_id,
      date,
      year,
      month
    )

    // Re-fetch days because sandwich rule might have updated some W/O to A
    const { data: finalDays } = await supabaseAdmin
      .from('attendance_details')
      .select('status, salary_cut')
      .eq('employee_id', employee_id)
      .gte('date', from)
      .lte('date', to)

    for (const d of finalDays || []) {
      const s = (d.status || '').toUpperCase().trim()

      if (s === 'P' || s === 'P:P') {
        present_days++
        if (d.salary_cut > 0) late_marks++
      }
      else if (s === 'PL') {
        present_days++
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
      // WO and H are NOT counted in either — they are implicitly paid
    }

    await supabaseAdmin
      .from('attendance')
      .upsert([{
        employee_id,
        month,
        year,
        present_days : present_days,
        leaves       : absent_days,
        late_marks,
      }], { onConflict: 'employee_id,month,year' })

    return res.status(200).json({
      message          : 'Day updated and attendance summary recalculated',
      day              : data,
      summary          : { present_days, absent_days, late_marks },
      sandwich_applied : sandwichDates.length > 0,
      sandwich_dates   : sandwichDates,
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}

async function checkSandwichRule(employee_id, date, year, month) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: allDays } = await supabaseAdmin
    .from('attendance_details')
    .select('date, status')
    .eq('employee_id', employee_id)
    .gte('date', from)
    .lte('date', to)
    .order('date')

  if (!allDays?.length) return []

  const ABSENT   = new Set(['A', 'A:A', 'LWP', 'LOP'])
  const WEEKOFF  = new Set(['WO', 'W/O', 'H'])
  const sandwich = []

  for (let i = 1; i < allDays.length - 1; i++) {
    const prev = allDays[i - 1]
    const curr = allDays[i]
    const next = allDays[i + 1]

    if (
      WEEKOFF.has(curr.status) &&
      ABSENT.has(prev.status)  &&
      ABSENT.has(next.status)
    ) {
      sandwich.push(curr.date)
    }
  }

  for (const sandwichDate of sandwich) {
    await supabaseAdmin
      .from('attendance_details')
      .update({ status: 'A', salary_cut: 0 })
      .eq('employee_id', employee_id)
      .eq('date', sandwichDate)
  }

  return sandwich
}
