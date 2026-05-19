import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// ── Policy constants ─────────────────────────────────────────────────
const MAX_BALANCE = 3    // max comp offs an employee can hold
const EXPIRY_DAYS = 30   // must avail within N days of worked_date

export default async function handler(req, res) {
  // HR only — employees have no access to this endpoint
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  // ── GET — list all requests ──────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabaseAdmin
      .from('comp_off_requests')
      .select(`*, employees ( id, name, emp_code, department )`)
      .order('created_at', { ascending: false })

    if (req.query.status)      query = query.eq('status', req.query.status)
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── POST — HR records a new comp off for an employee ────────────
  if (req.method === 'POST') {
    const { employee_id, worked_date, worked_day_type, reason, requested_avail_date } = req.body

    if (!employee_id || !worked_date || !worked_day_type || !reason) {
      return res.status(400).json({ error: 'employee_id, worked_date, worked_day_type and reason are required' })
    }

    const workedOn = new Date(worked_date)
    const today    = new Date()
    today.setHours(0, 0, 0, 0)

    if (workedOn > today) {
      return res.status(400).json({ error: 'Worked date cannot be in the future' })
    }

    // Check current balance
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('comp_off_balance')
      .eq('id', employee_id)
      .single()

    if ((emp?.comp_off_balance || 0) >= MAX_BALANCE) {
      return res.status(400).json({
        error: `Maximum comp off balance is ${MAX_BALANCE}. Please avail existing comp offs before adding more.`
      })
    }

    const { data, error } = await supabaseAdmin
      .from('comp_off_requests')
      .insert([{
        employee_id,
        worked_date,
        worked_day_type,
        reason,
        requested_avail_date: requested_avail_date || null,
        status: 'pending',
      }])
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'A comp off record for this worked date already exists for this employee.' })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json(data)
  }

  // ── PUT — HR approves or rejects ─────────────────────────────────
  if (req.method === 'PUT') {
    const { id, action, rejection_reason } = req.body

    if (!id || !action) return res.status(400).json({ error: 'id and action required' })
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' })
    }

    const { data: request, error: fetchErr } = await supabaseAdmin
      .from('comp_off_requests')
      .select('*, employees(comp_off_balance)')
      .eq('id', id)
      .single()

    if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' })
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` })
    }

    if (action === 'approve') {
      const expiryDate = new Date(request.worked_date)
      expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)

      await supabaseAdmin
        .from('comp_off_requests')
        .update({ status: 'approved', approved_by: session.email, approved_at: new Date().toISOString() })
        .eq('id', id)

      await supabaseAdmin
        .from('employees')
        .update({ comp_off_balance: (request.employees?.comp_off_balance || 0) + 1 })
        .eq('id', request.employee_id)

      return res.status(200).json({ message: 'Comp off approved', balance: (request.employees?.comp_off_balance || 0) + 1 })
    }

    if (action === 'reject') {
      if (!rejection_reason) return res.status(400).json({ error: 'rejection_reason is required' })

      await supabaseAdmin
        .from('comp_off_requests')
        .update({ status: 'rejected', rejection_reason })
        .eq('id', id)

      return res.status(200).json({ message: 'Comp off rejected' })
    }
  }

  res.status(405).json({ error: 'Method not allowed' })
}
