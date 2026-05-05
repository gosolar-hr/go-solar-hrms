-- ============================================================
-- Go Solar HRMS - Payroll Draft & OT System
-- ============================================================

-- 1. PAYROLL DRAFT TABLE
CREATE TABLE IF NOT EXISTS payroll_draft (
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year >= 2024),
  overtime_hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  incentive     NUMERIC(10,2) NOT NULL DEFAULT 0,
  loan          NUMERIC(10,2) NOT NULL DEFAULT 0,
  advance       NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes         TEXT,
  is_locked     BOOLEAN NOT NULL DEFAULT FALSE,
  locked_at     TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (employee_id, month, year)
);

-- 2. PAYROLL OT ENTRIES TABLE (for granular daily tracking)
CREATE TABLE IF NOT EXISTS payroll_ot_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month         SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT NOT NULL CHECK (year >= 2024),
  ot_hours      NUMERIC(10,2) NOT NULL,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. UPDATE PAYROLL TABLE (to store OT and Incentives permanently)
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS overtime_hours  NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS incentive       NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS loan            NUMERIC(10,2) DEFAULT 0;
ALTER TABLE payroll ADD COLUMN IF NOT EXISTS advance         NUMERIC(10,2) DEFAULT 0;

-- 4. UPDATE RECOVERIES (to link to payroll)
ALTER TABLE loan_recoveries    ADD COLUMN IF NOT EXISTS payroll_id UUID REFERENCES payroll(id) ON DELETE SET NULL;
ALTER TABLE advance_adjustments ADD COLUMN IF NOT EXISTS payroll_id UUID REFERENCES payroll(id) ON DELETE SET NULL;

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_ot_entries_emp_month ON payroll_ot_entries(employee_id, month, year);
CREATE INDEX IF NOT EXISTS idx_draft_month_year ON payroll_draft(month, year);
