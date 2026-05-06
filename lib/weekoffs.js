import { supabaseAdmin } from './supabase'

/**
 * Get week off dates for a given month/year
 * Respects employee's work_schedule:
 *   standard → Sun + 2nd & 4th Sat off
 *   6day     → Sun off only (no Sat offs)
 *   7day     → No forced week offs
 */
export async function getWeekOffDates(year, month, work_schedule = 'standard') {
  // Fetch holidays for this month
  const from = `${year}-${String(month).padStart(2, '0')}-01`
  const to   = new Date(year, month, 0).toISOString().split('T')[0]

  const { data: holidays } = await supabaseAdmin
    .from('holidays')
    .select('date')
    .eq('is_active', true)
    .gte('date', from)
    .lte('date', to)

  const holidayDates = new Set((holidays || []).map(h => h.date))
  const weekOffDates = new Set()

  const daysInMonth = new Date(year, month, 0).getDate()
  const saturdays   = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d       = new Date(year, month - 1, day)
    const dateStr = d.toISOString().split('T')[0]
    const dow     = d.getDay()

    if (work_schedule === '7day') {
      // No forced week offs — only holidays
      continue
    }

    if (dow === 0) {
      // Sunday — off for standard and 6day
      weekOffDates.add(dateStr)
    }

    if (dow === 6) {
      saturdays.push(dateStr)
    }
  }

  // Saturday offs — only for standard schedule
  if (work_schedule === 'standard') {
    if (saturdays.length >= 2) weekOffDates.add(saturdays[1])  // 2nd Saturday
    if (saturdays.length >= 4) weekOffDates.add(saturdays[3])  // 4th Saturday
  }

  return { weekOffDates, holidayDates }
}

/**
 * Calculate week offs for frontend use (no DB call)
 * Used in attendance.js calendar rendering
 */
export function getWeekOffDatesSync(year, month, work_schedule = 'standard') {
  const weekOffDates = new Set()
  const daysInMonth  = new Date(year, month, 0).getDate()
  const saturdays    = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d       = new Date(year, month - 1, day)
    const dateStr = d.toISOString().split('T')[0]
    const dow     = d.getDay()

    if (work_schedule === '7day') continue

    if (dow === 0) weekOffDates.add(dateStr)
    if (dow === 6) saturdays.push(dateStr)
  }

  if (work_schedule === 'standard') {
    if (saturdays.length >= 2) weekOffDates.add(saturdays[1])
    if (saturdays.length >= 4) weekOffDates.add(saturdays[3])
  }

  return weekOffDates
}
