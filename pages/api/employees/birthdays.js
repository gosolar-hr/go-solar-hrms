import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole }   from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, emp_code, designation, department, date_of_birth')
    .eq('is_active', true)
    .not('date_of_birth', 'is', null)
    .order('name')

  if (error) return res.status(500).json({ error: error.message })

  const today    = new Date()
  const todayM   = today.getMonth() + 1   // 1-12
  const todayD   = today.getDate()
  const curYear  = today.getFullYear()

  const enriched = (data || []).map(emp => {
    const dob   = new Date(emp.date_of_birth)
    const dobM  = dob.getMonth() + 1
    const dobD  = dob.getDate()
    const age   = curYear - dob.getFullYear()

    // Days until next birthday (within this calendar year)
    const nextBday = new Date(curYear, dobM - 1, dobD)
    if (nextBday < today) nextBday.setFullYear(curYear + 1)
    const daysUntil = Math.ceil((nextBday - today) / 86400000)

    const isToday    = dobM === todayM && dobD === todayD
    const isThisWeek = daysUntil > 0 && daysUntil <= 7
    const isThisMonth= dobM === todayM

    return {
      ...emp,
      dob_month  : dobM,
      dob_day    : dobD,
      age,
      days_until : daysUntil,
      is_today   : isToday,
      is_this_week: isThisWeek,
      is_this_month: isThisMonth,
    }
  })

  // Sort: today first, then by days_until ascending
  enriched.sort((a, b) => {
    if (a.is_today && !b.is_today) return -1
    if (!a.is_today && b.is_today) return 1
    return a.days_until - b.days_until
  })

  return res.status(200).json(enriched)
}
