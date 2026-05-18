import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const LETTER_TYPES = [
  {
    type : 'appointment',
    label: 'Appointment Letter',
    icon : '📋',
    desc : 'Full appointment letter with Annexure A, B & C as per company format',
    color: '#2E90FA',
    bg   : '#EFF8FF',
    border:'#B2DDFF',
  },
  {
    type : 'warning',
    label: 'Performance Warning Letter',
    icon : '⚠️',
    desc : 'Warning letter for performance/conduct issues as per Maharashtra law',
    color: '#F04438',
    bg   : '#FEF3F2',
    border:'#FECDCA',
  },
]

// Default responsibilities by designation
const DEFAULT_RESPONSIBILITIES = {
  'Tech Head'         : ['Lead and manage the technical team for all solar project installations.','Oversee site surveys, system design, and technical documentation.','Ensure quality control and compliance with safety standards on all projects.','Coordinate with clients, vendors, and internal sales/finance teams.','Prepare technical reports and submit weekly updates to management.','Train junior technicians and ensure adherence to company SOPs.'],
  'Technician'        : ['Execute on-site installation of solar PV systems as per design specifications.','Conduct regular maintenance visits for AMC clients.','Report site conditions and generate service completion reports.','Ensure all safety protocols are followed during installation and maintenance.','Assist in testing, commissioning, and handover of completed projects.'],
  'Sales Head'        : ['Lead end-to-end solar sales activities for residential, commercial, and industrial clients.','Generate and manage leads across all project categories.','Prepare and present proposals, quotations, and system designs to clients.','Coordinate with technical team for site surveys and project execution.','Achieve monthly and quarterly sales targets as set by management.'],
  'HR Manager'        : ['Manage complete employee lifecycle including recruitment, onboarding, and exit.','Process monthly payroll, statutory compliance (PF, ESIC, PT), and salary disbursement.','Maintain employee records, contracts, and compliance documentation.','Handle employee grievances, disciplinary actions, and performance management.','Coordinate with management for HR policies and company culture initiatives.'],
  'Finance Manager'   : ['Manage day-to-day accounting, billing, and financial reporting.','Ensure timely filing of GST, TDS, and other statutory compliances.','Process vendor payments, client invoicing, and accounts reconciliation.','Prepare monthly MIS reports and financial statements for management review.','Coordinate with auditors for annual accounts and compliance audits.'],
}

