import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' })

  const { visitId, url } = req.body
  if (!visitId || !url) return res.status(400).json({ error: 'visitId and url required' })

  // Extract storage path from public URL
  // URL format: .../storage/v1/object/public/amc-photos/amc-visits/...
  const marker = '/amc-photos/'
  const idx    = url.indexOf(marker)
  if (idx === -1) return res.status(400).json({ error: 'Invalid photo URL' })
  const storagePath = url.slice(idx + marker.length)

  const { error: delErr } = await supabaseAdmin.storage
    .from('amc-photos')
    .remove([storagePath])

  if (delErr) return res.status(500).json({ error: delErr.message })

  // Remove from DB array
  const { data: current } = await supabaseAdmin
    .from('amc_visits')
    .select('photo_urls')
    .eq('id', visitId)
    .single()

  const updated = (current?.photo_urls || []).filter(p => p.url !== url)

  const { error: dbErr } = await supabaseAdmin
    .from('amc_visits')
    .update({ photo_urls: updated })
    .eq('id', visitId)

  if (dbErr) return res.status(500).json({ error: dbErr.message })
  return res.status(200).json({ success: true })
}
