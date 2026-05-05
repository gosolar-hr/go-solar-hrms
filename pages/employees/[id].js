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
