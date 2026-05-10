import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  // ── GET — list all sites with alert flags ──────────────
  if (req.method === 'GET') {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .select('*, amc_visits(id, scheduled_date, status)')
      .eq('is_active', true)
      .order('client_name')

    if (error) return res.status(500).json({ error: error.message })

    const enriched = data.map(site => {
      const validUpto   = site.amc_valid_upto ? new Date(site.amc_valid_upto) : null
      const todayDate   = new Date(today)
      const daysLeft    = validUpto
        ? Math.ceil((validUpto - todayDate) / (1000 * 60 * 60 * 24))
        : null

      const isExpired      = daysLeft !== null && daysLeft < 0
      const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30

      // Next scheduled visit
      const upcomingVisit = (site.amc_visits || [])
        .filter(v => v.status === 'scheduled' && v.scheduled_date >= today)
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0] || null

      // Overdue visit (scheduled but past date)
      const overdueVisit = (site.amc_visits || [])
        .filter(v => v.status === 'scheduled' && v.scheduled_date < today)
        .length > 0

      return {
        ...site,
        days_left       : daysLeft,
        is_expired      : isExpired,
        is_expiring_soon: isExpiringSoon,
        next_visit      : upcomingVisit,
        has_overdue     : overdueVisit,
      }
    })

    return res.status(200).json(enriched)
  }

  // ── POST — add new site ────────────────────────────────
  if (req.method === 'POST') {
    const {
      client_name, address, city, site_type,
      system_size_kw, amc_valid_upto,
      contact_name, contact_phone,
      assigned_to_emp_code, assigned_to_name,
      service_day_1, service_day_2,
      notes,
    } = req.body

    if (!client_name || !site_type) {
      return res.status(400).json({ error: 'client_name and site_type are required' })
    }

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .insert([{
        client_name,
        address              : address            || 'Navi Mumbai',
        city                 : city               || null,
        site_type,
        system_size_kw       : system_size_kw     || null,
        amc_valid_upto       : amc_valid_upto      || null,
        contact_name         : contact_name        || null,
        contact_phone        : contact_phone       || null,
        assigned_to_emp_code : assigned_to_emp_code || null,
        assigned_to_name     : assigned_to_name    || null,
        service_day_1        : service_day_1       || null,
        service_day_2        : service_day_2       || null,
        notes                : notes               || null,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── PUT — update site ──────────────────────────────────
  if (req.method === 'PUT') {
    const { id, client_name, address, city, site_type, system_size_kw, amc_valid_upto, contact_name, contact_phone, assigned_to_emp_code, assigned_to_name, service_day_1, service_day_2, notes, is_active } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })

    // SECURE: Whitelist fields to prevent mass-assignment (Critical #5)
    const updates = { client_name, address, city, site_type, system_size_kw, amc_valid_upto, contact_name, contact_phone, assigned_to_emp_code, assigned_to_name, service_day_1, service_day_2, notes, is_active }

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
