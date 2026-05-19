import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'
import { refreshAttendanceSummary } from '../../../lib/attendanceUtils'

export default async function handler(req, res) {
  // HR only
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, availed_date } = req.body

  if (!id || !availed_date) {
    return res.status(400).json({ error: 'id and availed_date are required' })
  }

  const { data: request, error: fetchErr } = await supabaseAdmin
    .from('comp_off_requests')
    .select('*, employees(comp_off_balance)')
    .eq('id', id)
    .single()

  if (fetchErr || !request) return res.status(404).json({ error: 'Request not found' })

  if (request.status !== 'approved') {
    return res.status(400).json({ error: `Request must be approved before availing. Current status: ${request.status}` })
  }

  const currentBalance = request.employees?.comp_off_balance || 0
  if (currentBalance <= 0) {
    return res.status(400).json({ error: 'No comp off balance available for this employee' })
  }

  // 1. Mark request as availed
  const { error: updateErr } = await supabaseAdmin
    .from('comp_off_requests')
    .update({ status: 'availed', availed_date })
    .eq('id', id)

  if (updateErr) return res.status(500).json({ error: updateErr.message })

  // 2. Decrement balance
  const { error: balErr } = await supabaseAdmin
    .from('employees')
    .update({ comp_off_balance: currentBalance - 1 })
    .eq('id', request.employee_id)

  if (balErr) return res.status(500).json({ error: balErr.message })

  // 3. Mark attendance as CO for that day
  const { error: attErr } = await supabaseAdmin
    .from('attendance_details')
    .upsert([{
      employee_id : request.employee_id,
      date        : availed_date,
      status      : 'CO',
      salary_cut  : 0,
      remark      : `Comp off availed (worked on ${request.worked_date})`,
    }], { onConflict: 'employee_id,date' })

  if (attErr) return res.status(500).json({ error: attErr.message })

  // 4. Refresh attendance summary
  const [year, month] = availed_date.split('-').map(Number)
  await refreshAttendanceSummary(request.employee_id, month, year)

  return res.status(200).json({ message: 'Comp off availed successfully', balance: currentBalance - 1 })
}
