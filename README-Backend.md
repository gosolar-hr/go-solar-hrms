# Go Solar HRMS - Backend API Documentation

> [!NOTE]
> Database schema is available in [schema.sql](file:///Users/rohithpm/Documents/Playground/go-solar-hrms/schema.sql)

## 1. Employees API
**Endpoint:** `POST /api/employees`

### Sample Request
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@gosolar.in",
  "phone": "9876543210",
  "date_of_joining": "2024-04-01",
  "department": "Operations",
  "basic_salary": 18000,
  "hra": 4000,
  "allowances": 2000,
  "pf_applicable": true,
  "pan": "ABCPS1234D",
  "aadhaar": "123456789012",
  "bank_account": "SBI00012345"
}
```

### Sample Response (201 Created)
```json
{
  "id": "uuid-...",
  "name": "Arjun Sharma",
  "basic_salary": 18000,
  "hra": 4000,
  "allowances": 2000,
  "pf_applicable": true,
  "pan": "ABCPS1234D",
  "aadhaar": "123456789012",
  "bank_account": "SBI00012345"
}
```

---

## 2. Attendance API
**Endpoint:** `POST /api/attendance`

### Sample Request
```json
{
  "employee_id": "uuid-...",
  "month": 4,
  "year": 2025,
  "present_days": 24,
  "leaves": 2,
  "late_marks": 3
}
```

---

## 3. Payroll Processing
**Endpoint:** `POST /api/payroll/run`

### Sample Request
```json
{
  "month": 4,
  "year": 2025,
  "late_mark_slab": 50,
  "tds_overrides": {
    "uuid-arjun": 500
  }
}
```

### Sample Response (200 OK)
```json
{
  "message": "Payroll processed for 4/2025",
  "count": 1,
  "payroll": [
    {
      "name": "Arjun Sharma",
      "gross_salary": 22153.85,
      "pf_deduction": 1800.00,
      "esic_deduction": 0,
      "pt_deduction": 200,
      "tds_deduction": 500,
      "late_deduction": 846.15,
      "net_salary": 19653.85
    }
  ]
}
```

---

## 4. Payroll Retrieval
**Endpoint:** `GET /api/payroll?month=4&year=2025`

### Sample Response
```json
[
  {
    "id": "uuid-...",
    "employee_id": "uuid-...",
    "employees": { "name": "Arjun Sharma", "department": "Operations" },
    "gross_salary": 22153.85,
    "net_salary": 19653.85
  }
]
```

---

## 5. Key Design Decisions

- **Idempotent Payroll Processing**: The `upsert` logic on the payroll table makes re-runs safe. Running payroll multiple times for the same month and year will overwrite existing records rather than creating duplicates.
- **Gross Salary Calculation**: Late deductions are baked into the `gross_salary` before statutory deductions (PF/ESIC) are calculated. This ensures that PF/ESIC apply to the actual earned gross salary.
- **ESIC Employer Share**: The employer's share of ESIC is calculated and returned in the API but is not stored in the `payroll` table (as it is a company cost, not an employee deduction).
- **Data Integrity**: All salary figures should use `NUMERIC(10,2)` in the database to avoid floating-point rounding errors.---

## 6. Sample SQL for Testing

Use these queries in Supabase to verify your setup:

### Step 1: Insert an Employee
```sql
INSERT INTO employees (
  name, email, phone, date_of_joining,
  department, basic_salary, hra, allowances,
  pf_applicable, pan, aadhaar, bank_account
) VALUES (
  'Arjun Sharma',
  'arjun@gosolar.in',
  '9876543210',
  '2024-04-01',
  'Operations',
  18000.00,
  4000.00,
  2000.00,
  TRUE,
  'ABCPS1234D',
  '123456789012',
  'SBI00012345'
);
```

### Step 2: Insert Attendance (April 2025)
```sql
INSERT INTO attendance (
  employee_id, month, year, present_days, leaves, late_marks
) VALUES (
  (SELECT id FROM employees WHERE email = 'arjun@gosolar.in'),
  4, 2025, 24, 2, 3
);
```

### Step 3: Insert Payroll (April 2025)
```sql
INSERT INTO payroll (
  employee_id, month, year,
  gross_salary, pf_deduction, esic_deduction,
  pt_deduction, tds_deduction, net_salary
) VALUES (
  (SELECT id FROM employees WHERE email = 'arjun@gosolar.in'),
  4, 2025,
  22153.85, 1800.00, 0.00, 200.00, 500.00, 19653.85
);
```

### Step 4: Verify Everything
```sql
SELECT 
  e.name,
  a.present_days,
  a.late_marks,
  p.gross_salary,
  p.pf_deduction,
  p.pt_deduction,
  p.net_salary
FROM employees e
JOIN attendance a ON a.employee_id = e.id AND a.month = 4 AND a.year = 2025
JOIN payroll    p ON p.employee_id = e.id AND p.month = 4 AND p.year = 2025;
```
