import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { month, year } = req.query

  let query = supabaseAdmin
    .from('payroll')
    .select(`
      *,
      employees (
        name, emp_code, designation, department,
        date_of_joining, basic_salary, hra, cca,
        conveyance, allowances, pan, bank_account,
        uan_number, pf_applicable, gender
      )
    `)
    .order('created_at', { ascending: false })

  if (month) query = query.eq('month', parseInt(month))
  if (year)  query = query.eq('year',  parseInt(year))

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })

  // SECURE: PII Masking for list view (High #8)
  const masked = data.map(record => {
    const emp = record.employees
    if (!emp) return record

    const basic = record.basic_salary !== null && record.basic_salary !== undefined ? record.basic_salary : emp.basic_salary
    const hra = record.hra !== null && record.hra !== undefined ? record.hra : emp.hra
    const cca = record.cca !== null && record.cca !== undefined ? record.cca : emp.cca
    const conveyance = record.conveyance !== null && record.conveyance !== undefined ? record.conveyance : emp.conveyance
    const allowances = record.allowances !== null && record.allowances !== undefined ? record.allowances : emp.allowances

    return {
      ...record,
      employees: {
        ...emp,
        basic_salary: Number(basic),
        hra: Number(hra),
        cca: Number(cca),
        conveyance: Number(conveyance),
        allowances: Number(allowances),
        pan: emp.pan ? `XXXXX${emp.pan.slice(-4)}` : '—',
        bank_account: emp.bank_account ? `XXXX${emp.bank_account.slice(-4)}` : '—',
        uan_number: emp.uan_number ? `XXXX${emp.uan_number.slice(-4)}` : '—'
      }
    }
  })

  return res.status(200).json(masked)
}
