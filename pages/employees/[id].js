import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Layout from '../../components/Layout'
import Link from 'next/link'

const DEPARTMENTS = ['Operations','Sales','Finance','HR','Technical','Admin']
const DESIGNATIONS = [
  'Tech Head','Accounts Executive','Solar Sales Executive',
  'Solar Design Engineer','Solar PV Design Engineer','Solar Sales Manager',
  'HR Manager','Solar Technician','Electrical Head','Sales Head',
  'Trainee Solar Design Engineer',
]

// Section component
function Section({ title, children }) {
  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div className="card-header">
        <span className="card-title">{title}</span>
      </div>
      <div className="card-pad">
        {children}
      </div>
    </div>
  )
}

// Field row — view mode
function FieldRow({ label, value, highlight }) {
  return (
    <div style={{
      display       : 'grid',
      gridTemplateColumns: '180px 1fr',
      gap           : 16,
      padding       : '10px 0',
      borderBottom  : '1px solid var(--border-light)',
      alignItems    : 'center',
    }}>
      <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
        textTransform:'uppercase', letterSpacing:'0.04em' }}>
        {label}
      </div>
      <div style={{
        fontSize    : 13.5,
        fontWeight  : highlight ? 600 : 400,
        color       : highlight ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontFamily  : highlight ? 'DM Mono, monospace' : 'inherit',
      }}>
        {value || <span style={{ color:'var(--text-muted)', fontStyle:'italic' }}>Not provided</span>}
      </div>
    </div>
  )
}

