import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
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
  return res.status(200).json(data)
}
