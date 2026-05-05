import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .limit(1)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ message: 'Connection successful', data })
}
