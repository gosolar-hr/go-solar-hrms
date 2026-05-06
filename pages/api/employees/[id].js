import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {

  const { id } = req.query

  // GET — fetch single employee
  if (req.method === 'GET') {
    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', id)
      .single()

    if (error) return res.status(404).json({ error: 'Employee not found' })
    return res.status(200).json(data)
  }

  // PUT — update employee
  if (req.method === 'PUT') {
    const {
      name, email, phone, date_of_joining,
      designation, department, gender,
      basic_salary, hra, cca, conveyance, allowances,
      pf_applicable, pan, aadhaar, bank_account,
      ifsc_code, bank_branch, bank_location,
      uan_number, pf_number, emp_code, work_schedule,
    } = req.body

    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({
        name,
        email,
        phone          : phone          || null,
        date_of_joining,
        designation    : designation    || null,
        department     : department     || null,
        gender         : gender         || 'male',
        work_schedule  : work_schedule  || 'standard',
        basic_salary   : Number(basic_salary),
        hra            : Number(hra)            || 0,
        cca            : Number(cca)            || 0,
        conveyance     : Number(conveyance)     || 0,
        allowances     : Number(allowances)     || 0,
        pf_applicable  : pf_applicable  ?? true,
        pan            : pan            || null,
        aadhaar        : aadhaar        || null,
        bank_account   : bank_account   || null,
        ifsc_code      : ifsc_code      || null,
        bank_branch    : bank_branch    || null,
        bank_location  : bank_location  || null,
        uan_number     : uan_number     || null,
        pf_number      : pf_number      || null,
        emp_code       : emp_code       || null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  // PATCH — deactivate employee (soft delete)
  if (req.method === 'PATCH') {
    const { is_active } = req.body
    const { data, error } = await supabaseAdmin
      .from('employees')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
