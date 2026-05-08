import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

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

    // ── Validate stock availability ────────────────────────
    if (movement_type === 'outward' || movement_type === 'transfer') {
      const fromLoc = from_location || 'HO'
      const { data: stock } = await supabaseAdmin
        .from('inventory_stock')
        .select('quantity')
        .eq('item_id', item_id)
        .eq('location', fromLoc)
        .single()

      const available = Number(stock?.quantity || 0)
      if (available < qty) {
        return res.status(400).json({
          error: `Insufficient stock at ${fromLoc}. Available: ${available}`
        })
      }
    }

    // ── Record movement ────────────────────────────────────
    const { data: movement, error: movErr } = await supabaseAdmin
      .from('inventory_movements')
      .insert([{
        item_id,
        movement_type,
        quantity      : qty,
        from_location : from_location || null,
        to_location   : to_location   || null,
        site_id       : site_id       || null,
        reference     : reference     || null,
        remarks       : remarks       || null,
        moved_by      : moved_by      || null,
        moved_by_name : moved_by_name || null,
        movement_date : movement_date || new Date().toISOString().split('T')[0],
      }])
      .select()
      .single()

    if (movErr) return res.status(500).json({ error: movErr.message })

    // ── Update stock levels ────────────────────────────────
    const upsertStock = async (location, siteId, deltaQty) => {
      const { data: existing } = await supabaseAdmin
        .from('inventory_stock')
        .select('id, quantity')
        .eq('item_id', item_id)
        .eq('location', location)
        .maybeSingle()

      if (existing) {
        const newQty = Math.max(0, Number(existing.quantity) + deltaQty)
        await supabaseAdmin
          .from('inventory_stock')
          .update({ quantity: newQty, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
      } else {
        await supabaseAdmin
          .from('inventory_stock')
          .insert([{
            item_id,
            location,
            site_id : siteId || null,
            quantity: Math.max(0, deltaQty),
          }])
      }
    }

    // Apply stock changes based on movement type
    if (movement_type === 'inward') {
      // Stock comes into HO (or specified location)
      await upsertStock(to_location || 'HO', null, +qty)
    }
    else if (movement_type === 'outward') {
      // Stock leaves HO to a site
      await upsertStock(from_location || 'HO', null, -qty)
      if (to_location && to_location !== 'HO') {
        await upsertStock(to_location, site_id, +qty)
      }
    }
    else if (movement_type === 'transfer') {
      // Stock moves between locations
      await upsertStock(from_location || 'HO', null, -qty)
      await upsertStock(to_location,    site_id, +qty)
    }
    else if (movement_type === 'return') {
      // Stock returns from site to HO
      if (from_location && from_location !== 'HO') {
        await upsertStock(from_location, site_id, -qty)
      }
      await upsertStock('HO', null, +qty)
    }

    return res.status(201).json(movement)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
