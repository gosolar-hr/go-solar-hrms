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

    for (const d of allDays || []) {
      const s = d.status?.toUpperCase()
      if (['W/O', 'WO', 'H'].includes(s)) continue

      if (s === 'P' || s === 'P:P') {
        present_days++
        if (d.salary_cut > 0) late_marks++
      }
      else if (s === 'PL') {
        present_days++
      }
      else if (s === 'MO' || s === 'AO' || s === 'P:A' || s === 'A:P') {
        present_days += 0.5
        absent_days  += 0.5
      }
      else if (s === 'A' || s === 'A:A' || s === 'LWP' || s === 'LOP') {
        absent_days++
      }
    }

    await supabaseAdmin
      .from('attendance')
      .upsert([{
        employee_id,
        month,
        year,
        present_days : Math.round(present_days),
        leaves       : absent_days,
        late_marks,
      }], { onConflict: 'employee_id,month,year' })

    return res.status(200).json({
      message : 'Day updated and attendance summary recalculated',
      day     : data,
      summary : { present_days, absent_days, late_marks },
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
