import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — fetch all advances for an employee with adjustment summary
  if (req.method === 'GET') {
    const { employee_id } = req.query
    if (!employee_id) return res.status(400).json({ error: 'employee_id required' })

    const { data: advances, error } = await supabaseAdmin
      .from('employee_advances')
      .select(`
        *,
        advance_adjustments ( amount, month, year )
      `)
      .eq('employee_id', employee_id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    const enriched = advances.map(adv => {
      const adjusted = (adv.advance_adjustments || [])
        .reduce((s, a) => s + Number(a.amount), 0)
      return {
        ...adv,
        total_adjusted: adjusted,
        balance       : Math.max(0, Number(adv.total_amount) - adjusted),
      }
    })

    return res.status(200).json(enriched)
  }

  // POST — add new advance
  if (req.method === 'POST') {
    const { employee_id, advance_date, total_amount,
            monthly_adjustment, description } = req.body
    if (!employee_id || !total_amount) {
      return res.status(400).json({ error: 'employee_id and total_amount required' })
    }

    const { data, error } = await supabaseAdmin
      .from('employee_advances')
      .insert([{
        employee_id,
        advance_date       : advance_date || new Date().toISOString().split('T')[0],
        total_amount,
        monthly_adjustment : monthly_adjustment || 0,
        description,
      }])
      .select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
