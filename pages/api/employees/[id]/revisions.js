import { supabaseAdmin } from '../../../../lib/supabase'
import { requireRole } from '../../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  const { id } = req.query

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('salary_revisions')
      .select('*')
      .eq('employee_id', id)
      .order('effective_date', { ascending: false })

    if (error) {
      // If table doesn't exist yet, return empty array rather than crashing
      if (error.code === 'P0001' || error.message.includes('relation "salary_revisions" does not exist')) {
        return res.status(200).json([])
      }
      return res.status(500).json({ error: error.message })
    }
    return res.status(200).json(data || [])
  }

  res.status(405).json({ error: 'Method not allowed' })
}
