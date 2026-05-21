import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data: loans } = await supabaseAdmin
    .from('employee_loans')
    .select('id, employee_id, total_amount, monthly_recovery, loan_recoveries(amount)')
    .eq('is_active', true)

  const { data: advances } = await supabaseAdmin
    .from('employee_advances')
    .select('id, employee_id, total_amount, monthly_adjustment, advance_adjustments(amount)')
    .eq('is_active', true)

  const summary = {}

  for (const l of (loans || [])) {
    const recovered = (l.loan_recoveries || [])
      .reduce((s, r) => s + Number(r.amount), 0)
    const balance = Number(l.total_amount) - recovered

    // Auto-close if fully recovered
    if (balance <= 0) {
      await supabaseAdmin
        .from('employee_loans')
        .update({ is_active: false })
        .eq('id', l.id)
      continue  // Skip — loan is closed
    }

    if (!summary[l.employee_id]) {
      summary[l.employee_id] = {
        loan_balance         : 0,
        loan_monthly_recovery: 0,
        advance_balance      : 0,
        advance_monthly      : 0,
      }
    }

    summary[l.employee_id].loan_balance          += balance
    // Cap monthly recovery at remaining balance
    summary[l.employee_id].loan_monthly_recovery +=
      Math.min(Number(l.monthly_recovery) || 0, balance)
  }

  for (const a of (advances || [])) {
    const adjusted = (a.advance_adjustments || [])
      .reduce((s, r) => s + Number(r.amount), 0)
    const balance = Number(a.total_amount) - adjusted

    // Auto-close if fully adjusted
    if (balance <= 0) {
      await supabaseAdmin
        .from('employee_advances')
        .update({ is_active: false })
        .eq('id', a.id)
      continue
    }

    if (!summary[a.employee_id]) {
      summary[a.employee_id] = {
        loan_balance         : 0,
        loan_monthly_recovery: 0,
        advance_balance      : 0,
        advance_monthly      : 0,
      }
    }

    summary[a.employee_id].advance_balance += balance
    summary[a.employee_id].advance_monthly +=
      Math.min(Number(a.monthly_adjustment) || 0, balance)
  }

  return res.status(200).json(summary)
}
