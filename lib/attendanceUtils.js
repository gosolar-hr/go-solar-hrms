import { supabaseAdmin } from './supabase'

/**
 * Check and apply the sandwich rule for a range of dates
 * Policy: If an employee is absent on the workday BEFORE and AFTER 
 * a sequence of weekoffs/holidays, the intervening days are also marked LWP.
 */
export async function applySandwichRule(employee_id, month, year) {
  // 1. Fetch all attendance for the month
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

  const { data: allDays } = await supabaseAdmin
    .from('attendance_details')
    .select('date, status, salary_cut')
    .eq('employee_id', employee_id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (!allDays?.length) return []

  const statusMap = {}
  allDays.forEach(d => statusMap[d.date] = d.status)

  const sandwichDates = []
  
  for (let i = 1; i < allDays.length - 1; i++) {
    const current = allDays[i]
    const s = current.status
    
    // Only apply to Week Offs and Holidays
    if (s !== 'WO' && s !== 'W/O' && s !== 'H') continue

    // Find the nearest ACTUAL workdays before and after
    let prevWorkday = null
    for (let j = i - 1; j >= 0; j--) {
      const st = allDays[j].status
      if (st !== 'WO' && st !== 'W/O' && st !== 'H') {
        prevWorkday = allDays[j]
        break
      }
    }

    let nextWorkday = null
    for (let j = i + 1; j < allDays.length; j++) {
      const st = allDays[j].status
      if (st !== 'WO' && st !== 'W/O' && st !== 'H') {
        nextWorkday = allDays[j]
        break
      }
    }

    if (prevWorkday && nextWorkday) {
      const isPrevAbsent = ['A','A:A','LWP','LOP'].includes(prevWorkday.status)
      const isNextAbsent = ['A','A:A','LWP','LOP'].includes(nextWorkday.status)

      if (isPrevAbsent && isNextAbsent) {
        sandwichDates.push(current.date)
      }
    }
  }

  if (sandwichDates.length > 0) {
    // Convert sandwich days to LWP
    const updates = sandwichDates.map(date => ({
      employee_id,
      date,
      status: 'LWP',
      remark: 'Sandwich Rule Applied',
    }))

    await supabaseAdmin
      .from('attendance_details')
      .upsert(updates, { onConflict: 'employee_id,date' })
  }

  return sandwichDates
}

/**
 * Recalculate the attendance summary for an employee/month
 */
export async function refreshAttendanceSummary(employee_id, month, year) {
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

  const { data: allDays } = await supabaseAdmin
    .from('attendance_details')
    .select('status, salary_cut')
    .eq('employee_id', employee_id)
    .gte('date', from)
    .lte('date', to)

  let present_days = 0
  let absent_days  = 0
  let late_marks   = 0

  for (const d of allDays || []) {
    const s = (d.status || '').toUpperCase().trim()

    if (s === 'P' || s === 'P:P') {
      present_days++
      if (d.salary_cut > 0) late_marks++
    }
    else if (s === 'PL')              { present_days++ }
    else if (s === 'MO' || s === 'AO') { present_days += 0.5; absent_days += 0.5 }
    else if (s === 'P:A' || s === 'A:P') { present_days += 0.5; absent_days += 0.5 }
    else if (s === 'A' || s === 'A:A' || s === 'LWP' || s === 'LOP') { absent_days++ }
  }

  await supabaseAdmin
    .from('attendance')
    .upsert([{
      employee_id, month, year,
      present_days, leaves: absent_days, late_marks
    }], { onConflict: 'employee_id,month,year' })

  return { present_days, absent_days, late_marks }
}
