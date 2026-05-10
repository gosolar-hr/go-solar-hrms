/**
 * Calculate week offs for frontend use (no DB call)
 * Used in attendance.js calendar rendering
 * 
 * Policy:
 *   standard → Sun + 2nd & 4th Sat off
 *   6day     → Sun off only
 *   7day     → No forced week offs
 */
export function getWeekOffDatesSync(year, month, work_schedule = 'standard') {
  const weekOffDates = new Set()
  const daysInMonth  = new Date(year, month, 0).getDate()
  const saturdays    = []

  for (let day = 1; day <= daysInMonth; day++) {
    const d       = new Date(year, month - 1, day)
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
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
