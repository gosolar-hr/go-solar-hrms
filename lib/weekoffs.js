import { supabaseAdmin } from './supabase'

/**
 * Fetches active week off rules from DB and computes
 * all week off dates for a given month/year.
 * Also fetches declared holidays for that month.
 *
 * Returns: Set of date strings ['2026-03-01', '2026-03-08', ...]
 */
export async function getWeekOffDates(year, month) {
  // Fetch active rules
  const { data: rules } = await supabaseAdmin
    .from('week_off_rules')
    .select('rule_type')
    .eq('is_active', true)

  // Fetch holidays for this month
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: holidays } = await supabaseAdmin
    .from('holidays')
    .select('date')
    .eq('is_active', true)
    .gte('date', from)
    .lte('date', to)

  const activeRules  = new Set((rules  || []).map(r => r.rule_type))
  const weekOffDates = new Set()
  const holidayDates = new Set()

  // Add holidays
  ;(holidays || []).forEach(h => holidayDates.add(h.date))

  // Calculate all days in month
  const daysInMonth = new Date(year, month, 0).getDate()
  const saturdays   = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d       = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const dow     = d.getDay() // 0=Sun, 6=Sat

    if (dow === 0 && activeRules.has('sunday')) {
      weekOffDates.add(dateStr)
    }
    if (dow === 6) {
      saturdays.push(dateStr)
    }
  }

  // 2nd Saturday (index 1)
  if (activeRules.has('second_saturday') && saturdays.length >= 2) {
    weekOffDates.add(saturdays[1])
  }
  // 4th Saturday (index 3)
  if (activeRules.has('fourth_saturday') && saturdays.length >= 4) {
    weekOffDates.add(saturdays[3])
  }

  return { weekOffDates, holidayDates }
}
