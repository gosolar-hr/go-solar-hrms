import { supabaseAdmin } from './supabase'

/**
 * Check and apply the sandwich rule for a range of dates.
 * Policy: If an employee is absent on the workday BEFORE and AFTER
 * a sequence of weekoffs/holidays, the intervening days are also marked LWP.
 *
 * This function is fully reversible: if a previously sandwiched day no
 * longer satisfies the rule (e.g. HR marks the adjacent absent day as
 * Present), it is automatically restored to its original W/O or H status.
 */
export async function applySandwichRule(employee_id, month, year) {
  const from    = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to      = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

  // ── STEP 1: Fetch full month details ─────────────────
  const { data: allDays } = await supabaseAdmin
    .from('attendance_details')
    .select('date, status, salary_cut, remark')
    .eq('employee_id', employee_id)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })

  if (!allDays?.length) return []

  // ── STEP 2: Restore previously sandwiched days ───────
  // Any day currently marked LWP with remark 'Sandwich Rule Applied'
  // was set by a previous run. Reset it back to its original status
  // (W/O or H) so the evaluation below starts from a clean slate.
  const toRestore = allDays.filter(
    d => d.status === 'LWP' && d.remark === 'Sandwich Rule Applied'
  )

  if (toRestore.length > 0) {
    // Fetch holidays so we can correctly restore H vs W/O
    const { data: holidays } = await supabaseAdmin
      .from('holidays')
      .select('date')
      .gte('date', from)
      .lte('date', to)

    const holidaySet = new Set((holidays || []).map(h => h.date))

    const restoreRows = toRestore.map(d => ({
      employee_id,
      date      : d.date,
      status    : holidaySet.has(d.date) ? 'H' : 'W/O',
      salary_cut: 0,
      remark    : null,
    }))

    await supabaseAdmin
      .from('attendance_details')
      .upsert(restoreRows, { onConflict: 'employee_id,date' })

    // Update local array so evaluation below sees restored statuses
    restoreRows.forEach(r => {
      const day = allDays.find(d => d.date === r.date)
      if (day) { day.status = r.status; day.remark = null }
    })
  }

  // ── STEP 3: Re-evaluate which days satisfy the rule ──
  const sandwichDates = []

  for (let i = 1; i < allDays.length - 1; i++) {
    const current = allDays[i]
    const s = current.status

    // Only W/O and H can be sandwiched
    if (s !== 'WO' && s !== 'W/O' && s !== 'H') continue

    // Nearest actual workday before
    let prevWorkday = null
    for (let j = i - 1; j >= 0; j--) {
      const st = allDays[j].status
      if (st !== 'WO' && st !== 'W/O' && st !== 'H') { prevWorkday = allDays[j]; break }
    }

    // Nearest actual workday after
    let nextWorkday = null
    for (let j = i + 1; j < allDays.length; j++) {
      const st = allDays[j].status
      if (st !== 'WO' && st !== 'W/O' && st !== 'H') { nextWorkday = allDays[j]; break }
    }

    if (prevWorkday && nextWorkday) {
      const isPrevAbsent = ['A','A:A','LWP','LOP'].includes(prevWorkday.status)
      const isNextAbsent = ['A','A:A','LWP','LOP'].includes(nextWorkday.status)
      if (isPrevAbsent && isNextAbsent) sandwichDates.push(current.date)
    }
  }

  // ── STEP 4: Convert qualifying days to LWP ───────────
  if (sandwichDates.length > 0) {
    const updates = sandwichDates.map(date => ({
      employee_id,
      date,
      status    : 'LWP',
      salary_cut: 0,   // explicitly zero — prevents null breaking late_marks count
      remark    : 'Sandwich Rule Applied',
    }))

    await supabaseAdmin
      .from('attendance_details')
      .upsert(updates, { onConflict: 'employee_id,date' })
  }

  return sandwichDates
}

/**
 * Recalculate the attendance summary (present_days, leaves, late_marks)
 * for an employee/month and write it back to the attendance table.
 */
export async function refreshAttendanceSummary(employee_id, month, year) {
  const from    = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to      = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

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
    else if (s === 'PL')                             { present_days++ }
    else if (s === 'WO' || s === 'W/O' || s === 'H'){ present_days++ }  // W/O and Holidays are paid days
    else if (s === 'MO' || s === 'AO')               { present_days += 0.5; absent_days += 0.5 }
    else if (s === 'P:A' || s === 'A:P')             { present_days += 0.5; absent_days += 0.5 }
    else if (['A','A:A','LWP','LOP'].includes(s))    { absent_days++ }
  }

  await supabaseAdmin
    .from('attendance')
    .upsert([{
      employee_id, month, year,
      present_days, leaves: absent_days, late_marks,
    }], { onConflict: 'employee_id,month,year' })

  return { present_days, absent_days, late_marks }
}
