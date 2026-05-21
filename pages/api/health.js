import { supabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  await supabaseAdmin.from('employees').select('id').limit(1)
  res.status(200).json({ status: 'ok', time: new Date().toISOString() })
}
