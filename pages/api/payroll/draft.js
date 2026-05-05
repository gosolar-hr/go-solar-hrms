import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  // ─────────────────────────────────────────────────────
  // GET — Load draft for month/year
  // Returns all employee drafts + lock status
  // ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { month, year } = req.query
    if (!month || !year) {
      return res.status(400).json({ error: 'month and year required' })
    }

    const { data, error } = await supabaseAdmin
      .from('payroll_draft')
      .select('*')
      .eq('month', parseInt(month))
      .eq('year',  parseInt(year))

    if (error) return res.status(500).json({ error: error.message })

    // Check if any record is locked — means payroll was run
    const isLocked = (data || []).some(d => d.is_locked)

    return res.status(200).json({
      entries  : data || [],
      is_locked: isLocked,
    })
  }

  // ─────────────────────────────────────────────────────
  // POST — Save/update draft entries
  // Blocked if payroll already run (locked)
  // ─────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { month, year, entries } = req.body

    if (!month || !year || !entries?.length) {
      return res.status(400).json({ error: 'month, year and entries required' })
    }

    // Check if already locked
    const { data: existing } = await supabaseAdmin
      .from('payroll_draft')
      .select('is_locked')
      .eq('month', month)
      .eq('year',  year)
      .eq('is_locked', true)
      .limit(1)

    if (existing?.length > 0) {
      return res.status(403).json({
        error: `Payroll for ${month}/${year} is already finalized and locked. Contact admin to reopen.`
      })
    }

    const rows = entries.map(e => ({
      employee_id   : e.employee_id,
      month,
      year,
      overtime_hours: Number(e.overtime_hours) || 0,
      incentive     : Number(e.incentive)      || 0,
      loan          : Number(e.loan)           || 0,
      advance       : Number(e.advance)        || 0,
      notes         : e.notes                  || null,
      is_locked     : false,
      updated_at    : new Date().toISOString(),
    }))

    const { error } = await supabaseAdmin
      .from('payroll_draft')
      .upsert(rows, { onConflict: 'employee_id,month,year' })

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({
      message: `Draft saved for ${entries.length} employees`,
      month,
      year,
    })
  }

  // ─────────────────────────────────────────────────────
  // PATCH — Reopen locked payroll (admin only)
  // ─────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { month, year, action } = req.body

    if (action !== 'reopen') {
      return res.status(400).json({ error: 'Invalid action' })
    }

    const { error } = await supabaseAdmin
      .from('payroll_draft')
      .update({ is_locked: false, locked_at: null })
      .eq('month', month)
      .eq('year',  year)

    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({
      message: `Payroll for ${month}/${year} reopened for editing`
    })
  }

  res.status(405).json({ error: 'Method not allowed' })
}
