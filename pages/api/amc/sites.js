import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // GET — list all sites
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .select(`
        *,
        amc_contracts ( id, start_date, end_date,
          visit_frequency, status, contract_number ),
        amc_visits ( id, scheduled_date, status )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    // Enrich with next visit + contract status
    const enriched = data.map(site => {
      const activeContract = site.amc_contracts?.find(c => c.status === 'active')
      const upcoming = site.amc_visits
        ?.filter(v => v.status === 'scheduled')
        .sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))[0]

      const isExpiringSoon = activeContract
        ? (new Date(activeContract.end_date) - new Date()) / (1000*60*60*24) <= 30
        : false

      return {
        ...site,
        active_contract  : activeContract || null,
        next_visit       : upcoming || null,
        is_expiring_soon : isExpiringSoon,
      }
    })

    return res.status(200).json(enriched)
  }

  // POST — add new site
  if (req.method === 'POST') {
    const {
      client_name, address, city, site_type,
      system_size_kw, installation_date,
      contact_name, contact_phone, notes
    } = req.body

    if (!client_name || !address || !site_type) {
      return res.status(400).json({
        error: 'client_name, address and site_type are required'
      })
    }

    const { data, error } = await supabaseAdmin
      .from('amc_sites')
      .insert([{
        client_name, address, city, site_type,
        system_size_kw : system_size_kw || null,
        installation_date: installation_date || null,
        contact_name   : contact_name  || null,
        contact_phone  : contact_phone || null,
        notes          : notes         || null,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
