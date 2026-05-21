import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('is_active', true)        // ← only active employees
      .order('emp_code')
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const {
      emp_code, name, email, phone, date_of_joining,
      designation, department,
      basic_salary, hra, cca, conveyance, allowances,
      pf_applicable, esic_applicable, pension_applicable,
      gender, pan, aadhaar, bank_account,
      ifsc_code, bank_branch, bank_location
    } = req.body

    if (!name || !email || !date_of_joining || !basic_salary) {
      return res.status(400).json({
        error: 'name, email, date_of_joining and basic_salary are required'
      })
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .insert([{
        emp_code     : emp_code    || null,
        name,
        email,
        phone        : phone       || null,
        date_of_joining,
        designation  : designation || null,
        department   : department  || null,
        basic_salary,
        hra          : hra         || 0,
        cca          : cca         || 0,
        conveyance   : conveyance  || 0,
        allowances   : allowances  || 0,
        pf_applicable  : pf_applicable   ?? true,
        esic_applicable: esic_applicable ?? true,
        pension_applicable: pension_applicable ?? false,
        gender       : gender      || 'male',
        pan          : pan         || null,
        aadhaar      : aadhaar     || null,
        bank_account : bank_account|| null,
        ifsc_code    : ifsc_code   || null,
        bank_branch  : bank_branch || null,
        bank_location: bank_location|| null,
        is_active    : true,
      }])
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
