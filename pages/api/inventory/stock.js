import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { site_id } = req.query

  // Get all stock with item details
  let query = supabaseAdmin
    .from('inventory_stock')
    .select(`
      *,
      inventory_items ( item_code, item_name, category, unit, reorder_level, is_active ),
      amc_sites       ( client_name )
    `)
    .gt('quantity', 0)

  if (site_id) query = query.eq('site_id', site_id)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  // Group by item
  const byItem = {}
  ;(data || []).forEach(row => {
    if (!row.inventory_items?.is_active) return
    const itemId = row.item_id
    if (!byItem[itemId]) {
      byItem[itemId] = {
        item_id     : itemId,
        item_code   : row.inventory_items.item_code,
        item_name   : row.inventory_items.item_name,
        category    : row.inventory_items.category,
        unit        : row.inventory_items.unit,
        reorder_level: row.inventory_items.reorder_level,
        locations   : [],
        total_qty   : 0,
      }
    }
    byItem[itemId].locations.push({
      location  : row.location,
      site_name : row.amc_sites?.client_name || null,
      quantity  : Number(row.quantity),
    })
    byItem[itemId].total_qty += Number(row.quantity)
  })

  const result = Object.values(byItem).map(item => ({
    ...item,
    ho_qty  : item.locations.find(l => l.location === 'HO')?.quantity || 0,
    is_low  : (item.locations.find(l => l.location === 'HO')?.quantity || 0) <=
              Number(item.reorder_level) && Number(item.reorder_level) > 0,
  }))

  // Low stock alerts
  const lowStock = result.filter(i => i.is_low)

  return res.status(200).json({ stock: result, low_stock: lowStock })
}
