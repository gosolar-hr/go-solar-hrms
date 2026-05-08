import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import Link from 'next/link'

const EMPTY = {
  emp_code:'', name:'', email:'', phone:'',
  date_of_joining:'', designation:'', department:'',
  basic_salary:'', hra:'', cca:'', conveyance:'', allowances:'',
  pf_applicable: true, esic_applicable: true, gender:'male',
  pan:'', aadhaar:'', bank_account:'',
  ifsc_code:'', bank_branch:'', bank_location:'',
}

export default function Employees() {
  const [employees, setEmployees] = useState([])
  const [form,      setForm]      = useState(EMPTY)
  const [showForm,  setShowForm]  = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [alert,     setAlert]     = useState(null)
  const [search,    setSearch]    = useState('')

  const load = () =>
    fetch('/api/employees').then(r => r.json())
      .then(d => setEmployees(Array.isArray(d) ? d : []))

  useEffect(() => { load() }, [])

  const onChange = e => {
    const { name, value, type, checked } = e.target
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const onSubmit = async () => {
    if (!form.name || !form.email || !form.date_of_joining || !form.basic_salary) {
      return setAlert({ type:'error', msg:'Name, email, joining date and basic salary are required.' })
    }
    setLoading(true)
    const res = await fetch('/api/employees', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...form,
        basic_salary: Number(form.basic_salary),
        hra         : Number(form.hra)         || 0,
        cca         : Number(form.cca)         || 0,
        conveyance  : Number(form.conveyance)  || 0,
        allowances  : Number(form.allowances)  || 0,
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`${data.name} added successfully.` })
    setForm(EMPTY)
    setShowForm(false)
    load()
  }

  const fmt = n => '₹' + Number(n||0).toLocaleString('en-IN')

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.emp_code?.includes(search) ||
    e.department?.toLowerCase().includes(search.toLowerCase()) ||
    e.designation?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Employees</h1>
          <p className="page-sub">{employees.length} team members</p>
        </div>
        <div className="flex gap-8 items-center">
          <input
            placeholder="Search name, code, department..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width:240 }}
          />
          <button className="btn btn-primary"
            onClick={() => { setShowForm(s => !s); setAlert(null) }}>
            {showForm ? 'Cancel' : '+ Add Employee'}
          </button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Add employee form */}
      {showForm && (
        <div className="card card-pad" style={{ marginBottom:24 }}>
          <div className="card-title" style={{ marginBottom:20 }}>New Employee</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input name="name" placeholder="Ravi Kumar"
                value={form.name} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input name="email" type="email" placeholder="ravi@gosolar.in"
                value={form.email} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input name="phone" placeholder="9876543210"
                value={form.phone} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Date of Joining *</label>
              <input name="date_of_joining" type="date"
                value={form.date_of_joining} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Department</label>
              <select name="department" value={form.department} onChange={onChange}>
                <option value="">Select</option>
                {['Operations','Sales','Finance','HR','Technical','Admin'].map(d =>
                  <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Designation</label>
              <input name="designation" placeholder="e.g. Solar Design Engineer"
                value={form.designation} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Employee Code</label>
              <input name="emp_code" placeholder="e.g. 2301"
                value={form.emp_code} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Gender</label>
              <select name="gender" value={form.gender} onChange={onChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Basic Salary (₹) *</label>
              <input name="basic_salary" type="number" placeholder="15000"
                value={form.basic_salary} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>HRA (₹)</label>
              <input name="hra" type="number" placeholder="1000"
                value={form.hra} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>CCA (₹)</label>
              <input name="cca" type="number" placeholder="0"
                value={form.cca} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Conveyance (₹)</label>
              <input name="conveyance" type="number" placeholder="0"
                value={form.conveyance} onChange={onChange} />
            </div>
            <div className="form-group full">
              <label>Other Allowances (₹)</label>
              <input name="allowances" type="number" placeholder="0"
                value={form.allowances} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Bank Account</label>
              <input name="bank_account" placeholder="50100XXXXXXXX"
                value={form.bank_account} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>IFSC Code</label>
              <input name="ifsc_code" placeholder="HDFC0001234"
                value={form.ifsc_code} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Branch Name</label>
              <input name="bank_branch" placeholder="Main Branch"
                value={form.bank_branch} onChange={onChange} />
            </div>
            <div className="form-group">
              <label>Place / Location</label>
              <input name="bank_location" placeholder="Mumbai"
                value={form.bank_location} onChange={onChange} />
            </div>
              <div className="form-group full" style={{
                flexDirection:'row', alignItems:'center', gap:10 }}>
                <input type="checkbox" name="pf_applicable" id="pf_new"
                  checked={form.pf_applicable} onChange={onChange}
                  style={{ width:16, height:16, accentColor:'var(--accent)' }} />
                <label htmlFor="pf_new" style={{ margin:0, cursor:'pointer' }}>
                  PF Applicable
                </label>
              </div>
              <div className="form-group full" style={{
                flexDirection:'row', alignItems:'center', gap:10 }}>
                <input type="checkbox" name="esic_applicable" id="esic_new"
                  checked={form.esic_applicable} onChange={onChange}
                  style={{ width:16, height:16, accentColor:'var(--accent)' }} />
                <label htmlFor="esic_new" style={{ margin:0, cursor:'pointer' }}>
                  ESIC Applicable
                </label>
              </div>
          </div>
          <div className="divider" />
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={onSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Save Employee'}
            </button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Employee table */}
      <div className="card">
        <div className="table-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <strong>{search ? 'No results found' : 'No employees yet'}</strong>
              <p>{search ? 'Try a different search term' : 'Click "+ Add Employee" to get started.'}</p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Emp No</th>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Basic</th>
                  <th>HRA</th>
                  <th>CCA</th>
                  <th>Conv.</th>
                  <th>Other Allow.</th>
                  <th>Monthly Gross</th>
                  <th>PF</th>
                  <th>ESIC</th>
                  <th style={{ width:80 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id}>
                    <td>
                      <span className="badge badge-gray">{e.emp_code || '—'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight:500 }}>{e.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                        {e.designation || e.email}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-gray">{e.department || '—'}</span>
                    </td>
                    <td className="mono">{fmt(e.basic_salary)}</td>
                    <td className="mono">{fmt(e.hra)}</td>
                    <td className="mono">{fmt(e.cca || 0)}</td>
                    <td className="mono">{fmt(e.conveyance || 0)}</td>
                    <td className="mono">{fmt(e.allowances || 0)}</td>
                    <td className="mono" style={{ fontWeight:600 }}>
                      {fmt(
                        Number(e.basic_salary)    +
                        Number(e.hra)             +
                        Number(e.cca        || 0) +
                        Number(e.conveyance || 0) +
                        Number(e.allowances || 0)
                      )}
                    </td>
                    <td>
                      <span className={`badge ${e.pf_applicable
                        ? 'badge-green' : 'badge-red'}`}>
                        {e.pf_applicable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${e.esic_applicable ? 'badge-green' : 'badge-red'}`}>
                        {e.esic_applicable ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <Link
                        href={`/employees/${e.id}`}
                        style={{
                          fontSize      : 12,
                          fontWeight    : 600,
                          color         : 'var(--accent)',
                          textDecoration: 'none',
                          padding       : '4px 10px',
                          border        : '1px solid var(--border)',
                          borderRadius  : 6,
                          whiteSpace    : 'nowrap',
                        }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  )
}
