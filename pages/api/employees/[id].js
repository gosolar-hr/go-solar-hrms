import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return

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
      pf_applicable, esic_applicable, pension_applicable,
      pan, aadhaar, bank_account,
      ifsc_code, bank_branch, bank_location,
      uan_number, pf_number, esic_number, emp_code, work_schedule,
      // New fields from master data
      date_of_birth, marital_status, father_husband_name,
      biometric_code, working_location,
      current_address, permanent_address,
      aadhaar_name, bank_account_name, pf_basic_limit,
      prev_uan_number, prev_pf_number, prev_pension_member,
      prev_pf_action, prev_esic_number,
      nominee_name, nominee_relation, nominee_phone,
      nominee_aadhaar, nominee_pan,
      nominee_current_address, nominee_permanent_address,
      current_inhand_salary, hr_remark,
      aadhaar_url, pan_url,
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
        pf_applicable  : pf_applicable   ?? true,
        esic_applicable: esic_applicable ?? true,
        pension_applicable: pension_applicable ?? false,
        pan            : pan            || null,
        aadhaar        : aadhaar        || null,
        bank_account   : bank_account   || null,
        ifsc_code      : ifsc_code      || null,
        bank_branch    : bank_branch    || null,
        bank_location  : bank_location  || null,
        uan_number     : uan_number     || null,
        pf_number      : pf_number      || null,
        esic_number    : esic_number    || null,
        emp_code       : emp_code       || null,
        // New fields
        date_of_birth          : date_of_birth          || null,
        marital_status         : marital_status         || null,
        father_husband_name    : father_husband_name    || null,
        biometric_code         : biometric_code         || null,
        working_location       : working_location       || null,
        current_address        : current_address        || null,
        permanent_address      : permanent_address      || null,
        aadhaar_name           : aadhaar_name           || null,
        bank_account_name      : bank_account_name      || null,
        pf_basic_limit         : pf_basic_limit ? Number(pf_basic_limit) : 15000,
        prev_uan_number        : prev_uan_number        || null,
        prev_pf_number         : prev_pf_number         || null,
        prev_pension_member    : prev_pension_member    || null,
        prev_pf_action         : prev_pf_action         || null,
        prev_esic_number       : prev_esic_number       || null,
        nominee_name           : nominee_name           || null,
        nominee_relation       : nominee_relation       || null,
        nominee_phone          : nominee_phone          || null,
        nominee_aadhaar        : nominee_aadhaar        || null,
        nominee_pan            : nominee_pan            || null,
        nominee_current_address   : nominee_current_address   || null,
        nominee_permanent_address : nominee_permanent_address || null,
        current_inhand_salary  : current_inhand_salary ? Number(current_inhand_salary) : null,
        hr_remark              : hr_remark              || null,
        aadhaar_url            : aadhaar_url !== undefined ? aadhaar_url : undefined,
        pan_url                : pan_url !== undefined ? pan_url : undefined,
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
