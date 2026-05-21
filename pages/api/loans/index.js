import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // GET — fetch all loans for an employee with recovery summary
  if (req.method === 'GET') {
    const { employee_id } = req.query
    if (!employee_id) return res.status(400).json({ error: 'employee_id required' })

    const { data: loans, error } = await supabaseAdmin
      .from('employee_loans')
      .select(`
        *,
        loan_recoveries ( amount, month, year )
      `)
      .eq('employee_id', employee_id)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })

    // Calculate recovered + balance per loan
    const enriched = loans.map(loan => {
      const recovered = (loan.loan_recoveries || [])
        .reduce((s, r) => s + Number(r.amount), 0)
      return {
        ...loan,
        total_recovered: recovered,
        balance        : Math.max(0, Number(loan.total_amount) - recovered),
      }
    })

    return res.status(200).json(enriched)
  }

  // POST — add new loan
  if (req.method === 'POST') {
    const { employee_id, loan_date, total_amount,
            monthly_recovery, description } = req.body
    if (!employee_id || !total_amount) {
      return res.status(400).json({ error: 'employee_id and total_amount required' })
    }

    const { data, error } = await supabaseAdmin
      .from('employee_loans')
      .insert([{
        employee_id,
        loan_date        : loan_date || new Date().toISOString().split('T')[0],
        total_amount,
        monthly_recovery : monthly_recovery || 0,
        description,
      }])
      .select().single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
