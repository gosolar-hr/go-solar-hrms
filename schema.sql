-- ============================================================
-- Go Solar Solutions HRMS - Clean Slate + Recreate
-- ============================================================

DROP TABLE IF EXISTS payroll    CASCADE;
DROP TABLE IF EXISTS attendance CASCADE;
DROP TABLE IF EXISTS employees  CASCADE;

-- EMPLOYEES
CREATE TABLE employees (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT          NOT NULL,
  email             TEXT          NOT NULL UNIQUE,
  phone             TEXT,
  date_of_joining   DATE          NOT NULL,
  department        TEXT,
  basic_salary      NUMERIC(10,2) NOT NULL CHECK (basic_salary >= 0),
  hra               NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (hra >= 0),
  allowances        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  pf_applicable     BOOLEAN       NOT NULL DEFAULT TRUE,
  pan               TEXT,
  aadhaar           TEXT,
  bank_account      TEXT,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ATTENDANCE
CREATE TABLE attendance (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   UUID        NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month         SMALLINT    NOT NULL CHECK (month BETWEEN 1 AND 12),
  year          SMALLINT    NOT NULL CHECK (year >= 2020),
  present_days  SMALLINT    NOT NULL DEFAULT 0 CHECK (present_days >= 0),
  leaves        SMALLINT    NOT NULL DEFAULT 0 CHECK (leaves >= 0),
  late_marks    SMALLINT    NOT NULL DEFAULT 0 CHECK (late_marks >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_attendance UNIQUE (employee_id, month, year)
);

-- PAYROLL
CREATE TABLE payroll (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     UUID          NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month           SMALLINT      NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            SMALLINT      NOT NULL CHECK (year >= 2020),
  gross_salary    NUMERIC(10,2) NOT NULL CHECK (gross_salary >= 0),
  pf_deduction    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (pf_deduction >= 0),
  esic_deduction  NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (esic_deduction >= 0),
  pt_deduction    NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (pt_deduction >= 0),
  tds_deduction   NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (tds_deduction >= 0),
  net_salary      NUMERIC(10,2) NOT NULL CHECK (net_salary >= 0),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_payroll UNIQUE (employee_id, month, year)
);

-- INDEXES
CREATE INDEX idx_attendance_month_year ON attendance (month, year);
CREATE INDEX idx_payroll_month_year    ON payroll (month, year);
CREATE INDEX idx_payroll_employee      ON payroll (employee_id);
