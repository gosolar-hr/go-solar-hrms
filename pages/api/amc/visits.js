import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // GET — visits with optional filters
  if (req.method === 'GET') {
    const { site_id, status, upcoming } = req.query

    let query = supabaseAdmin
      .from('amc_visits')
      .select(`
        *,
        amc_sites ( client_name, address, site_type ),
        employees ( name, emp_code )
      `)
      .order('scheduled_date')

    if (site_id)  query = query.eq('site_id', site_id)
    if (status)   query = query.eq('status', status)
    if (upcoming) query = query.gte('scheduled_date', new Date().toISOString().split('T')[0])

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // PUT — update visit (complete, reschedule, add checklist)
  if (req.method === 'PUT') {
    const {
      id, status, scheduled_date, completed_date,
      technician_id, technician_name,
      checklist, remarks
    } = req.body

    const updates = {
      status,
      completed_date  : completed_date  || null,
      technician_id   : technician_id   || null,
      technician_name : technician_name || null,
      checklist       : checklist       || {},
      remarks         : remarks         || null,
    }

    // Only update scheduled_date when explicitly provided (reschedule flow)
    if (scheduled_date) updates.scheduled_date = scheduled_date

    const { data, error } = await supabaseAdmin
      .from('amc_visits')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // POST — add manual visit
  if (req.method === 'POST') {
    const {
      site_id, contract_id, scheduled_date,
      technician_id, technician_name, remarks
    } = req.body

    if (!site_id || !scheduled_date) {
      return res.status(400).json({ error: 'site_id and scheduled_date required' })
    }

    const { data, error } = await supabaseAdmin
      .from('amc_visits')
      .insert([{
        site_id,
        contract_id    : contract_id    || null,
        scheduled_date,
        status         : 'scheduled',
        technician_id  : technician_id  || null,
        technician_name: technician_name|| null,
        remarks        : remarks        || null,
        checklist      : {
          panel_cleaning     : false,
          inverter_check     : false,
          battery_voltage    : false,
          dc_wiring          : false,
          ac_output          : false,
          performance_review : false,
          earthing_check     : false,
          thermographic_scan : false,
        }
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  // DELETE — remove a visit (HR only — enforced in UI, double-checked here)
  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'Visit id required' })

    const { error } = await supabaseAdmin
      .from('amc_visits')
      .delete()
      .eq('id', id)

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ success: true })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
