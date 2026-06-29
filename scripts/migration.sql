-- ============================================================
-- Migration: Salary Revision History & Payroll Snapshotting
-- ============================================================

-- 1. Create salary_revisions table
CREATE TABLE IF NOT EXISTS salary_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  basic_salary    NUMERIC(10,2) NOT NULL CHECK (basic_salary >= 0),
  hra             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  cca             NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cca >= 0),
  conveyance      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (conveyance >= 0),
  allowances      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  effective_date  DATE NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_employee_effective_date UNIQUE (employee_id, effective_date)
);

-- 2. Add snapshot columns to payroll table
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS basic_salary NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS hra          NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS cca          NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS conveyance   NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS allowances   NUMERIC(10,2);
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(10,2) DEFAULT 0;

-- 3. Populate initial revisions from existing employees' current values
INSERT INTO salary_revisions (employee_id, basic_salary, hra, cca, conveyance, allowances, effective_date)
SELECT id, basic_salary, hra, cca, conveyance, allowances, date_of_joining
FROM employees
ON CONFLICT (employee_id, effective_date) DO NOTHING;
