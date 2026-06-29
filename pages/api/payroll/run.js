import { supabaseAdmin } from '../../../lib/supabase'
import {
  calculateOvertime,
  calculateGrossSalary,
  calculatePF,
  calculateESIC,
  calculatePT,
  calculateNetSalary,
  calculateOtherDeductions,
} from '../../../lib/payroll'
import { requireRole } from '../../../lib/requireAuth'
import {
  ensureMonthlyAttendanceDetails,
  refreshAttendanceSummary,
} from '../../../lib/attendanceUtils'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { month, year, late_mark_slab } = req.body

  if (!month || !year) {
    return res.status(400).json({ error: 'month and year required' })
  }

  // ── STEP 1: Check if payroll already locked ──────────
  const { data: lockCheck } = await supabaseAdmin
    .from('payroll_draft')
    .select('is_locked')
    .eq('month', month)
    .eq('year',  year)
    .eq('is_locked', true)
    .limit(1)

  if (lockCheck?.length > 0) {
    return res.status(403).json({
      error    : `Payroll for ${month}/${year} has already been finalized.`,
      is_locked: true,
    })
  }

  // ── STEP 2: Load variable pay from draft ─────────────
  const { data: draftEntries } = await supabaseAdmin
    .from('payroll_draft')
    .select('*')
    .eq('month', month)
    .eq('year',  year)

  const draftMap = {}
  ;(draftEntries || []).forEach(d => { draftMap[d.employee_id] = d })

  // ── STEP 3: Fetch active employees ───────────────────
  const { data: employees, error: empError } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('is_active', true)

  if (empError) return res.status(500).json({ error: empError.message })

  // ── STEP 3.5: Attendance Sync ────────────────────────
  // Pre-fetch holidays to avoid redundant DB calls in the loop
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

  const { data: holidays } = await supabaseAdmin
    .from('holidays')
    .select('date')
    .eq('is_active', true)
    .gte('date', from)
    .lte('date', to)
  const holidayDates = new Set((holidays || []).map(h => h.date))

  for (const emp of employees || []) {
    try {
      await ensureMonthlyAttendanceDetails(emp, month, year, holidayDates)
      await refreshAttendanceSummary(emp.id, month, year)
    } catch (syncError) {
      return res.status(500).json({
        error: `Attendance sync failed for ${emp.name || emp.emp_code || emp.id}: ${syncError.message}`,
      })
    }
  }

  // ── STEP 4: Fetch attendance summary ─────────────────
  const { data: attendanceList, error: attError } = await supabaseAdmin
    .from('attendance')
    .select('*')
    .eq('month', month)
    .eq('year',  year)

  if (attError) return res.status(500).json({ error: attError.message })

  const attendanceMap = {}
  attendanceList.forEach(a => { attendanceMap[a.employee_id] = a })

  // ── STEP 5: Fetch late mark details (actual slabs) ────
  const { data: lateDetails } = await supabaseAdmin
    .from('attendance_details')
    .select('employee_id, salary_cut')
    .gte('date', from)
    .lte('date', to)
    .gt('salary_cut', 0)

  const lateByEmp = {}
  ;(lateDetails || []).forEach(d => {
    if (!lateByEmp[d.employee_id]) lateByEmp[d.employee_id] = []
    lateByEmp[d.employee_id].push(Number(d.salary_cut))
  })

  // Fetch active salary revisions up to the end of the run month
  let allRevisions = []
  try {
    const runMonthEnd = `${year}-${String(month).padStart(2,'0')}-${lastDay}`
    const { data: revs, error: revsErr } = await supabaseAdmin
      .from('salary_revisions')
      .select('*')
      .lte('effective_date', runMonthEnd)
      .order('effective_date', { ascending: false })
    if (!revsErr && revs) {
      allRevisions = revs
    }
  } catch (e) {
    console.error('Failed to fetch salary revisions:', e)
  }

  // ── STEP 6: Calculate payroll for each employee ───────
  const payrollRows = []
  const results     = []

  for (const emp of employees) {
    const attendance = attendanceMap[emp.id] || {
      present_days: 30, leaves: 0, late_marks: 0
    }

    const draft         = draftMap[emp.id] || {}
    const overtimeHours = Number(draft.overtime_hours || 0)
    const incentive     = Number(draft.incentive      || 0)
    const loan          = Number(draft.loan           || 0)
    const advance       = Number(draft.advance        || 0)

    const activeRevision = (allRevisions || []).find(r => r.employee_id === emp.id)
    const activeBasic = activeRevision ? Number(activeRevision.basic_salary) : Number(emp.basic_salary || 0)
    const activeHRA   = activeRevision ? Number(activeRevision.hra) : Number(emp.hra || 0)
    const activeCCA   = activeRevision ? Number(activeRevision.cca) : Number(emp.cca || 0)
    const activeConv  = activeRevision ? Number(activeRevision.conveyance) : Number(emp.conveyance || 0)
    const activeAllow = activeRevision ? Number(activeRevision.allowances) : Number(emp.allowances || 0)

    const activeEmp = {
      ...emp,
      basic_salary: activeBasic,
      hra: activeHRA,
      cca: activeCCA,
      conveyance: activeConv,
      allowances: activeAllow
    }

    const totalCTC = activeBasic + activeHRA + activeCCA + activeConv + activeAllow
    
    // HIGH #11: Use actual days in month
    const daysInMonth = new Date(year, month, 0).getDate()
    const perDay   = totalCTC / daysInMonth

    // Late mark deduction: use daily slabs if present, otherwise fall back to count * slab
    const empLateSlabs = lateByEmp[emp.id] || []
    let lateDeduction = 0
    if (empLateSlabs.length > 0) {
      lateDeduction = empLateSlabs.reduce((sum, slab) => sum + (perDay * slab), 0)
    } else if (attendance.late_marks > 0) {
      const slabFraction = (late_mark_slab !== undefined ? Number(late_mark_slab) : 50) / 100
      lateDeduction = (attendance.late_marks || 0) * perDay * slabFraction
    }
    lateDeduction = Math.round(lateDeduction * 100) / 100

    // Overtime — pass month/year context
    const { overtimeAmount, hourlyRate } = calculateOvertime({ ...activeEmp, payrollMonth: month, payrollYear: year }, overtimeHours)

    // Gross Salary (Deduction based)
    const { gross, earnedCTC, lwpDeduction } = calculateGrossSalary(
      activeEmp, attendance,
      lateDeduction,
      incentive, overtimeAmount,
      month, year
    )

    const earnedBasic = totalCTC > 0
      ? Math.round(activeBasic * (earnedCTC / totalCTC))
      : 0

    const pf   = calculatePF(activeEmp, earnedBasic)
    const esic = calculateESIC(activeEmp, gross, earnedCTC)
    const pt   = calculatePT(gross, month, activeEmp.gender)
    
    // Display-only deductions
    const otherDed = calculateOtherDeductions(activeEmp, attendance, lateDeduction)

    const net = calculateNetSalary({
      gross,
      pf,
      esicEmployee: esic.employee,
      pt,
      loan,
      advance,
      otherDeduction: otherDed.total,
    })

    const row = {
      employee_id    : emp.id,
      month,
      year,
      present_days   : Math.round(attendance.present_days * 2) / 2,
      gross_salary   : gross,
      pf_deduction   : pf,
      esic_deduction : esic.employee,
      pt_deduction   : pt,
      other_deductions : otherDed.total,
      loan,
      advance,
      incentive,
      overtime_hours : overtimeHours,
      overtime_amount: overtimeAmount,
      net_salary     : net,
      basic_salary   : activeBasic,
      hra            : activeHRA,
      cca            : activeCCA,
      conveyance     : activeConv,
      allowances     : activeAllow,
    }

    payrollRows.push(row)
    results.push({
      name           : emp.name,
      emp_code       : emp.emp_code,
      department     : emp.department,
      present_days   : attendance.present_days,
      late_deduction : lateDeduction,
      hourly_rate    : hourlyRate,
      esic_wage      : esic.esicWage,
      ...row,
    })
  }

  // ── STEP 7: Upsert payroll ────────────────────────────
  const { error: payError } = await supabaseAdmin
    .from('payroll')
    .upsert(payrollRows, { onConflict: 'employee_id,month,year' })

  if (payError) return res.status(500).json({ error: payError.message })

  // ── STEP 8: Lock the draft ────────────────────────────
  const lockRows = employees.map(emp => ({
    employee_id   : emp.id,
    month,
    year,
    overtime_hours: Number(draftMap[emp.id]?.overtime_hours || 0),
    incentive     : Number(draftMap[emp.id]?.incentive      || 0),
    loan          : Number(draftMap[emp.id]?.loan           || 0),
    advance       : Number(draftMap[emp.id]?.advance        || 0),
    is_locked     : true,
    locked_at     : new Date().toISOString(),
    updated_at    : new Date().toISOString(),
  }))

  await supabaseAdmin
    .from('payroll_draft')
    .upsert(lockRows, { onConflict: 'employee_id,month,year' })

  // ── STEP 9: Record recoveries ─────────────────────────
  for (const row of payrollRows) {
    if (row.loan <= 0 && row.advance <= 0) continue

    const { data: savedPayroll } = await supabaseAdmin
      .from('payroll')
      .select('id')
      .eq('employee_id', row.employee_id)
      .eq('month', month)
      .eq('year', year)
      .single()

    const payrollId = savedPayroll?.id

    if (row.loan > 0) {
      const { data: loans } = await supabaseAdmin
        .from('employee_loans')
        .select('id, total_amount, loan_recoveries(amount)')
        .eq('employee_id', row.employee_id)
        .eq('is_active', true)
        .order('loan_date')

      for (const loan of (loans || [])) {
        const recovered = (loan.loan_recoveries || [])
          .reduce((s, r) => s + Number(r.amount), 0)
        const balance = Number(loan.total_amount) - recovered
        if (balance <= 0) continue

        const actualRecovery = Math.min(row.loan, balance)
        await supabaseAdmin
          .from('loan_recoveries')
          .upsert([{
            loan_id: loan.id, employee_id: row.employee_id,
            month, year, amount: actualRecovery, payroll_id: payrollId,
          }], { onConflict: 'loan_id,month,year' })

        if (balance - actualRecovery <= 0) {
          await supabaseAdmin.from('employee_loans').update({ is_active: false }).eq('id', loan.id)
        }

        row.loan -= actualRecovery
        if (row.loan <= 0) break
      }
    }

    if (row.advance > 0) {
      const { data: advances } = await supabaseAdmin
        .from('employee_advances')
        .select('id, total_amount, advance_adjustments(amount)')
        .eq('employee_id', row.employee_id)
        .eq('is_active', true)
        .order('advance_date')

      for (const adv of (advances || [])) {
        const adjusted = (adv.advance_adjustments || [])
          .reduce((s, r) => s + Number(r.amount), 0)
        const balance = Number(adv.total_amount) - adjusted
        if (balance <= 0) continue

        const actualAdjustment = Math.min(row.advance, balance)
        await supabaseAdmin
          .from('advance_adjustments')
          .upsert([{
            advance_id: adv.id, employee_id: row.employee_id,
            month, year, amount: actualAdjustment, payroll_id: payrollId,
          }], { onConflict: 'advance_id,month,year' })

        if (balance - actualAdjustment <= 0) {
          await supabaseAdmin.from('employee_advances').update({ is_active: false }).eq('id', adv.id)
        }

        row.advance -= actualAdjustment
        if (row.advance <= 0) break
      }
    }
  }

  return res.status(200).json({
    message  : `Payroll finalized and locked for ${month}/${year}`,
    count    : results.length,
    is_locked: true,
    payroll  : results,
  })
}
