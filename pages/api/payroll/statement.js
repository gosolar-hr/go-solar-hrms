import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { month, year } = req.query
  if (!month || !year) return res.status(400).json({ error: 'month and year required' })

  const { data, error } = await supabaseAdmin
    .from('payroll')
    .select(`
      *,
      employees (
        emp_code, name, date_of_joining, designation,
        basic_salary, hra, cca, conveyance, allowances,
        pf_applicable, pan, uan_number, bank_account
      )
    `)
    .eq('month', parseInt(month))
    .eq('year',  parseInt(year))
    .order('created_at')

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json(data)
}
