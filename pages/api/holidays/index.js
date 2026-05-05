import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // GET — list all holidays
  if (req.method === 'GET') {
    const { year } = req.query
    let query = supabaseAdmin
      .from('holidays')
      .select('*')
      .eq('is_active', true)
      .order('date')

    if (year) {
      query = query
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — add a new holiday
  if (req.method === 'POST') {
    const { date, name } = req.body
    if (!date || !name) {
      return res.status(400).json({ error: 'date and name are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('holidays')
      .upsert([{ date, name, is_active: true }], { onConflict: 'date' })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // DELETE — remove a holiday
  if (req.method === 'DELETE') {
    const { date } = req.body
    if (!date) return res.status(400).json({ error: 'date is required' })

    const { error } = await supabaseAdmin
      .from('holidays')
      .update({ is_active: false })
      .eq('date', date)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ message: 'Holiday removed' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