export default function Letters() {
  const [employees,   setEmployees]   = useState([])
  const [selectedEmp, setSelectedEmp] = useState('')
  const [letterType,  setLetterType]  = useState('appointment')
  const [generating,  setGenerating]  = useState(false)
  const [alert,       setAlert]       = useState(null)
  const [step,        setStep]        = useState(1)

  // Form data
  const [form, setForm] = useState({
    date: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),

    // Appointment editable fields
    candidateName: '',
    salutation: 'Mr.',
    address: '',
    phone: '',
    email: '',
    designation: '',
    reportingTo: 'Mr. Usman Begawala',
    joiningDate: '',
    contractDuration: '2 years',
    salary: '',
    responsibilities: '',
    acceptanceText: 'I hereby acknowledge that I have read, understood, and agreed to all terms and conditions of this Appointment Letter and its Annexures.',
    acceptanceName: '',
    acceptanceDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    acceptancePlace: 'Vashi, Navi Mumbai',

    // Warning
    warningLevel: '1st',
    incidentDate: '',
    incidentDetail: '',
    expectedAction: '',
    hrManager: 'Usman Begawala',
  })

  useEffect(() => {
    fetch('/api/employees')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setEmployees(d) })
  }, [])

  // Auto-fill from employee data
  useEffect(() => {
    if (!selectedEmp) return
    const emp = employees.find(e => e.id === selectedEmp)
    if (!emp) return
    const defaultRes = DEFAULT_RESPONSIBILITIES[emp.designation] || []
    setForm(f => ({
      ...f,
      email          : emp.email       || '',
      phone          : emp.phone       || '',
      responsibilities: defaultRes.join('\n'),
    }))
  }, [selectedEmp, employees])

  const onChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const generate = async () => {
    if (letterType === 'warning' && !selectedEmp) {
      return setAlert({ type: 'error', msg: 'Please select an employee' })
    }

    if (letterType === 'appointment' && !form.candidateName.trim()) {
      return setAlert({ type: 'error', msg: 'Please enter candidate name' })
    }

    setGenerating(true)
    setAlert(null)

    const extra = letterType === 'appointment' ? {
      date: form.date,
      candidateName: form.candidateName,
      salutation: form.salutation,
      address: form.address,
      phone: form.phone,
      email: form.email,
      designation: form.designation,
      reportingTo: form.reportingTo,
      joiningDate: form.joiningDate,
      contractDuration: form.contractDuration,
      salary: form.salary,
      responsibilities: form.responsibilities.split('\n').map(x => x.trim()).filter(Boolean),
      acceptanceText: form.acceptanceText,
      acceptanceName: form.acceptanceName || form.candidateName,
      acceptanceDate: form.acceptanceDate || form.date,
      acceptancePlace: form.acceptancePlace,
    } : {
      date: form.date,
      warningLevel: form.warningLevel,
      incidentDate: form.incidentDate,
      incidentDetail: form.incidentDetail,
      expectedAction: form.expectedAction,
      hrManager: form.hrManager,
    }

    try {
      const res = await fetch('/api/letters/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: letterType,
          employee_id: letterType === 'warning' ? selectedEmp : null,
          extra,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url

      const emp = employees.find(e => e.id === selectedEmp)
      const fileName = letterType === 'appointment'
        ? `appointment_letter_${form.candidateName || 'candidate'}.docx`
        : `${letterType}_letter_${emp?.emp_code || 'employee'}.docx`

      a.download = fileName.replace(/\s+/g, '_')
      a.click()
      window.URL.revokeObjectURL(url)

      setAlert({ type: 'success', msg: 'Letter generated and downloaded successfully!' })
    } catch (err) {
      setAlert({ type: 'error', msg: err.message || 'Failed to generate letter' })
    } finally {
      setGenerating(false)
    }
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmp)
  const selectedLetterType = LETTER_TYPES.find(l => l.type === letterType)

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Letter Generation</h1>
          <p className="page-sub">Generate appointment and warning letters for employees</p>
        </div>
      </div>

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginBottom: 20 }}>
          {alert.msg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

        {/* LEFT — Setup */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Step 1 — Select Employee */}
          {letterType === 'warning' && (
            <div className="card card-pad">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: selectedEmp ? '#ECFDF3' : '#F97316',
                  border: `2px solid ${selectedEmp ? '#A9EFC5' : '#F97316'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  color: selectedEmp ? '#027A48' : '#fff',
                  flexShrink: 0,
                }}>
                  {selectedEmp ? '✓' : '1'}
                </div>
                <span className="card-title">Select Employee</span>
              </div>
              <select
                value={selectedEmp}
                onChange={e => setSelectedEmp(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="">Choose employee...</option>
                {employees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.emp_code} — {e.name} ({e.designation})
                  </option>
                ))}
              </select>
              {selectedEmployee && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'var(--bg)', borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  display: 'flex', gap: 16, fontSize: 12,
                }}>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Department</div>
                    <div style={{ fontWeight: 600 }}>{selectedEmployee.department}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Designation</div>
                    <div style={{ fontWeight: 600 }}>{selectedEmployee.designation}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Joined</div>
                    <div style={{ fontWeight: 600 }}>
                      {selectedEmployee.date_of_joining
                        ? new Date(selectedEmployee.date_of_joining).toLocaleDateString('en-IN',
                            { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2 — Select Letter Type */}
          <div className="card card-pad">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#F97316',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
              }}>2</div>
              <span className="card-title">Select Letter Type</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {LETTER_TYPES.map(lt => (
                <div
                  key={lt.type}
                  onClick={() => setLetterType(lt.type)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: `2px solid ${letterType === lt.type ? lt.color : 'var(--border)'}`,
                    background: letterType === lt.type ? lt.bg : '#fff',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 24 }}>{lt.icon}</span>
                  <div>
                    <div style={{
                      fontWeight: 600, fontSize: 14,
                      color: letterType === lt.type ? lt.color : 'var(--text-primary)'
                    }}>
                      {lt.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {lt.desc}
                    </div>
                  </div>
                  {letterType === lt.type && (
                    <div style={{ marginLeft: 'auto', color: lt.color, fontWeight: 700 }}>✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            className="btn btn-primary"
            onClick={generate}
            disabled={generating || (letterType === 'warning' && !selectedEmp)}
            style={{
              width: '100%', height: 52,
              fontSize: 15, fontWeight: 700,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10,
              opacity: (generating || (letterType === 'warning' && !selectedEmp)) ? 0.6 : 1,
            }}
          >
            {generating ? (
              <>
                <span style={{ display:'inline-block', width:16, height:16,
                  border:'2px solid rgba(255,255,255,0.35)', borderTopColor:'#fff',
                  borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                Generating...
              </>
            ) : (
              <>
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {selectedLetterType?.label}
              </>
            )}
          </button>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>

        {/* RIGHT — Form Details */}
        <div className="card card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: '#F97316',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
            }}>3</div>
            <span className="card-title">Letter Details</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Common — Date */}
            <div className="form-group">
              <label>Letter Date</label>
              <input name="date" value={form.date} onChange={onChange} placeholder="DD/MM/YYYY" />
            </div>

            {/* APPOINTMENT FIELDS */}
            {letterType === 'appointment' && (
              <>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Salutation</label>
                    <select name="salutation" value={form.salutation} onChange={onChange}>
                      <option value="Mr.">Mr.</option>
                      <option value="Ms.">Ms.</option>
                      <option value="Mrs.">Mrs.</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Name</label>
                    <input name="candidateName" value={form.candidateName} onChange={onChange} placeholder="Employee name" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <textarea name="address" value={form.address} onChange={onChange} rows={3} placeholder="Full residential address" />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Mobile Number</label>
                    <input name="phone" value={form.phone} onChange={onChange} placeholder="9876543210" />
                  </div>

                  <div className="form-group">
                    <label>Email ID</label>
                    <input name="email" value={form.email} onChange={onChange} placeholder="employee@example.com" />
                  </div>

                  <div className="form-group">
                    <label>Designation</label>
                    <input name="designation" value={form.designation} onChange={onChange} placeholder="SEO & Digital Marketing Executive" />
                  </div>

                  <div className="form-group">
                    <label>Reporting Person</label>
                    <input name="reportingTo" value={form.reportingTo} onChange={onChange} placeholder="Mr. Usman Begawala" />
                  </div>

                  <div className="form-group">
                    <label>Contract Confirmation Date</label>
                    <input name="joiningDate" value={form.joiningDate} onChange={onChange} placeholder="March 5th, 2026" />
                  </div>

                  <div className="form-group">
                    <label>Monthly Salary</label>
                    <input name="salary" value={form.salary} onChange={onChange} placeholder="32,000" />
                  </div>
                </div>

                <div className="form-group">
                  <label>Roles & Responsibilities - Annexure B</label>
                  <textarea
                    name="responsibilities"
                    value={form.responsibilities}
                    onChange={onChange}
                    rows={10}
                    placeholder="Enter each responsibility on a new line..."
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1.5px solid var(--border)', borderRadius: 8,
                      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                      lineHeight: 1.6, resize: 'vertical', color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="form-group">
                  <label>Employee Acceptance Text</label>
                  <textarea
                    name="acceptanceText"
                    value={form.acceptanceText}
                    onChange={onChange}
                    rows={3}
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1.5px solid var(--border)', borderRadius: 8,
                      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                      lineHeight: 1.6, resize: 'vertical', color: 'var(--text-primary)',
                    }}
                  />
                </div>

                <div className="form-grid">
                  <div className="form-group">
                    <label>Acceptance Name</label>
                    <input name="acceptanceName" value={form.acceptanceName} onChange={onChange} placeholder="Employee name" />
                  </div>

                  <div className="form-group">
                    <label>Acceptance Date</label>
                    <input name="acceptanceDate" value={form.acceptanceDate} onChange={onChange} placeholder="05/03/2026" />
                  </div>

                  <div className="form-group">
                    <label>Acceptance Place</label>
                    <input name="acceptancePlace" value={form.acceptancePlace} onChange={onChange} placeholder="Vashi, Navi Mumbai" />
                  </div>
                </div>
              </>
            )}

            {/* WARNING FIELDS */}
            {letterType === 'warning' && (
              <>
                <div className="form-group">
                  <label>Warning Level</label>
                  <select name="warningLevel" value={form.warningLevel} onChange={onChange}>
                    <option value="1st">1st Warning</option>
                    <option value="2nd">2nd Warning</option>
                    <option value="Final">Final Warning</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Date of Incident</label>
                  <input type="date" name="incidentDate" value={form.incidentDate} onChange={onChange} />
                </div>
                <div className="form-group">
                  <label>Incident / Performance Issue Details</label>
                  <textarea
                    name="incidentDetail"
                    value={form.incidentDetail}
                    onChange={onChange}
                    rows={4}
                    placeholder="Describe the specific incident or performance issue..."
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1.5px solid var(--border)', borderRadius: 8,
                      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                      lineHeight: 1.6, resize: 'vertical', color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>Expected Corrective Action</label>
                  <textarea
                    name="expectedAction"
                    value={form.expectedAction}
                    onChange={onChange}
                    rows={3}
                    placeholder="Describe specific improvements expected from the employee..."
                    style={{
                      width: '100%', padding: '10px 12px',
                      border: '1.5px solid var(--border)', borderRadius: 8,
                      fontSize: 13, fontFamily: 'DM Sans, sans-serif',
                      lineHeight: 1.6, resize: 'vertical', color: 'var(--text-primary)',
                    }}
                  />
                </div>
                <div className="form-group">
                  <label>HR Manager / Signatory Name</label>
                  <input name="hrManager" value={form.hrManager} onChange={onChange} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
