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
  const perDaySalary = totalCTC / WORKING_DAYS
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
  employee, attendance, lateSlabPercent = 0,
  incentive = 0, overtimeAmount = 0
) {
  const {
    basic_salary,
    hra        = 0,
    cca        = 0,
    conveyance = 0,
    allowances = 0,
  } = employee

  const { present_days, late_marks = 0 } = attendance

  const totalCTC      = basic_salary + hra + cca + conveyance + allowances
  const perDaySalary  = totalCTC / WORKING_DAYS
  const earnedSalary  = perDaySalary * present_days
  const lateDeduction = late_marks * perDaySalary * lateSlabPercent

  // Gross = earned - late deduction + overtime + incentive
  const gross = Math.max(0, earnedSalary - lateDeduction)
    + overtimeAmount
    + incentive

  return {
    gross        : round(gross),
    lateDeduction: round(lateDeduction),
    ctcPerDay    : round(perDaySalary),
    totalCTC     : round(totalCTC),
  }
}

// ─────────────────────────────────────────────────────────
// STEP 3: PF
// 12% of basic, capped at ₹15,000 ceiling
// ─────────────────────────────────────────────────────────
export function calculatePF(employee) {
  if (!employee.pf_applicable) return 0
  const pfWage = Math.min(employee.basic_salary, 15000)
  return round(pfWage * 0.12)
}

// ─────────────────────────────────────────────────────────
// STEP 4: ESIC
// Per ESIC Act:
//   ESIC Wage = Gross - Conveyance + Overtime
//   (Conveyance excluded, Overtime included)
//   Applicable only if ESIC Wage ≤ ₹21,000
//   Employee: 0.75% | Employer: 3.25%
// ─────────────────────────────────────────────────────────
export function calculateESIC(employee, grossSalary, overtimeAmount = 0) {
  const conveyance = Number(employee.conveyance || 0)

  // ESIC wage per Act: exclude conveyance, include overtime
  const esicWage = grossSalary - conveyance + overtimeAmount

  if (esicWage > 21000) return { employee: 0, employer: 0, esicWage }

  return {
    employee : round(esicWage * 0.0075),
    employer : round(esicWage * 0.0325),
    esicWage : round(esicWage),
  }
}

// ─────────────────────────────────────────────────────────
// STEP 5: PT (Maharashtra)
// Male:   0–7500 = 0 | 7501–10000 = 175 | >10000 = 200
// Female: 0–25000 = 0 | >25000 = 200
// ─────────────────────────────────────────────────────────
export function calculatePT(grossSalary, month, gender = 'male') {
  const g = (gender || 'male').toLowerCase()

  if (g === 'female') {
    return grossSalary <= 25000 ? 0 : 200
  }
  if (grossSalary <= 7500)  return 0
  if (grossSalary <= 10000) return 175
  return 200
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
export function calculateOtherDeductions(employee, attendance, lateSlabPercent = 0) {
  const {
    basic_salary,
    hra        = 0,
    cca        = 0,
    conveyance = 0,
    allowances = 0,
  } = employee

  const { leaves = 0, late_marks = 0 } = attendance

  const totalCTC     = basic_salary + hra + cca + conveyance + allowances
  const perDaySalary = totalCTC / WORKING_DAYS

  // Absent deduction = LWP days × per day salary
  const absentDeduction = round(leaves * perDaySalary)

  // Late mark deduction
  const lateDeduction = round(late_marks * perDaySalary * lateSlabPercent)

  const total = round(absentDeduction + lateDeduction)

  return {
    absentDeduction,
    lateDeduction,
    total,
  }
}
