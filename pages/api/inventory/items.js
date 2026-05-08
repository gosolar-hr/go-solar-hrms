import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // GET — list all items with current HO stock
  if (req.method === 'GET') {
    const { data: items, error } = await supabaseAdmin
      .from('inventory_items')
      .select(`
        *,
        inventory_stock ( location, quantity, site_id )
      `)
      .eq('is_active', true)
      .order('category')
      .order('item_name')

    if (error) return res.status(500).json({ error: error.message })

    const enriched = items.map(item => {
      const hoStock   = (item.inventory_stock || []).find(s => s.location === 'HO')
      const siteStock = (item.inventory_stock || []).filter(s => s.location !== 'HO')
      const totalQty  = (item.inventory_stock || []).reduce((s, x) => s + Number(x.quantity), 0)
      const hoQty     = Number(hoStock?.quantity || 0)
      const isLow     = hoQty <= Number(item.reorder_level) && Number(item.reorder_level) > 0

      return {
        ...item,
        ho_stock    : hoQty,
        site_stock  : siteStock,
        total_stock : totalQty,
        is_low      : isLow,
      }
    })

    return res.status(200).json(enriched)
  }

  // POST — add new item
  if (req.method === 'POST') {
    const { item_code, item_name, category, unit, reorder_level, description, opening_stock } = req.body

    if (!item_name || !category) {
      return res.status(400).json({ error: 'item_name and category are required' })
    }

    // Auto-generate item code if not provided
    let code = item_code
    if (!code) {
      const prefix = category.slice(0, 3).toUpperCase()
      const { count } = await supabaseAdmin
        .from('inventory_items')
        .select('*', { count: 'exact', head: true })
      code = `${prefix}-${String((count || 0) + 1).padStart(4, '0')}`
    }

    const { data, error } = await supabaseAdmin
      .from('inventory_items')
      .insert([{
        item_code    : code,
        item_name,
        category,
        unit         : unit          || 'pcs',
        reorder_level: reorder_level || 0,
        description  : description   || null,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Create HO stock record with opening stock
    if (opening_stock && Number(opening_stock) > 0) {
      await supabaseAdmin.from('inventory_stock').insert([{
        item_id : data.id,
        location: 'HO',
        quantity: Number(opening_stock),
      }])

      // Record as inward movement
      await supabaseAdmin.from('inventory_movements').insert([{
        item_id      : data.id,
        movement_type: 'inward',
        quantity     : Number(opening_stock),
        to_location  : 'HO',
        remarks      : 'Opening stock',
        movement_date: new Date().toISOString().split('T')[0],
      }])
    } else {
      // Create zero stock record
      await supabaseAdmin.from('inventory_stock').insert([{
        item_id : data.id,
        location: 'HO',
        quantity: 0,
      }])
    }

    return res.status(201).json(data)
  }

  // PUT — update item
  if (req.method === 'PUT') {
    const { id, item_name, category, unit, reorder_level, description } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    const { data, error } = await supabaseAdmin
      .from('inventory_items')
      .update({ item_name, category, unit, reorder_level, description })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
