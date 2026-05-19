import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// ── Constants (edit here to change policy) ───────────────────────────
const MAX_APPLY_DAYS_AFTER  = 7    // must apply within N days of working
const MAX_BALANCE           = 3    // max comp offs an employee can hold
const EXPIRY_DAYS           = 30   // must avail within N days of worked_date

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  const isHR = session.role === 'hr'

  // ── GET — list requests ──────────────────────────────────────────
  if (req.method === 'GET') {
    let query = supabaseAdmin
      .from('comp_off_requests')
      .select(`
        *,
        employees ( id, name, emp_code, department )
      `)
      .order('created_at', { ascending: false })

    // Technicians/employees only see their own
    if (!isHR) {
      query = query.eq('employee_id', session.employeeId)
    }

    // Optional filters
    if (req.query.status)      query = query.eq('status', req.query.status)
    if (req.query.employee_id) query = query.eq('employee_id', req.query.employee_id)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // ── POST — employee submits a new request ────────────────────────
  if (req.method === 'POST') {
    const { employee_id, worked_date, worked_day_type, reason, requested_avail_date } = req.body

    if (!employee_id || !worked_date || !worked_day_type || !reason) {
      return res.status(400).json({ error: 'employee_id, worked_date, worked_day_type and reason are required' })
    }

    // Non-HR can only apply for themselves
    if (!isHR && session.employeeId !== employee_id) {
      return res.status(403).json({ error: 'You can only apply comp off for yourself' })
    }

    // Rule 1: Must apply within MAX_APPLY_DAYS_AFTER days of working
    const workedOn   = new Date(worked_date)
    const today      = new Date()
    today.setHours(0, 0, 0, 0)
    const daysSince  = Math.floor((today - workedOn) / 86400000)

    if (!isHR && daysSince > MAX_APPLY_DAYS_AFTER) {
      return res.status(400).json({
        error: `Comp off must be applied within ${MAX_APPLY_DAYS_AFTER} days of working. This date was ${daysSince} days ago.`
      })
    }

    // Rule 2: Worked date cannot be in the future
    if (workedOn > today) {
      return res.status(400).json({ error: 'Worked date cannot be in the future' })
    }

    // Rule 3: Check current balance
    const { data: emp } = await supabaseAdmin
      .from('employees')
      .select('comp_off_balance')
      .eq('id', employee_id)
      .single()

    if ((emp?.comp_off_balance || 0) >= MAX_BALANCE) {
      return res.status(400).json({
        error: `Maximum comp off balance is ${MAX_BALANCE}. Please avail existing comp offs before applying for more.`
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
        return res.status(409).json({ error: 'A comp off request for this worked date already exists.' })
      }
      return res.status(500).json({ error: error.message })
    }

    return res.status(201).json(data)
  }

  // ── PUT — HR approves or rejects ─────────────────────────────────
  if (req.method === 'PUT') {
    if (!isHR) return res.status(403).json({ error: 'Only HR can approve or reject comp off requests' })

    const { id, action, rejection_reason } = req.body

    if (!id || !action) return res.status(400).json({ error: 'id and action required' })
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be "approve" or "reject"' })
    }

    // Fetch the request
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
      // Check expiry: worked_date + EXPIRY_DAYS must be in the future
      const expiryDate = new Date(request.worked_date)
      expiryDate.setDate(expiryDate.getDate() + EXPIRY_DAYS)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (expiryDate < today) {
        return res.status(400).json({
          error: `This comp off has expired. It should have been availed by ${expiryDate.toDateString()}.`
        })
      }

      // Update request status
      await supabaseAdmin
        .from('comp_off_requests')
        .update({ status: 'approved', approved_by: session.email, approved_at: new Date().toISOString() })
        .eq('id', id)

      // Increment employee balance
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
