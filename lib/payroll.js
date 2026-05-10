// ============================================================
// Go Solar Solutions — Payroll Engine v3
// Includes: Overtime + Correct ESIC calculation
// ============================================================

const WORKING_DAYS  = 30
const WORKING_HOURS = 9   // standard hours per day

function round(val) {
  return Math.round(val * 100) / 100
}

// ============================================================
// Late Mark Policy — Go Solar Solutions
// Office time  : 9:30 AM
// Grace period : 15 minutes (up to 9:45 AM = no late mark)
//
// Login 9:30 – 9:45 → No late mark (grace period)
// Login after 9:45  → Late mark applicable
//
// Deduction slabs (per leave policy):
//   9:45 – 10:00 → 20% of daily salary
//   10:00 – 10:30 → 30% of daily salary
//   After 10:30  → 50% of daily salary
// ============================================================
export function lateMinutesToSlab(lateMinutes) {
  // lateMinutes = minutes after 9:30 AM

  // Grace period: up to 15 mins (9:30 to 9:45) = no deduction
  if (lateMinutes <= 15) return 0

  // 9:45 to 10:00 = 15 to 30 mins after 9:30 → 20%
  if (lateMinutes <= 30) return 0.2

  // 10:00 to 10:30 = 30 to 60 mins after 9:30 → 30%
  if (lateMinutes <= 60) return 0.3

  // After 10:30 = more than 60 mins after 9:30 → 50%
  return 0.5
}

// ─────────────────────────────────────────────────────────
// STEP 1: Calculate Overtime
// Hourly rate = (total CTC / working days) / working hours
// Overtime    = hourly rate × overtime hours
// ─────────────────────────────────────────────────────────
export function calculateOvertime(employee, overtimeHours = 0) {
  if (!overtimeHours || overtimeHours <= 0) {
    return { overtimeAmount: 0, hourlyRate: 0 }
  }

  const {
    basic_salary,
    hra        = 0,
    cca        = 0,
    conveyance = 0,
    allowances = 0,
  } = employee

  const totalCTC    = basic_salary + hra + cca + conveyance + allowances
  
  // HIGH #11: Use actual days in month for per-day calculation
  const daysInMonth = (employee.payrollMonth && employee.payrollYear)
    ? new Date(employee.payrollYear, employee.payrollMonth, 0).getDate()
    : 30
    
  const perDaySalary = totalCTC / daysInMonth
  const hourlyRate   = perDaySalary / WORKING_HOURS
  const overtimeAmount = hourlyRate * overtimeHours

  return {
    overtimeAmount: round(overtimeAmount),
    hourlyRate    : round(hourlyRate),
  }
}

// ─────────────────────────────────────────────────────────
// STEP 2: Gross Salary
// = Earned salary (prorated) - late deduction + overtime
// ─────────────────────────────────────────────────────────
export function calculateGrossSalary(
  employee, attendance, lateDeductionOverride = null,
  incentive = 0, overtimeAmount = 0,
  payrollMonth = null, payrollYear = null
) {
  const {
    basic_salary, hra = 0, cca = 0,
    conveyance = 0, allowances = 0,
    date_of_joining,
  } = employee

  const totalCTC     = basic_salary + hra + cca + conveyance + allowances
  // HIGH #11: Use actual days in month instead of hardcoded 30
  const daysInMonth  = (payrollMonth && payrollYear)
    ? new Date(payrollYear, payrollMonth, 0).getDate()
    : 30
  const perDaySalary = totalCTC / daysInMonth

  // ── Pro-rata for mid-month joiners ──────────────────
  let effectiveDays = WORKING_DAYS
  if (payrollMonth && payrollYear && date_of_joining) {
    const joining      = new Date(date_of_joining)
    const joiningMonth = joining.getMonth() + 1
    const joiningYear  = joining.getFullYear()
    if (joiningYear === payrollYear && joiningMonth === payrollMonth) {
      effectiveDays = new Date(payrollYear, payrollMonth, 0).getDate()
                      - joining.getDate() + 1
    }
  }

  const lwpDays = Number(attendance.leaves || 0)

  // Use pre-calculated late deduction if provided
  // otherwise fall back to late_marks × slab calculation
  const lateDeduction = lateDeductionOverride !== null
    ? lateDeductionOverride
    : (attendance.late_marks || 0) * perDaySalary * 0.5 // fallback 50%

  const lwpDeduction  = perDaySalary * lwpDays

  // Pro-rata adjustment for new joiners only
  const proRataDeduction = effectiveDays < daysInMonth
    ? perDaySalary * (daysInMonth - effectiveDays)
    : 0

  const earnedCTC = Math.max(0, totalCTC - lwpDeduction - proRataDeduction)

  const gross = Math.max(
    0,
    earnedCTC - lateDeduction
  ) + overtimeAmount + incentive

  return {
    gross         : round(gross),
    earnedCTC     : round(earnedCTC), // Base earned components before OT/Incentive
    lateDeduction : round(lateDeduction),
    lwpDeduction  : round(lwpDeduction),
    ctcPerDay     : round(perDaySalary),
    totalCTC      : round(totalCTC),
    effectiveDays,
  }
}

