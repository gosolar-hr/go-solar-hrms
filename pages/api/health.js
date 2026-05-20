import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  await supabaseAdmin.from('employees').select('id').limit(1)
  res.status(200).json({ status: 'ok', time: new Date().toISOString() })
}