export default function EmployeeProfile() {
  const router = useRouter()
  const { id } = router.query

  const [emp,     setEmp]     = useState(null)
  const [form,    setForm]    = useState(null)
  const [editing, setEditing] = useState(null) // 'personal' | 'salary' | 'compliance' | 'bank'
  const [saving,  setSaving]  = useState(false)
  const [alert,   setAlert]   = useState(null)
  const [loading, setLoading] = useState(true)

  // Loan & Advance state
  const [loans,    setLoans]    = useState([])
  const [advances, setAdvances] = useState([])
  const [newLoan,  setNewLoan]  = useState({ total_amount:'', monthly_recovery:'', loan_date:'', description:'' })
  const [newAdv,   setNewAdv]   = useState({ total_amount:'', monthly_adjustment:'', advance_date:'', description:'' })
  const [showLoan, setShowLoan] = useState(false)
  const [showAdv,  setShowAdv]  = useState(false)

  // Load loans and advances
  const loadLoans = () =>
    fetch(`/api/loans?employee_id=${id}`)
      .then(r => r.json()).then(d => setLoans(Array.isArray(d) ? d : []))

  const loadAdvances = () =>
    fetch(`/api/advances?employee_id=${id}`)
      .then(r => r.json()).then(d => setAdvances(Array.isArray(d) ? d : []))

  useEffect(() => {
    if (!id) return
    fetch(`/api/employees/${id}`)
      .then(r => r.json())
      .then(d => {
        setEmp(d)
        setForm(d)
        setLoading(false)
      })
    loadLoans()
    loadAdvances()
  }, [id])

  const addLoan = async () => {
    if (!newLoan.total_amount) return
    await fetch('/api/loans', {
      method  : 'POST',
      headers : { 'Content-Type':'application/json' },
      body    : JSON.stringify({
        employee_id      : id,
        total_amount     : Number(newLoan.total_amount),
        monthly_recovery : Number(newLoan.monthly_recovery) || 0,
        loan_date        : newLoan.loan_date,
        description      : newLoan.description,
      })
    })
    setNewLoan({ total_amount:'', monthly_recovery:'', loan_date:'', description:'' })
    setShowLoan(false)
    loadLoans()
  }

  const addAdvance = async () => {
    if (!newAdv.total_amount) return
    await fetch('/api/advances', {
      method  : 'POST',
      headers : { 'Content-Type':'application/json' },
      body    : JSON.stringify({
        employee_id         : id,
        total_amount        : Number(newAdv.total_amount),
        monthly_adjustment  : Number(newAdv.monthly_adjustment) || 0,
        advance_date        : newAdv.advance_date,
        description         : newAdv.description,
      })
    })
    setNewAdv({ total_amount:'', monthly_adjustment:'', advance_date:'', description:'' })
    setShowAdv(false)
    loadAdvances()
  }

  const onChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSave = async (section) => {
    setSaving(true)
    setAlert(null)
    const res  = await fetch(`/api/employees/${id}`, {
      method  : 'PUT',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setEmp(data)
    setForm(data)
    setEditing(null)
    setAlert({ type:'success', msg: `${section} updated successfully.` })
  }

  const onDeactivate = async () => {
    if (!confirm(`Are you sure you want to deactivate ${emp.name}? They will be excluded from payroll.`)) return
    const res = await fetch(`/api/employees/${id}`, {
      method  : 'PATCH',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ is_active: false }),
    })
    if (res.ok) router.push('/employees')
  }

  const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN')
  const monthlyGross = emp
    ? Number(emp.basic_salary||0) + Number(emp.hra||0) + Number(emp.cca||0) +
      Number(emp.conveyance||0)   + Number(emp.allowances||0)
    : 0

  // Initials avatar
  const initials = emp?.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  if (loading) return (
    <Layout>
      <p className="text-muted">Loading employee profile...</p>
    </Layout>
  )

  if (!emp || emp.error) return (
    <Layout>
      <p className="text-muted">Employee not found.</p>
    </Layout>
  )

  return (
    <Layout>
      {/* Breadcrumb */}
      <div style={{ display:'flex', alignItems:'center', gap:8,
        fontSize:13, color:'var(--text-muted)', marginBottom:20 }}>
        <Link href="/employees" style={{ color:'var(--text-muted)',
          textDecoration:'none' }}>Employees</Link>
        <span>/</span>
        <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{emp.name}</span>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom:20 }}>
          {alert.msg}
        </div>
      )}

      {/* Profile header */}
      <div className="card" style={{ marginBottom:20, padding:'28px 32px' }}>
        <div style={{ display:'flex', alignItems:'center',
          justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            {/* Avatar */}
            <div style={{
              width:72, height:72, borderRadius:16,
              background:'#FFF4ED', border:'2px solid #FED7AA',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:26, fontWeight:700, color:'#F97316',
            }}>
              {initials}
            </div>
            <div>
              <div style={{ fontSize:22, fontWeight:700,
                color:'var(--text-primary)', letterSpacing:'-0.3px' }}>
                {emp.name}
              </div>
              <div style={{ fontSize:13, color:'var(--text-secondary)', marginTop:3 }}>
                {emp.designation || '—'} · {emp.department || '—'}
              </div>
              <div style={{ display:'flex', gap:8, marginTop:8 }}>
                <span className="badge badge-gray">{emp.emp_code || 'No Code'}</span>
                <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-red'}`}>
                  {emp.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className={`badge ${emp.pf_applicable ? 'badge-orange' : 'badge-gray'}`}>
                  {emp.pf_applicable ? 'PF Enrolled' : 'PF Opt-out'}
                </span>
                <span className={`badge ${emp.esic_applicable ? 'badge-orange' : 'badge-gray'}`}>
                  {emp.esic_applicable ? 'ESIC Enrolled' : 'ESIC Opt-out'}
                </span>
                <span className={`badge ${emp.pension_applicable ? 'badge-orange' : 'badge-gray'}`}>
                  {emp.pension_applicable ? 'Pension Enrolled' : 'Pension Opt-out'}
                </span>
                <span className="badge badge-gray">
                  {emp.gender === 'female' ? 'Female' : emp.gender === 'other' ? 'Other' : 'Male'}
                </span>
              </div>
            </div>
          </div>

          {/* Header actions */}
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ textAlign:'right', marginRight:16 }}>
              <div style={{ fontSize:11, color:'var(--text-muted)',
                textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Monthly Gross
              </div>
              <div style={{ fontSize:26, fontWeight:700, color:'var(--accent)',
                fontFamily:'DM Mono, monospace', marginTop:2 }}>
                {fmt(monthlyGross)}
              </div>
            </div>
            {emp.is_active && (
              <button className="btn btn-outline"
                onClick={onDeactivate}
                style={{ color:'var(--error)', borderColor:'var(--error)' }}>
                Deactivate
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Two column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>

        {/* LEFT COLUMN */}
        <div>
          {/* Personal Details */}
          <Section title="Personal Details">
            {editing === 'personal' ? (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input name="name" value={form.name||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input name="email" type="email" value={form.email||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Phone</label>
                    <input name="phone" value={form.phone||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Date of Joining</label>
                    <input name="date_of_joining" type="date"
                      value={form.date_of_joining?.split('T')[0]||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Department</label>
                    <select name="department" value={form.department||''} onChange={onChange}>
                      <option value="">Select</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Designation</label>
                    <input name="designation" value={form.designation||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Employee Code</label>
                    <input name="emp_code" value={form.emp_code||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select name="gender" value={form.gender||'male'} onChange={onChange}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group full">
                    <label>Work Schedule</label>
                    <select
                      name="work_schedule"
                      value={form.work_schedule || 'standard'}
                      onChange={onChange}
                    >
                      <option value="standard">Standard — Mon–Sat, 2nd & 4th Sat off, Sun off</option>
                      <option value="6day">6 Days — Mon to Sat, Sundays off only</option>
                      <option value="7day">7 Days — All days working, no forced week offs</option>
                    </select>
                    <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:4 }}>
                      Controls which days are treated as Week Off for this employee
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input name="date_of_birth" type="date"
                      value={form.date_of_birth?.split('T')[0]||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Marital Status</label>
                    <select name="marital_status" value={form.marital_status||''} onChange={onChange}>
                      <option value="">Select</option>
                      <option value="Married">Married</option>
                      <option value="Unmarried">Unmarried</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Father / Husband Name</label>
                    <input name="father_husband_name" value={form.father_husband_name||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Working Location</label>
                    <input name="working_location" value={form.working_location||''} onChange={onChange} placeholder="e.g. Navi Mumbai" />
                  </div>
                  <div className="form-group">
                    <label>Biometric Code</label>
                    <input name="biometric_code" value={form.biometric_code||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <label>Current Address</label>
                    <textarea name="current_address" rows={2}
                      value={form.current_address||''} onChange={onChange}
                      placeholder="Full current residential address" />
                  </div>
                  <div className="form-group full">
                    <label>Permanent Address</label>
                    <textarea name="permanent_address" rows={2}
                      value={form.permanent_address||''} onChange={onChange}
                      placeholder="Permanent / native address" />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm"
                    onClick={() => onSave('Personal details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => { setEditing(null); setForm(emp) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Full Name"      value={emp.name} />
                <FieldRow label="Email"          value={emp.email} />
                <FieldRow label="Phone"          value={emp.phone} />
                <FieldRow label="Date of Joining"
                  value={emp.date_of_joining
                    ? new Date(emp.date_of_joining).toLocaleDateString('en-IN',
                        { day:'2-digit', month:'long', year:'numeric' })
                    : null} />
                <FieldRow label="Department"     value={emp.department} />
                <FieldRow label="Designation"    value={emp.designation} />
                <FieldRow label="Employee Code"  value={emp.emp_code} />
                <FieldRow label="Gender"
                  value={emp.gender === 'female' ? 'Female'
                       : emp.gender === 'other'  ? 'Other' : 'Male'} />
                <FieldRow label="Work Schedule"
                  value={
                    emp.work_schedule === '6day' ? '6 Days — Mon to Sat (no Sat offs)' :
                    emp.work_schedule === '7day' ? '7 Days — All days (no week offs)' :
                    'Standard — Mon–Sat, 2nd & 4th Sat off'
                  }
                />
                {emp.date_of_birth && <FieldRow label="Date of Birth"
                  value={new Date(emp.date_of_birth).toLocaleDateString('en-IN', {day:'2-digit',month:'long',year:'numeric'})} />}
                {emp.marital_status && <FieldRow label="Marital Status" value={emp.marital_status} />}
                {emp.father_husband_name && <FieldRow label="Father / Husband" value={emp.father_husband_name} />}
                {emp.working_location && <FieldRow label="Working Location" value={emp.working_location} />}
                {emp.biometric_code && <FieldRow label="Biometric Code" value={emp.biometric_code} />}
                {emp.current_address && <FieldRow label="Current Address" value={emp.current_address} />}
                {emp.permanent_address && <FieldRow label="Permanent Address" value={emp.permanent_address} />}
                <button className="btn btn-outline btn-sm mt-16"
                  onClick={() => setEditing('personal')}>
                  ✏ Edit Personal Details
                </button>
              </>
            )}
          </Section>

          <Section title="Bank Details">
            {editing === 'bank' ? (
              <>
                <div className="form-grid">
                  <div className="form-group full">
                    <label>Bank Account Number</label>
                    <input name="bank_account" value={form.bank_account||''}
                      onChange={onChange} placeholder="e.g. 50100XXXXXXXX" />
                  </div>
                  <div className="form-group full">
                    <label>Account Holder Name (as per bank)</label>
                    <input name="bank_account_name" value={form.bank_account_name||''}
                      onChange={onChange} placeholder="Name as printed on passbook" />
                  </div>
                  <div className="form-group">
                    <label>IFSC Code</label>
                    <input name="ifsc_code" value={form.ifsc_code||''}
                      onChange={onChange} placeholder="HDFC0001234" />
                  </div>
                  <div className="form-group">
                    <label>Branch Name</label>
                    <input name="bank_branch" value={form.bank_branch||''}
                      onChange={onChange} placeholder="Main Branch" />
                  </div>
                  <div className="form-group full">
                    <label>Place / Location</label>
                    <input name="bank_location" value={form.bank_location||''}
                      onChange={onChange} placeholder="Mumbai" />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm"
                    onClick={() => onSave('Bank details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => { setEditing(null); setForm(emp) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Bank Account" value={emp.bank_account} highlight />
                {emp.bank_account_name && <FieldRow label="Account Name" value={emp.bank_account_name} />}
                <FieldRow label="IFSC Code"    value={emp.ifsc_code}    highlight />
                <FieldRow label="Branch Name"  value={emp.bank_branch} />
                <FieldRow label="Place"        value={emp.bank_location} />
                <button className="btn btn-outline btn-sm mt-16"
                  onClick={() => setEditing('bank')}>
                  ✏ Edit Bank Details
                </button>
              </>
            )}
          </Section>

          {/* ── PREVIOUS EMPLOYER ── */}
          <Section title="Previous Employer / PF Details">
            {editing === 'prev_employer' ? (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Previous UAN Number</label>
                    <input name="prev_uan_number" value={form.prev_uan_number||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Previous PF A/C Number</label>
                    <input name="prev_pf_number" value={form.prev_pf_number||''} onChange={onChange}
                      placeholder="e.g. MH/BAN/12345/000/0001" />
                  </div>
                  <div className="form-group">
                    <label>Previous Pension Member</label>
                    <select name="prev_pension_member" value={form.prev_pension_member||''} onChange={onChange}>
                      <option value="">Not applicable</option>
                      <option value="YES">YES</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>PF Transfer / Withdraw</label>
                    <select name="prev_pf_action" value={form.prev_pf_action||''} onChange={onChange}>
                      <option value="">Not applicable</option>
                      <option value="TRANSFER">Transfer</option>
                      <option value="WITHDRAW">Withdraw</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Previous ESIC Number</label>
                    <input name="prev_esic_number" value={form.prev_esic_number||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>PF Basic Limit (₹)</label>
                    <input name="pf_basic_limit" type="number" value={form.pf_basic_limit||15000} onChange={onChange} />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm" onClick={() => onSave('Previous employer details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setForm(emp) }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Previous UAN"         value={emp.prev_uan_number} />
                <FieldRow label="Previous PF A/C"      value={emp.prev_pf_number} />
                <FieldRow label="Pension Member"       value={emp.prev_pension_member} />
                <FieldRow label="PF Transfer/Withdraw" value={emp.prev_pf_action} />
                <FieldRow label="Previous ESIC No."    value={emp.prev_esic_number} />
                <FieldRow label="PF Basic Limit"       value={emp.pf_basic_limit ? `₹${emp.pf_basic_limit?.toLocaleString('en-IN')}` : null} />
                <button className="btn btn-outline btn-sm mt-16" onClick={() => setEditing('prev_employer')}>
                  ✏ Edit Previous Employer Details
                </button>
              </>
            )}
          </Section>

          {/* ── NOMINEE ── */}
          <Section title="Nominee Details">
            {editing === 'nominee' ? (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nominee Name (as per Aadhaar)</label>
                    <input name="nominee_name" value={form.nominee_name||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Relation with Nominee</label>
                    <select name="nominee_relation" value={form.nominee_relation||''} onChange={onChange}>
                      <option value="">Select</option>
                      <option value="Spouse">Spouse</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nominee Phone</label>
                    <input name="nominee_phone" value={form.nominee_phone||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Nominee Aadhaar Number</label>
                    <input name="nominee_aadhaar" value={form.nominee_aadhaar||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Nominee PAN Number</label>
                    <input name="nominee_pan" value={form.nominee_pan||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <label>Nominee Current Address</label>
                    <textarea name="nominee_current_address" rows={2}
                      value={form.nominee_current_address||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <label>Nominee Permanent Address</label>
                    <textarea name="nominee_permanent_address" rows={2}
                      value={form.nominee_permanent_address||''} onChange={onChange} />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm" onClick={() => onSave('Nominee details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setForm(emp) }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Nominee Name"       value={emp.nominee_name} />
                <FieldRow label="Relation"           value={emp.nominee_relation} />
                <FieldRow label="Nominee Phone"      value={emp.nominee_phone} />
                <FieldRow label="Nominee Aadhaar"    value={emp.nominee_aadhaar} highlight />
                <FieldRow label="Nominee PAN"        value={emp.nominee_pan} highlight />
                <FieldRow label="Current Address"    value={emp.nominee_current_address} />
                <FieldRow label="Permanent Address"  value={emp.nominee_permanent_address} />
                <button className="btn btn-outline btn-sm mt-16" onClick={() => setEditing('nominee')}>
                  ✏ Edit Nominee Details
                </button>
              </>
            )}
          </Section>

          {/* ── HR ADMIN NOTES ── */}
          <Section title="HR Admin">
            {editing === 'hr_admin' ? (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Current In-Hand Salary (₹)</label>
                    <input name="current_inhand_salary" type="number"
                      value={form.current_inhand_salary||''} onChange={onChange}
                      placeholder="Actual take-home amount" />
                  </div>
                  <div className="form-group">
                    <label>Aadhaar Name (as per card)</label>
                    <input name="aadhaar_name" value={form.aadhaar_name||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <label>HR Remark</label>
                    <textarea name="hr_remark" rows={2}
                      value={form.hr_remark||''} onChange={onChange}
                      placeholder="Any internal HR notes..." />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm" onClick={() => onSave('HR admin details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setEditing(null); setForm(emp) }}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                {emp.current_inhand_salary && <FieldRow label="In-Hand Salary" value={`₹${Number(emp.current_inhand_salary).toLocaleString('en-IN')}`} highlight />}
                {emp.aadhaar_name && <FieldRow label="Aadhaar Name" value={emp.aadhaar_name} />}
                {emp.hr_remark && <FieldRow label="HR Remark" value={emp.hr_remark} />}
                {!emp.current_inhand_salary && !emp.aadhaar_name && !emp.hr_remark && (
                  <div style={{ fontSize:12, color:'var(--text-muted)', padding:'8px 0' }}>No HR admin notes yet.</div>
                )}
                <button className="btn btn-outline btn-sm mt-16" onClick={() => setEditing('hr_admin')}>
                  ✏ Edit HR Admin Details
                </button>
              </>
            )}
          </Section>

          {/* LOAN TRACKING */}
          <Section title="Loan Tracking">
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {loans.length === 0 ? 'No active loans' :
                  `${loans.length} loan${loans.length > 1 ? 's' : ''} on record`}
              </div>
              <button className="btn btn-outline btn-sm"
                onClick={() => setShowLoan(s => !s)}>
                {showLoan ? 'Cancel' : '+ Add Loan'}
              </button>
            </div>

            {showLoan && (
              <div style={{ background:'var(--bg)', borderRadius:8,
                padding:16, marginBottom:16 }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Loan Amount (₹)</label>
                    <input type="number" placeholder="50000"
                      value={newLoan.total_amount}
                      onChange={e => setNewLoan(l => ({ ...l, total_amount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Loan Date</label>
                    <input type="date" value={newLoan.loan_date}
                      onChange={e => setNewLoan(l => ({ ...l, loan_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Monthly Recovery (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 5000"
                      value={newLoan.monthly_recovery || ''}
                      onChange={e => setNewLoan(l => ({ ...l, monthly_recovery: e.target.value }))}
                    />
                  </div>
                  <div className="form-group full">
                    <label>Description</label>
                    <input placeholder="e.g. Personal loan, Medical emergency"
                      value={newLoan.description}
                      onChange={e => setNewLoan(l => ({ ...l, description: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm mt-16" onClick={addLoan}>
                  Save Loan
                </button>
              </div>
            )}

            {loans.map(loan => {
              const pct      = Math.min(100, Math.round(
                (loan.total_recovered / loan.total_amount) * 100
              ))
              const isClosed = !loan.is_active || loan.balance <= 0

              return (
                <div key={loan.id} style={{
                  border    : `1px solid ${isClosed ? '#A9EFC5' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding   : 16,
                  marginBottom: 12,
                  background: isClosed ? '#F6FEF9' : '#fff',
                  opacity   : isClosed ? 0.85 : 1,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize:13, fontWeight:600,
                          color:'var(--text-primary)' }}>
                          {loan.description || 'Loan'}
                        </div>
                        {isClosed && (
                          <span style={{
                            fontSize:10, fontWeight:700,
                            background:'#ECFDF3', color:'#027A48',
                            padding:'2px 8px', borderRadius:20,
                            border:'1px solid #A9EFC5',
                          }}>
                            ✓ CLOSED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        Issued: {new Date(loan.loan_date).toLocaleDateString('en-IN',
                          { day:'2-digit', month:'short', year:'numeric' })}
                        {loan.monthly_recovery > 0 && !isClosed && (
                          <span style={{ marginLeft:8, color:'var(--accent)' }}>
                            · ₹{Number(loan.monthly_recovery).toLocaleString('en-IN')}/month
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {isClosed ? 'Fully Recovered' : 'Balance'}
                      </div>
                      <div style={{ fontSize:18, fontWeight:700,
                        color: isClosed ? '#12B76A' : '#F04438',
                        fontFamily:'DM Mono, monospace' }}>
                        {isClosed ? '₹0' : fmt(loan.balance)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background:'var(--border-light)',
                    borderRadius:4, height:6, marginBottom:10 }}>
                    <div style={{
                      width     : `${pct}%`,
                      background: pct >= 100 ? '#12B76A' : '#F97316',
                      height    : '100%', borderRadius:4,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
                    gap:12, fontSize:12 }}>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>Total Loan</div>
                      <div style={{ fontWeight:600, fontFamily:'DM Mono, monospace' }}>
                        {fmt(loan.total_amount)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>Recovered</div>
                      <div style={{ fontWeight:600, fontFamily:'DM Mono, monospace',
                        color:'#027A48' }}>
                        {fmt(loan.total_recovered)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>
                        Recovery History
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                        {(loan.loan_recoveries || []).length > 0
                          ? (loan.loan_recoveries || [])
                              .sort((a,b) => b.year - a.year || b.month - a.month)
                              .slice(0, 3)
                              .map(r => `${r.month}/${r.year}: ${fmt(r.amount)}`)
                              .join(' · ')
                          : 'No recoveries yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </Section>

          {/* ADVANCE TRACKING */}
          <Section title="Advance Tracking">
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:16 }}>
              <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                {advances.length === 0 ? 'No active advances' :
                  `${advances.length} advance${advances.length > 1 ? 's' : ''} on record`}
              </div>
              <button className="btn btn-outline btn-sm"
                onClick={() => setShowAdv(s => !s)}>
                {showAdv ? 'Cancel' : '+ Add Advance'}
              </button>
            </div>

            {showAdv && (
              <div style={{ background:'var(--bg)', borderRadius:8,
                padding:16, marginBottom:16 }}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Advance Amount (₹)</label>
                    <input type="number" placeholder="10000"
                      value={newAdv.total_amount}
                      onChange={e => setNewAdv(a => ({ ...a, total_amount: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Advance Date</label>
                    <input type="date" value={newAdv.advance_date}
                      onChange={e => setNewAdv(a => ({ ...a, advance_date: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label>Monthly Adjustment (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 2000"
                      onChange={e => setNewAdv(a => ({ ...a, monthly_adjustment: e.target.value }))}
                      value={newAdv.monthly_adjustment || ''}
                    />
                  </div>
                  <div className="form-group full">
                    <label>Description</label>
                    <input placeholder="e.g. Festival advance, Emergency"
                      value={newAdv.description}
                      onChange={e => setNewAdv(a => ({ ...a, description: e.target.value }))} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm mt-16" onClick={addAdvance}>
                  Save Advance
                </button>
              </div>
            )}

            {advances.map(adv => {
              const pct      = Math.min(100, Math.round(
                (adv.total_adjusted / adv.total_amount) * 100
              ))
              const isClosed = !adv.is_active || adv.balance <= 0

              return (
                <div key={adv.id} style={{
                  border    : `1px solid ${isClosed ? '#A9EFC5' : 'var(--border)'}`,
                  borderRadius: 10,
                  padding   : 16,
                  marginBottom: 12,
                  background: isClosed ? '#F6FEF9' : '#fff',
                  opacity   : isClosed ? 0.85 : 1,
                }}>
                  <div style={{ display:'flex', justifyContent:'space-between',
                    alignItems:'flex-start', marginBottom:12 }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ fontSize:13, fontWeight:600,
                          color:'var(--text-primary)' }}>
                          {adv.description || 'Advance'}
                        </div>
                        {isClosed && (
                          <span style={{
                            fontSize:10, fontWeight:700,
                            background:'#ECFDF3', color:'#027A48',
                            padding:'2px 8px', borderRadius:20,
                            border:'1px solid #A9EFC5',
                          }}>
                            ✓ CLOSED
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        Issued: {new Date(adv.advance_date).toLocaleDateString('en-IN',
                          { day:'2-digit', month:'short', year:'numeric' })}
                        {adv.monthly_adjustment > 0 && !isClosed && (
                          <span style={{ marginLeft:8, color:'var(--accent)' }}>
                            · ₹{Number(adv.monthly_adjustment).toLocaleString('en-IN')}/month
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {isClosed ? 'Fully Adjusted' : 'Outstanding'}
                      </div>
                      <div style={{ fontSize:18, fontWeight:700,
                        color: isClosed ? '#12B76A' : '#F79009',
                        fontFamily:'DM Mono, monospace' }}>
                        {isClosed ? '₹0' : fmt(adv.balance)}
                      </div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div style={{ background:'var(--border-light)',
                    borderRadius:4, height:6, marginBottom:10 }}>
                    <div style={{
                      width     : `${pct}%`,
                      background: pct >= 100 ? '#12B76A' : '#2E90FA',
                      height    : '100%', borderRadius:4,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr',
                    gap:12, fontSize:12 }}>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>Total Advance</div>
                      <div style={{ fontWeight:600, fontFamily:'DM Mono, monospace' }}>
                        {fmt(adv.total_amount)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>Adjusted</div>
                      <div style={{ fontWeight:600, fontFamily:'DM Mono, monospace',
                        color:'#027A48' }}>
                        {fmt(adv.total_adjusted)}
                      </div>
                    </div>
                    <div>
                      <div style={{ color:'var(--text-muted)', marginBottom:2 }}>
                        Adjustment History
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-secondary)' }}>
                        {(adv.advance_adjustments || []).length > 0
                          ? (adv.advance_adjustments || [])
                              .sort((a,b) => b.year - a.year || b.month - a.month)
                              .slice(0, 3)
                              .map(a => `${a.month}/${a.year}: ${fmt(a.amount)}`)
                              .join(' · ')
                          : 'No adjustments yet'}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Salary Components */}
          <Section title="Salary Components">
            {editing === 'salary' ? (
              <>
                <div style={{ background:'#FFF4ED', border:'1px solid #FED7AA',
                  borderRadius:8, padding:'10px 14px', marginBottom:16,
                  fontSize:12, color:'#EA6A05' }}>
                  ⚠ Salary changes will apply from the next payroll run.
                  Re-run payroll after saving.
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Basic Salary (₹) *</label>
                    <input name="basic_salary" type="number"
                      value={form.basic_salary||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>HRA (₹)</label>
                    <input name="hra" type="number"
                      value={form.hra||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>CCA (₹)</label>
                    <input name="cca" type="number"
                      value={form.cca||''} onChange={onChange} />
                  </div>
                  <div className="form-group">
                    <label>Conveyance (₹)</label>
                    <input name="conveyance" type="number"
                      value={form.conveyance||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <label>Other Allowances (₹)</label>
                    <input name="allowances" type="number"
                      value={form.allowances||''} onChange={onChange} />
                  </div>
                  <div className="form-group full">
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="checkbox" name="pf_applicable" id="pf_applicable"
                        checked={form.pf_applicable ?? true} onChange={onChange}
                        style={{ width:16, height:16, accentColor:'var(--accent)' }} />
                      <label htmlFor="pf_applicable" style={{ margin:0, cursor:'pointer',
                        fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
                        PF Applicable (uncheck if Form 11 opt-out)
                      </label>
                    </div>
                  </div>
                  <div className="form-group full">
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="checkbox" name="esic_applicable" id="esic_applicable"
                        checked={form.esic_applicable ?? true} onChange={onChange}
                        style={{ width:16, height:16, accentColor:'var(--accent)' }} />
                      <label htmlFor="esic_applicable" style={{ margin:0, cursor:'pointer',
                        fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
                        ESIC Applicable (uncheck to opt-out)
                      </label>
                    </div>
                  </div>
                  <div className="form-group full">
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="checkbox" name="pension_applicable" id="pension_applicable"
                        checked={form.pension_applicable ?? false} onChange={onChange}
                        style={{ width:16, height:16, accentColor:'var(--accent)' }} />
                      <label htmlFor="pension_applicable" style={{ margin:0, cursor:'pointer',
                        fontSize:13, fontWeight:500, color:'var(--text-primary)' }}>
                        Pension Applicable — EPS (8.33% of Basic, max ₹1,250/month)
                      </label>
                    </div>
                  </div>
                </div>

                {/* Live gross preview */}
                <div style={{ background:'#F8F9FB', border:'1px solid #E4E7EC',
                  borderRadius:8, padding:'12px 16px', marginTop:12 }}>
                  <div style={{ fontSize:11, color:'var(--text-muted)',
                    textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    New Monthly Gross Preview
                  </div>
                  <div style={{ fontSize:22, fontWeight:700, color:'var(--accent)',
                    fontFamily:'DM Mono, monospace', marginTop:4 }}>
                    {fmt(
                      Number(form.basic_salary||0) + Number(form.hra||0) +
                      Number(form.cca||0) + Number(form.conveyance||0) +
                      Number(form.allowances||0)
                    )}
                  </div>
                </div>

                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm"
                    onClick={() => onSave('Salary components')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => { setEditing(null); setForm(emp) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="Basic Salary"
                  value={fmt(emp.basic_salary)} highlight />
                <FieldRow label="HRA"
                  value={fmt(emp.hra)} highlight />
                <FieldRow label="CCA"
                  value={fmt(emp.cca)} highlight />
                <FieldRow label="Conveyance"
                  value={fmt(emp.conveyance)} highlight />
                <FieldRow label="Other Allowances"
                  value={fmt(emp.allowances)} highlight />
                <div style={{
                  display:'flex', justifyContent:'space-between',
                  alignItems:'center', padding:'12px 0', marginTop:4,
                  borderTop:'2px solid var(--border)',
                }}>
                  <span style={{ fontSize:12, fontWeight:700,
                    color:'var(--text-muted)', textTransform:'uppercase',
                    letterSpacing:'0.04em' }}>
                    Monthly Gross
                  </span>
                  <span style={{ fontSize:18, fontWeight:700,
                    color:'var(--accent)', fontFamily:'DM Mono, monospace' }}>
                    {fmt(monthlyGross)}
                  </span>
                </div>
                <FieldRow label="PF Applicable"
                  value={emp.pf_applicable ? 'Yes — Enrolled' : 'No — Form 11 opt-out'} />
                <FieldRow label="ESIC Applicable"
                  value={emp.esic_applicable ? 'Yes — Enrolled' : 'No — Opted out'} />
                <FieldRow label="Pension (EPS)"
                  value={emp.pension_applicable ? 'Yes — EPS enrolled' : 'No — Not enrolled'} />
                <button className="btn btn-outline btn-sm mt-16"
                  onClick={() => setEditing('salary')}>
                  ✏ Edit Salary Components
                </button>
              </>
            )}
          </Section>

          {/* Compliance Details */}
          <Section title="Compliance & Identity">
            {editing === 'compliance' ? (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>PAN Number</label>
                    <input name="pan" value={form.pan||''}
                      onChange={onChange} placeholder="ABCPS1234D" />
                  </div>
                  <div className="form-group">
                    <label>Aadhaar Number</label>
                    <input name="aadhaar" value={form.aadhaar||''}
                      onChange={onChange} placeholder="123456789012" />
                  </div>
                  <div className="form-group">
                    <label>UAN Number</label>
                    <input name="uan_number" value={form.uan_number||''}
                      onChange={onChange} placeholder="100XXXXXXXXX" />
                  </div>
                  <div className="form-group">
                    <label>PF Number</label>
                    <input name="pf_number" value={form.pf_number||''}
                      onChange={onChange} placeholder="MH/XXXXX/XXX" />
                  </div>
                </div>
                <div className="flex gap-8 mt-16">
                  <button className="btn btn-primary btn-sm"
                    onClick={() => onSave('Compliance details')} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button className="btn btn-outline btn-sm"
                    onClick={() => { setEditing(null); setForm(emp) }}>
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <FieldRow label="PAN Number"    value={emp.pan}        highlight />
                <FieldRow label="Aadhaar"       value={emp.aadhaar}    highlight />
                <FieldRow label="UAN Number"    value={emp.uan_number} highlight />
                <FieldRow label="PF Number"     value={emp.pf_number}  highlight />
                <button className="btn btn-outline btn-sm mt-16"
                  onClick={() => setEditing('compliance')}>
                  ✏ Edit Compliance Details
                </button>
              </>
            )}
          </Section>
        </div>
      </div>
    </Layout>
  )
}
