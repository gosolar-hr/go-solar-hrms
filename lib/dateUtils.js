/**
 * Safely format a Date object or components to YYYY-MM-DD
 * avoiding timezone shifts from toISOString()
 */
export function formatDate(date) {
  if (!date) return null
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const r = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${r}`
}

/**
 * Get the last day of a month as YYYY-MM-DD
 */
export function getLastDayOfMonth(year, month) {
  // new Date(year, month, 0) gives the last day of the month
  const d = new Date(year, month, 0)
  return formatDate(d)
}

/**
 * Get the first day of a month as YYYY-MM-DD
 */
export function getFirstDayOfMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}-01`
}
