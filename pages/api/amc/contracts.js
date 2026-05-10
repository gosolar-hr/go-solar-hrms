import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // POST — create contract for a site
  if (req.method === 'POST') {
    const {
      site_id, start_date, end_date,
      visit_frequency, contract_value, notes
    } = req.body

    if (!site_id || !start_date || !end_date || !visit_frequency) {
      return res.status(400).json({
        error: 'site_id, start_date, end_date and visit_frequency required'
      })
    }

    // Auto-generate contract number
    const { count } = await supabaseAdmin
      .from('amc_contracts')
      .select('*', { count: 'exact', head: true })

    const contract_number = `AMC-${String((count || 0) + 1).padStart(4, '0')}`

    const { data, error } = await supabaseAdmin
      .from('amc_contracts')
      .insert([{
        site_id, start_date, end_date,
        visit_frequency,
        contract_value : contract_value || 0,
        contract_number,
        status         : 'active',
        notes          : notes || null,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })

    // Auto-generate scheduled visits based on frequency
    await generateVisits(site_id, data.id, start_date, end_date, visit_frequency)

    return res.status(201).json(data)
  }

  // PUT — update contract status
  if (req.method === 'PUT') {
    const { id, status } = req.body
    const { data, error } = await supabaseAdmin
      .from('amc_contracts')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}

// Auto-generate visit schedule
async function generateVisits(site_id, contract_id, start, end, frequency) {
  const startDate = new Date(start)
  const endDate   = new Date(end)
  const visits    = []

  const intervals = {
    monthly     : 1,
    quarterly   : 3,
    half_yearly : 6,
    yearly      : 12,
  }

  const monthsInterval = intervals[frequency] || 3
  let current = new Date(startDate)
  // HIGH #9: Set to 1st to avoid month-skipping on 31st overflows
  const targetDay = startDate.getDate()

  while (current <= endDate) {
    // Generate the date for this specific month, capping at last day of month
    const year = current.getFullYear()
    const month = current.getMonth()
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()
    const dayToSet = Math.min(targetDay, lastDayOfMonth)
    
    const visitDate = new Date(year, month, dayToSet)
    if (visitDate <= endDate) {
      visits.push({
        site_id,
        contract_id,
        scheduled_date : `${year}-${String(month + 1).padStart(2,'0')}-${String(dayToSet).padStart(2,'0')}`,
        status         : 'scheduled',
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
      })
    }
    
    // Move to next interval, safely from 1st of current month
    current = new Date(year, month, 1)
    current.setMonth(current.getMonth() + monthsInterval)
  }

  if (visits.length > 0) {
    await supabaseAdmin.from('amc_visits').insert(visits)
  }
}