// ─────────────────────────────────────────────────────────
// STEP 3: PF
// 12% of basic, capped at ₹15,000 ceiling
// ─────────────────────────────────────────────────────────
export function calculatePF(employee, earnedCTC = null) {
  if (!employee.pf_applicable) return 0

  const totalCTC = Number(employee.basic_salary || 0) +
                   Number(employee.hra          || 0) +
                   Number(employee.cca          || 0) +
                   Number(employee.conveyance   || 0) +
                   Number(employee.allowances   || 0)

  let pfWage

  // HIGH #7/8: Prorate Basic using base earned CTC (excluding OT/Incentive)
  if (earnedCTC !== null && totalCTC > 0) {
    pfWage = (Number(employee.basic_salary || 0) / totalCTC) * earnedCTC
  } else {
    pfWage = Number(employee.basic_salary || 0)
  }

  const cappedWage = Math.min(pfWage, 15000)
  return round(cappedWage * 0.12)
}

// ─────────────────────────────────────────────────────────
// STEP 4: ESIC
// Per ESIC Act:
//   Eligibility: (Fixed Gross - Conveyance) <= ₹21,000
//   Contribution Wage: Earned Gross - Earned Conveyance
//   (Conveyance excluded, Overtime included in contribution)
// ─────────────────────────────────────────────────────────
export function calculateESIC(employee, earnedGross, earnedCTC = 0) {
  // Opt-out: skip ESIC entirely
  if (employee.esic_applicable === false) {
    return { employee: 0, employer: 0, esicWage: 0, applicable: false }
  }

  const totalCTC = Number(employee.basic_salary || 0) +
                   Number(employee.hra          || 0) +
                   Number(employee.cca          || 0) +
                   Number(employee.conveyance   || 0) +
                   Number(employee.allowances   || 0)

  // HIGH #3: Check eligibility against FIXED monthly wage, not earned
  const fixedESICWage = totalCTC - Number(employee.conveyance || 0)
  if (fixedESICWage > 21000) {
    return { employee: 0, employer: 0, esicWage: 0, applicable: false }
  }

  // Contribution is on ACTUAL EARNED gross (incl. OT) minus prorated conveyance
  let earnedConveyance = 0
  if (totalCTC > 0) {
    // We use earnedCTC (the base prorated salary) to find the correct ratio
    // but the subtraction is from the full earnedGross (which has OT)
    earnedConveyance = (Number(employee.conveyance || 0) / totalCTC) * earnedCTC
  }

  const esicWage = Math.max(0, earnedGross - earnedConveyance)

  if (esicWage <= 0) {
    return { employee: 0, employer: 0, esicWage: 0, applicable: true }
  }

  return {
    employee   : round(esicWage * 0.0075),
    employer   : round(esicWage * 0.0325),
    esicWage   : round(esicWage),
    applicable : true,
  }
}

// ─────────────────────────────────────────────────────────
// STEP 5: PT (Maharashtra)
// Male:   0–7500 = 0 | 7501–10000 = 175 | >10000 = 200
// Female: 0–25000 = 0 | >25000 = 200
// ─────────────────────────────────────────────────────────
export function calculatePT(grossSalary, month, gender = 'male') {
  const g   = (gender || 'male').toLowerCase()
  const feb = month === 2

  if (g === 'female') {
    if (grossSalary <= 25000) return 0
    // Over 25k: Feb is ₹300, others ₹200
    return feb ? 300 : 200
  }

  // Male
  if (grossSalary <= 7500)  return 0
  if (grossSalary <= 10000) return 175
  // Over 10k: Feb is ₹300, others ₹200
  return feb ? 300 : 200
}

// ─────────────────────────────────────────────────────────
// STEP 6: Net Salary
// Gross - PF - ESIC(employee) - PT - Loan - Advance
// ─────────────────────────────────────────────────────────
export function calculateNetSalary({
  gross, pf, esicEmployee, pt,
  loan = 0, advance = 0
}) {
  const totalDeductions = pf + esicEmployee + pt + loan + advance
  return round(Math.max(0, gross - totalDeductions))
}
// ─────────────────────────────────────────────────────────────
// OTHER DEDUCTIONS
// = Absent deduction + Late mark deduction
// Shown as separate line item on payslip and salary sheet
// ─────────────────────────────────────────────────────────────
export function calculateOtherDeductions(employee, attendance, lateDeductionOverride = null) {
  const totalCTC     = (employee.basic_salary || 0) + (employee.hra||0) +
                       (employee.cca||0) + (employee.conveyance||0) +
                       (employee.allowances||0)
  // HIGH #11: Use actual days in month
  const daysInMonth = (attendance.month && attendance.year)
    ? new Date(attendance.year, attendance.month, 0).getDate()
    : 30
  const perDaySalary = totalCTC / daysInMonth

  // Only actual LWP days — WO not included
  const lwpDays         = Number(attendance.leaves || 0)
  const absentDeduction = round(lwpDays * perDaySalary)
  
  const lateDeduction = lateDeductionOverride !== null
    ? lateDeductionOverride
    : round((attendance.late_marks || 0) * perDaySalary * 0.5)

  return {
    absentDeduction,
    lateDeduction,
    total: round(absentDeduction + lateDeduction),
  }
}
