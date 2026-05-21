import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — fetch OT entries for month
  if (req.method === 'GET') {
    const { employee_id, month, year } = req.query

    let query = supabaseAdmin
      .from('payroll_ot_entries')
      .select('*, employees(name, emp_code)')
      .eq('month', parseInt(month))
      .eq('year',  parseInt(year))
      .order('entry_date')

    if (employee_id) query = query.eq('employee_id', employee_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — add OT entry
  if (req.method === 'POST') {
    const { employee_id, month, year, ot_hours, entry_date, notes } = req.body

    if (!employee_id || !month || !year || !ot_hours) {
      return res.status(400).json({
        error: 'employee_id, month, year and ot_hours required'
      })
    }

    // Check if payroll is already locked for this month
    const { data: lockCheck } = await supabaseAdmin
      .from('payroll_draft')
      .select('is_locked')
      .eq('employee_id', employee_id)
      .eq('month', month)
      .eq('year',  year)
      .eq('is_locked', true)
      .limit(1)

    if (lockCheck?.length > 0) {
      return res.status(403).json({
        error: 'Payroll is locked for this month. Cannot add OT entries.'
      })
    }

    // Insert OT entry
    const { data, error } = await supabaseAdmin
      .from('payroll_ot_entries')
      .insert([{
        employee_id,
        month,
        year,
        ot_hours   : Number(ot_hours),
        entry_date : entry_date || new Date().toISOString().split('T')[0],
        notes      : notes || null,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Auto-update draft with new total OT hours
    const { data: allEntries } = await supabaseAdmin
      .from('payroll_ot_entries')
      .select('ot_hours')
      .eq('employee_id', employee_id)
      .eq('month', month)
      .eq('year',  year)

    const totalOT = (allEntries || [])
      .reduce((s, e) => s + Number(e.ot_hours), 0)

    // Upsert draft with accumulated OT
    await supabaseAdmin
      .from('payroll_draft')
      .upsert([{
        employee_id,
        month,
        year,
        overtime_hours: totalOT,
        updated_at    : new Date().toISOString(),
      }], { onConflict: 'employee_id,month,year' })

    return res.status(201).json({
      entry    : data,
      total_ot : totalOT,
      message  : `OT entry added. Total OT for month: ${totalOT} hours`,
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
