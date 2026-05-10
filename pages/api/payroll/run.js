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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { month, year } = req.body

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
  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const to   = `${year}-${String(month).padStart(2,'0')}-${lastDay}`

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

    const totalCTC = Number(emp.basic_salary||0) + Number(emp.hra||0) +
                     Number(emp.cca||0) + Number(emp.conveyance||0) +
                     Number(emp.allowances||0)
    
    // HIGH #11: Use actual days in month
    const daysInMonth = new Date(year, month, 0).getDate()
    const perDay   = totalCTC / daysInMonth

    // Late deduction from actual per-day slabs
    const empLateSlabs = lateByEmp[emp.id] || []
    const lateDeduction = Math.round(
      empLateSlabs.reduce((sum, slab) => sum + (perDay * slab), 0) * 100
    ) / 100

    // Overtime — pass month/year context
    const { overtimeAmount, hourlyRate } = calculateOvertime({ ...emp, payrollMonth: month, payrollYear: year }, overtimeHours)

    // Gross Salary (Deduction based)
    const { gross, earnedCTC, lwpDeduction } = calculateGrossSalary(
      emp, attendance,
      lateDeduction,
      incentive, overtimeAmount,
      month, year
    )

    const pf   = calculatePF(emp, earnedCTC)
    const esic = calculateESIC(emp, gross, earnedCTC)
    const pt   = calculatePT(gross, month, emp.gender)
    
    // Display-only deductions
    const otherDed = calculateOtherDeductions(emp, attendance, lateDeduction)

    const net  = calculateNetSalary({
      gross,
      pf,
      esicEmployee: esic.employee,
      pt,
      loan,
      advance,
    })

    const row = {
      employee_id    : emp.id,
      month,
      year,
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
