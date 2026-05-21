import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // POST - log or update attendance for a month
  if (req.method === 'POST') {
    const {
      employee_id, month, year,
      present_days, leaves, late_marks
    } = req.body

    // Basic validation
    if (!employee_id || !month || !year || present_days == null) {
      return res.status(400).json({
        error: 'employee_id, month, year and present_days are required'
      })
    }

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .upsert([{
        employee_id,
        month,
        year,
        present_days,
        leaves    : leaves || 0,
        late_marks: late_marks || 0,
      }], { onConflict: 'employee_id,month,year' })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
