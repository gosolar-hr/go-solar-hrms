import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const { siteId } = req.query

  // GET — single site with full details
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .select(`
        *,
        amc_contracts (*),
        amc_visits (
          *, employees ( name, emp_code )
        )
      `)
      .eq('id', siteId)
      .single()

    if (error) return res.status(404).json({ error: 'Site not found' })
    return res.status(200).json(data)
  }

  // PUT — update site
  if (req.method === 'PUT') {
    const {
      client_name, address, city, site_type,
      system_size_kw, installation_date,
      contact_name, contact_phone, notes
    } = req.body

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .update({
        client_name, address, city, site_type,
        system_size_kw, installation_date,
        contact_name, contact_phone, notes
      })
      .eq('id', siteId)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // DELETE — soft delete
  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin
      .from('amc_sites')
      .update({ is_active: false })
      .eq('id', siteId)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ message: 'Site deactivated' })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
