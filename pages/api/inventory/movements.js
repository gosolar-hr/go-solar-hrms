import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  // GET — list movements with filters
  if (req.method === 'GET') {
    const { item_id, site_id, type, limit = 100 } = req.query

    let query = supabaseAdmin
      .from('inventory_movements')
      .select(`
        *,
        inventory_items ( item_name, item_code, unit ),
        amc_sites       ( client_name ),
        employees       ( name, emp_code )
      `)
      .order('movement_date', { ascending: false })
      .order('created_at',    { ascending: false })
      .limit(Number(limit))

    if (item_id) query = query.eq('item_id', item_id)
    if (site_id) query = query.eq('site_id', site_id)
    if (type)    query = query.eq('movement_type', type)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — record a movement and update stock
  if (req.method === 'POST') {
    const {
      item_id, movement_type, quantity,
      from_location, to_location,
      site_id, reference, remarks,
      moved_by, moved_by_name,
      movement_date,
    } = req.body

    if (!item_id || !movement_type || !quantity) {
      return res.status(400).json({ error: 'item_id, movement_type and quantity required' })
    }

    const qty = Number(quantity)
    if (qty <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' })

    // SECURE: Use RPC for atomic "check and update" (Critical #4)
    const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc('process_inventory_movement', {
      p_item_id        : item_id,
      p_movement_type  : movement_type,
      p_qty            : qty,
      p_from_location  : from_location || null,
      p_to_location    : to_location   || null,
      p_site_id        : site_id       || null,
      p_reference      : reference     || null,
      p_remarks        : remarks       || null,
      p_moved_by       : moved_by      || null,
      p_moved_by_name  : moved_by_name || null,
      p_movement_date  : movement_date || new Date().toISOString().split('T')[0]
    })

    if (rpcErr) return res.status(500).json({ error: rpcErr.message })
    if (!rpcRes.success) return res.status(400).json({ error: rpcRes.error })

    return res.status(201).json({ id: rpcRes.movement_id, ...req.body })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
