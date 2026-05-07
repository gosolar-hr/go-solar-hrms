import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const today    = new Date().toISOString().split('T')[0]
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // 1. Expired AMC sites
  const { data: expired } = await supabaseAdmin
    .from('amc_sites')
    .select('id, client_name, amc_valid_upto, assigned_to_name, system_size_kw')
    .eq('is_active', true)
    .lt('amc_valid_upto', today)

  // 2. Expiring within 30 days
  const { data: expiring } = await supabaseAdmin
    .from('amc_sites')
    .select('id, client_name, amc_valid_upto, assigned_to_name, system_size_kw')
    .eq('is_active', true)
    .gte('amc_valid_upto', today)
    .lte('amc_valid_upto', in30days)

  // 3. Overdue visits (scheduled but past date)
  const { data: overdueVisits } = await supabaseAdmin
    .from('amc_visits')
    .select('id, scheduled_date, amc_sites(client_name, assigned_to_name), employees(name)')
    .eq('status', 'scheduled')
    .lt('scheduled_date', today)

  // 4. Today's visits
  const { data: todayVisits } = await supabaseAdmin
    .from('amc_visits')
    .select('id, scheduled_date, amc_sites(client_name, assigned_to_name), employees(name), technician_name')
    .eq('status', 'scheduled')
    .eq('scheduled_date', today)

  const alerts = []

  // Expired alerts
  ;(expired || []).forEach(s => {
    const daysAgo = Math.abs(
      Math.ceil((new Date(s.amc_valid_upto) - new Date()) / (1000*60*60*24))
    )
    alerts.push({
      type     : 'expired',
      severity : 'error',
      site_id  : s.id,
      title    : `AMC Expired — ${s.client_name}`,
      message  : `Expired ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`,
      meta     : `${s.system_size_kw ? s.system_size_kw + ' kW · ' : ''}Assigned: ${s.assigned_to_name || 'Unassigned'}`,
      date     : s.amc_valid_upto,
    })
  })

  // Expiring soon alerts
  ;(expiring || []).forEach(s => {
    const daysLeft = Math.ceil(
      (new Date(s.amc_valid_upto) - new Date()) / (1000*60*60*24)
    )
    alerts.push({
      type     : 'expiring',
      severity : daysLeft <= 7 ? 'warning' : 'info',
      site_id  : s.id,
      title    : `AMC Expiring — ${s.client_name}`,
      message  : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
      meta     : `${s.system_size_kw ? s.system_size_kw + ' kW · ' : ''}Assigned: ${s.assigned_to_name || 'Unassigned'}`,
      date     : s.amc_valid_upto,
    })
  })

  // Overdue visits
  ;(overdueVisits || []).forEach(v => {
    const daysAgo = Math.abs(
      Math.ceil((new Date(v.scheduled_date) - new Date()) / (1000*60*60*24))
    )
    alerts.push({
      type     : 'overdue_visit',
      severity : 'warning',
      site_id  : v.amc_sites?.id,
      title    : `Visit Overdue — ${v.amc_sites?.client_name || 'Unknown'}`,
      message  : `Was due ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`,
      meta     : `Technician: ${v.employees?.name || v.technician_name || 'Unassigned'}`,
      date     : v.scheduled_date,
    })
  })

  // Today's visits
  ;(todayVisits || []).forEach(v => {
    alerts.push({
      type     : 'today_visit',
      severity : 'success',
      site_id  : v.amc_sites?.id,
      title    : `Visit Today — ${v.amc_sites?.client_name || 'Unknown'}`,
      message  : 'Scheduled for today',
      meta     : `Technician: ${v.employees?.name || v.technician_name || 'Unassigned'}`,
      date     : v.scheduled_date,
    })
  })

  // Sort: expired first, then expiring, then overdue, then today
  const ORDER = { expired:0, expiring:1, overdue_visit:2, today_visit:3 }
  alerts.sort((a, b) => ORDER[a.type] - ORDER[b.type])

  return res.status(200).json({
    alerts,
    counts: {
      expired       : (expired  || []).length,
      expiring      : (expiring || []).length,
      overdue_visits: (overdueVisits || []).length,
      today_visits  : (todayVisits   || []).length,
      total         : alerts.length,
    }
  })
}
