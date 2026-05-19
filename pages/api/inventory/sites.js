import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// ── Inventory Sites API ────────────────────────────────────────────
// Single source of truth for all sites. Both Inventory and AMC read
// from amc_sites table — no duplication.

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  // ── GET — list sites ─────────────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabaseAdmin
      .from('amc_sites')
      .select('*')
      .eq('is_active', true)
      .order('client_name')

    // Optional filter: ?status=pre_amc | active | all
    if (req.query.status && req.query.status !== 'all') {
      query = query.eq('project_status', req.query.status)
    }

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data || [])
  }

  // ── POST — create new site from Inventory ────────────────────────
  if (req.method === 'POST') {
    if (session.role !== 'hr') {
      return res.status(403).json({ error: 'Only HR can create sites' })
    }

    const {
      client_name, site_type, address, city,
      system_size_kw, sanctioned_load_kw,
      installation_date,
      contact_name, contact_phone,
      assigned_to_emp_code, assigned_to_name,
      notes,
    } = req.body

    if (!client_name) {
      return res.status(400).json({ error: 'Site / Client name is required' })
    }

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .insert([{
        client_name,
        site_type            : site_type          || 'commercial',
        address              : address             || '',
        city                 : city                || null,
        system_size_kw       : system_size_kw      ? Number(system_size_kw)     : null,
        sanctioned_load_kw   : sanctioned_load_kw  ? Number(sanctioned_load_kw) : null,
        installation_date    : installation_date    || null,
        contact_name         : contact_name         || null,
        contact_phone        : contact_phone        || null,
        assigned_to_emp_code : assigned_to_emp_code || null,
        assigned_to_name     : assigned_to_name     || null,
        notes                : notes                || null,
        project_status       : 'pre_amc',   // all new sites start as pre-AMC
        amc_valid_upto       : null,        // set later when AMC is activated in O&M module
        is_active            : true,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // ── PUT — update site details ────────────────────────────────────
  if (req.method === 'PUT') {
    if (session.role !== 'hr') {
      return res.status(403).json({ error: 'Only HR can update sites' })
    }

    const {
      id, client_name, site_type, address, city,
      system_size_kw, sanctioned_load_kw,
      installation_date,
      contact_name, contact_phone,
      assigned_to_emp_code, assigned_to_name,
      notes, project_status,
    } = req.body

    if (!id) return res.status(400).json({ error: 'id is required' })

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .update({
        client_name, site_type, address, city,
        system_size_kw       : system_size_kw     ? Number(system_size_kw)     : null,
        sanctioned_load_kw   : sanctioned_load_kw  ? Number(sanctioned_load_kw) : null,
        installation_date    : installation_date    || null,
        contact_name, contact_phone,
        assigned_to_emp_code : assigned_to_emp_code || null,
        assigned_to_name     : assigned_to_name     || null,
        notes,
        ...(project_status ? { project_status } : {}),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
