import { useEffect, useState, useRef, useCallback } from 'react'
import Layout from '../components/Layout'
import { getWeekOffDatesSync } from '../lib/weekoffs'

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

const STATUS_CONFIG = {
  'P'   : { label: 'Present',        color: '#12B76A', bg: '#ECFDF3', border: '#A9EFC5' },
  'A'   : { label: 'Absent/LWP',     color: '#F04438', bg: '#FEF3F2', border: '#FECDCA' },
  'PL'  : { label: 'Paid Leave',     color: '#2E90FA', bg: '#EFF8FF', border: '#B2DDFF' },
  'MO'  : { label: 'Morning Off',    color: '#F79009', bg: '#FFFAEB', border: '#FEF0C7' },
  'AO'  : { label: 'Afternoon Off',  color: '#F79009', bg: '#FFFAEB', border: '#FEF0C7' },
  'H'   : { label: 'Holiday',        color: '#7F56D9', bg: '#F4F3FF', border: '#D9D6FE' },
  'WO'  : { label: 'Week Off',       color: '#667085', bg: '#F8F9FB', border: '#E4E7EC' },
  'W/O' : { label: 'Week Off',       color: '#667085', bg: '#F8F9FB', border: '#E4E7EC' },
  'P:P' : { label: 'Present',        color: '#12B76A', bg: '#ECFDF3', border: '#A9EFC5' },
  'P:A' : { label: 'Half Day',       color: '#F79009', bg: '#FFFAEB', border: '#FEF0C7' },
  'A:P' : { label: 'Half Day',       color: '#F79009', bg: '#FFFAEB', border: '#FEF0C7' },
  'A:A' : { label: 'Absent/LWP',     color: '#F04438', bg: '#FEF3F2', border: '#FECDCA' },
}

const SLAB_OPTIONS = [
  { value: 0,   label: 'No Deduction — On time / Grace (before 9:45)' },
  { value: 0.2, label: '20% — Late (9:45–10:00)'                      },
  { value: 0.3, label: '30% — Late (10:00–10:30)'                     },
  { value: 0.5, label: '50% — Late after 10:30'                       },
]

const STATUS_OPTIONS = ['P', 'PL', 'MO', 'AO', 'A', 'H', 'WO']

export default function Attendance() {
  const now  = new Date()
  const [employees,    setEmployees]    = useState([])
  const [selectedEmp,  setSelectedEmp]  = useState('')
  const [month,        setMonth]        = useState(now.getMonth() + 1)
  const [year,         setYear]         = useState(now.getFullYear())
  const [calData,      setCalData]      = useState({})
  const [loading,      setLoading]      = useState(false)
  const [saving,       setSaving]       = useState(null)
  const [savedDate,    setSavedDate]    = useState(null)   // tracks last saved date for confirmation
  const [alert,        setAlert]        = useState(null)
  const [importing,    setImporting]    = useState(false)
  const [holidays,     setHolidays]     = useState([])
  const [showHoliday,  setShowHoliday]  = useState(false)
  const [newHoliday,   setNewHoliday]   = useState({ date:'', name:'' })
  const [empSchedule,  setEmpSchedule]  = useState('standard')
  const fileRef     = useRef(null)
  // FIX: use a ref to track the current fetch request
  // so stale responses from previous employee are ignored
  const fetchIdRef  = useRef(0)

  // Load employees
  useEffect(() => {
    fetch('/api/employees').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setEmployees(d)
    })
  }, [])

  // When employee changes — load their schedule
  useEffect(() => {
    if (!selectedEmp) return
    const emp = employees.find(e => e.id === selectedEmp)
    setEmpSchedule(emp?.work_schedule || 'standard')
  }, [selectedEmp, employees])

  // Load holidays
  const loadHolidays = () =>
    fetch(`/api/holidays?year=${year}`)
      .then(r => r.json())
      .then(d => setHolidays(Array.isArray(d) ? d : []))

  useEffect(() => { loadHolidays() }, [year])

  // FIX: useCallback + fetchId prevents stale closure overwriting data
  const loadCalData = useCallback((empId, m, y) => {
    if (!empId) return

    // Clear immediately + increment fetch ID
    setCalData({})
    setLoading(true)
    setAlert(null)
    setSavedDate(null)

    const currentFetchId = ++fetchIdRef.current

    fetch(`/api/attendance/details?employee_id=${empId}&month=${m}&year=${y}`)
      .then(r => r.json())
      .then(d => {
        // IGNORE if a newer fetch has started (employee/month changed again)
        if (currentFetchId !== fetchIdRef.current) return

        const map = {}
        if (Array.isArray(d)) {
          d.forEach(row => {
            map[row.date] = {
              status    : row.status,
              late_slab : row.salary_cut || 0,
              remark    : row.remark     || '',
            }
          })
        }
        setCalData(map)
        setLoading(false)
      })
      .catch(() => {
        if (currentFetchId !== fetchIdRef.current) return
        setCalData({})
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    loadCalData(selectedEmp, month, year)
  }, [selectedEmp, month, year, loadCalData])

  // Get all days in month
  const getDaysInMonth = () => {
    const days = []
    const daysInMonth = new Date(year, month, 0).getDate()
    for (let d = 1; d <= daysInMonth; d++) {
      const date    = new Date(year, month - 1, d)
      const dateStr = date.toISOString().split('T')[0]
      days.push({ date: dateStr, day: d, dow: date.getDay() })
    }
    return days
  }

  const getFirstDayOffset = () => new Date(year, month - 1, 1).getDay()

  const days   = getDaysInMonth()
  const offset = getFirstDayOffset()

  const normalizeStatus = (status) => {
    if (!status) return status
    // Normalize biometric codes to clean codes for manual entry
    if (status === 'P:P') return 'P'
    if (status === 'A:A') return 'A'
    return status
  }

  // FIX: updateDay now shows save confirmation tick
  const updateDay = async (date, field, value) => {
    const current = calData[date] || { status: null, late_slab: 0, remark: '' }

    // Normalize status when saving manually
    const normalizedValue = field === 'status' ? normalizeStatus(value) : value
    const updated = { ...current, [field]: normalizedValue }

    setCalData(prev => ({ ...prev, [date]: updated }))

    setSaving(date)
    setSavedDate(null)

    const res = await fetch('/api/attendance/details', {
      method  : 'PUT',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({
        employee_id : selectedEmp,
        date,
        status      : updated.status,
        salary_cut  : updated.late_slab,
        remark      : updated.remark,
      }),
    })

    setSaving(null)

    if (!res.ok) {
      setAlert({ type:'error', msg: `Failed to save ${date}` })
    } else {
      // Show saved tick for 2 seconds then clear
      setSavedDate(date)
      setTimeout(() => setSavedDate(null), 2000)
    }
  }

  const bulkFill = async (status) => {
    if (!selectedEmp) return

    const holidayDates = holidays.map(h => h.date)

    const workingDays = days
      .filter(({ date, dow }) => {
        const isSun    = dow === 0
        const is2nd4th = isNthSaturday(date, dow, [2, 4])
        const isHoliday = holidayDates.includes(date)

        const isWO =
          empSchedule === '7day' ? false :
          empSchedule === '6day' ? isSun :
          (isSun || is2nd4th)

        return !isWO && !isHoliday
      })
      .map(({ date }) => date)

    if (workingDays.length === 0) return

    const newCalData = { ...calData }
    workingDays.forEach(date => {
      newCalData[date] = {
        status    : status,
        late_slab : 0,
        remark    : calData[date]?.remark || '',
      }
    })
    setCalData(newCalData)
    setSaving('bulk')

    const res = await fetch('/api/attendance/bulk', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({
        employee_id : selectedEmp,
        month,
        year,
        dates       : workingDays,
        status      : status || 'A',
      }),
    })

    const data = await res.json()
    setSaving(null)

    if (!res.ok) {
      setAlert({ type:'error', msg: data.error })
      return
    }

    setAlert({
      type : 'success',
      msg  : status
        ? `✅ ${workingDays.length} days marked as ${
            status === 'P' || status === 'P:P' ? 'Present' : 'Absent/LWP'
          } — Saved. Present: ${data.present_days} | Late marks: ${data.late_marks}`
        : `Attendance cleared for ${selectedEmployee?.name}`,
    })
  }

  const cycleStatus = (date, dow) => {
    const holidayDates = holidays.map(h => h.date)

    const isSun    = dow === 0
    const is2nd4th = isNthSaturday(date, dow, [2, 4])
    const isHoliday = holidayDates.includes(date)

    const isWO =
      empSchedule === '7day' ? false :
      empSchedule === '6day' ? isSun :
      (isSun || is2nd4th)

    if (isWO || isHoliday) return

    const current  = calData[date]?.status || null
    const editable = ['P', 'MO', 'AO', 'A', 'PL']
    const idx      = editable.indexOf(current)
    const next     = editable[(idx + 1) % editable.length]
    updateDay(date, 'status', next)
  }

  const isNthSaturday = (dateStr, dow, nths) => {
    if (dow !== 6) return false
    const d   = new Date(dateStr)
    const nth = Math.ceil(d.getDate() / 7)
    return nths.includes(nth)
  }

  const summary = Object.entries(calData).reduce((acc, [date, val]) => {
    const s = val?.status || ''

    // Present — covers both manual (P) and biometric (P:P)
    if (s === 'P' || s === 'P:P') {
      acc.present++
    }
    // Paid Leave
    else if (s === 'PL') {
      acc.pl++
    }
    // Morning Off — half day
    else if (s === 'MO') {
      acc.mo++
      acc.present += 0.5  // counts as 0.5 present
    }
    // Afternoon Off — half day
    else if (s === 'AO') {
      acc.ao++
      acc.present += 0.5  // counts as 0.5 present
    }
    // Absent — covers A, A:A, LWP, LOP
    else if (s === 'A' || s === 'A:A' || s === 'LWP' || s === 'LOP') {
      acc.absent++
    }
    // Half day from biometric (P:A or A:P)
    else if (s === 'P:A' || s === 'A:P') {
      acc.present += 0.5
      acc.absent  += 0.5
    }
    // Holiday
    else if (s === 'H') {
      acc.holiday++
    }
    // Week Off — covers both WO and W/O
    else if (s === 'WO' || s === 'W/O') {
      acc.wo++
    }

    // Late marks — any present day with a slab
    if (val?.late_slab > 0 && (s === 'P' || s === 'P:P')) {
      acc.late++
    }

    return acc
  }, { present: 0, pl: 0, mo: 0, ao: 0, absent: 0, holiday: 0, wo: 0, late: 0 })

  const onImportCSV = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    setAlert(null)
    const text    = await file.text()
    const lines   = text.trim().split('\n')
    const records = lines.slice(1).map(line => {
      const [emp_code, date, status, late_slab, ...remarkParts] = line.split(',').map(s => s.trim())
      return { emp_code, date, status, late_slab: parseFloat(late_slab)||0, remark: remarkParts.join(',') }
    }).filter(r => r.emp_code && r.status)

    const res  = await fetch('/api/attendance/import', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ records, month, year }),
    })
    const data = await res.json()
    setImporting(false)
    fileRef.current.value = ''
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg: data.message })
    if (selectedEmp) loadCalData(selectedEmp, month, year)
  }

  const addHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name) return
    await fetch('/api/holidays', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(newHoliday)
    })
    setNewHoliday({ date:'', name:'' })
    loadHolidays()
  }

  const removeHoliday = async (date) => {
    await fetch('/api/holidays', {
      method:'DELETE', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ date })
    })
    loadHolidays()
  }

  const selectedEmployee = employees.find(e => e.id === selectedEmp)
  const DAYS_LABEL = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-sub">Monthly calendar view — click any day to update status</p>
          <div style={{ marginTop:4 }}><span className="text-muted">Working days: 30</span></div>
        </div>
        <div className="flex gap-8 items-center">
          <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} style={{ width:200 }}>
            <option value="">Select Employee</option>
            {employees.map(e => (
              <option key={e.id} value={e.id}>{e.emp_code} — {e.name}</option>
            ))}
          </select>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ width:130 }}>
            {MONTHS.map((m,i) => <option key={m} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ width:90 }}>
            {[2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Top strip — import + holidays */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Import Biometric CSV</div>
              <div className="text-muted" style={{ marginTop:4 }}>
                emp_code, date, status, late_slab, remark
              </div>
            </div>
            <div className="flex gap-8">
              <input ref={fileRef} type="file" accept=".csv"
                onChange={onImportCSV} style={{ display:'none' }} id="csv-upload" />
              <label htmlFor="csv-upload" className="btn btn-outline" style={{ cursor:'pointer' }}>
                {importing ? 'Importing...' : '⬆ Upload CSV'}
              </label>
              <a href="/sample_attendance.csv" download className="btn btn-outline btn-sm">
                ↓ Sample
              </a>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="flex items-center justify-between">
            <div>
              <div className="card-title">Holidays — {year}</div>
              <div className="text-muted" style={{ marginTop:4 }}>Auto-applied during import</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => setShowHoliday(s => !s)}>
              {showHoliday ? 'Cancel' : '+ Add'}
            </button>
          </div>
          {showHoliday && (
            <div className="flex gap-8 items-center mt-16">
              <input type="date" value={newHoliday.date}
                onChange={e => setNewHoliday(h => ({ ...h, date: e.target.value }))}
                style={{ width:150 }} />
              <input placeholder="Holiday name" value={newHoliday.name}
                onChange={e => setNewHoliday(h => ({ ...h, name: e.target.value }))}
                style={{ flex:1 }} />
              <button className="btn btn-primary btn-sm" onClick={addHoliday}>Save</button>
            </div>
          )}
          {holidays.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:12 }}>
              {holidays.map(h => (
                <div key={h.date} style={{
                  display:'flex', alignItems:'center', gap:6,
                  padding:'3px 10px', background:'#FFF4ED',
                  border:'1px solid #FED7AA', borderRadius:20,
                  fontSize:11, fontWeight:500, color:'#EA6A05'
                }}>
                  {h.date} · {h.name}
                  <button onClick={() => removeHoliday(h.date)}
                    style={{ background:'none', border:'none', cursor:'pointer',
                      color:'#98A2B3', fontSize:14, lineHeight:1 }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {!selectedEmp ? (
        <div className="card">
          <div className="empty-state">
            <strong>Select an employee</strong>
            <p>Choose an employee to view and edit their monthly attendance calendar.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Summary strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:10, marginBottom:16 }}>
            {[
              { label:'Present',       value: summary.present,  color:'#12B76A' },
              { label:'Paid Leave',    value: summary.pl,        color:'#2E90FA' },
              { label:'Morning Off',   value: summary.mo,        color:'#F79009' },
              { label:'Afternoon Off', value: summary.ao,        color:'#F79009' },
              { label:'Absent/LWP',    value: summary.absent,   color:'#F04438' },
              { label:'Holiday',       value: summary.holiday,  color:'#7F56D9' },
              { label:'Week Off',      value: summary.wo,       color:'#667085' },
              { label:'Late Marks',    value: summary.late,      color:'#F97316' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding:'12px 10px', borderTop:`3px solid ${s.color}` }}>
                <div style={{ fontSize:10, fontWeight:600, color:'#98A2B3',
                  textTransform:'uppercase', letterSpacing:'0.04em' }}>
                  {s.label}
                </div>
                <div style={{ fontSize:20, fontWeight:700, color:'#101828',
                  fontFamily:'DM Mono, monospace', marginTop:4 }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap' }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:6,
                fontSize:12, color:'#475467' }}>
                <div style={{ width:12, height:12, borderRadius:3,
                  background:cfg.bg, border:`1.5px solid ${cfg.border}` }} />
                <span style={{ fontWeight:600, color:cfg.color }}>{key}</span>
                <span>— {cfg.label}</span>
              </div>
            ))}
          </div>

          {/* Calendar */}
          <div className="card">
            <div className="card-header">
              <div>
                <span className="card-title">
                  {selectedEmployee?.name} — {MONTHS[month-1]} {year}
                </span>
                {/* FIX: Auto-save status indicator */}
                <div style={{ marginTop:4, display:'flex', alignItems:'center', gap:6 }}>
                  {saving && saving !== 'bulk' && (
                    <span style={{ fontSize:11, color:'#2E90FA', display:'flex',
                      alignItems:'center', gap:4 }}>
                      <span style={{ display:'inline-block', width:8, height:8,
                        border:'2px solid #2E90FA', borderTopColor:'transparent',
                        borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                      Saving...
                    </span>
                  )}
                  {saving === 'bulk' && (
                    <span style={{ fontSize:11, color:'#2E90FA', display:'flex',
                      alignItems:'center', gap:4 }}>
                      <span style={{ display:'inline-block', width:8, height:8,
                        border:'2px solid #2E90FA', borderTopColor:'transparent',
                        borderRadius:'50%', animation:'spin 0.6s linear infinite' }} />
                      Saving all days...
                    </span>
                  )}
                  {!saving && savedDate && (
                    <span style={{ fontSize:11, color:'#027A48', display:'flex',
                      alignItems:'center', gap:4 }}>
                      <span style={{ fontSize:13 }}>✓</span>
                      Saved automatically
                    </span>
                  )}
                  {!saving && !savedDate && !loading && selectedEmp && (
                    <span style={{ fontSize:11, color:'#98A2B3' }}>
                      Changes save automatically on each click
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-8 items-center">
                {/* Quick Fill Buttons */}
                <div style={{
                  display     : 'flex',
                  gap         : 6,
                  alignItems  : 'center',
                  padding     : '4px 8px',
                  background  : 'var(--bg)',
                  borderRadius: 8,
                  border      : '1px solid var(--border)',
                }}>
                  <span style={{ fontSize:11, color:'var(--text-muted)',
                    fontWeight:600, marginRight:4 }}>
                    Quick Fill:
                  </span>
                  <button
                    className="btn btn-sm"
                    onClick={() => bulkFill('P')}
                    disabled={!!saving}
                    style={{
                      background: '#ECFDF3', color:'#027A48',
                      border:'1px solid #A9EFC5', height:28,
                      padding:'0 10px', fontSize:11, fontWeight:600,
                    }}
                  >
                    ✓ All Present
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => bulkFill('A')}
                    disabled={!!saving}
                    style={{
                      background: '#FEF3F2', color:'#B42318',
                      border:'1px solid #FECDCA', height:28,
                      padding:'0 10px', fontSize:11, fontWeight:600,
                    }}
                  >
                    ✗ All Absent
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => bulkFill(null)}
                    disabled={!!saving}
                    style={{
                      background:'var(--surface)', color:'var(--text-secondary)',
                      border:'1px solid var(--border)', height:28,
                      padding:'0 10px', fontSize:11, fontWeight:600,
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Spinner keyframe */}
            <style>{`
              @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            <div style={{ padding:20 }}>
              {/* Day labels */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6, marginBottom:6 }}>
                {DAYS_LABEL.map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:600,
                    color: d === 'Sun' ? '#F04438' : '#98A2B3',
                    textTransform:'uppercase', letterSpacing:'0.06em', padding:'4px 0' }}>
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              {loading ? (
                <p className="text-muted" style={{ textAlign:'center', padding:24 }}>Loading...</p>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
                  {Array.from({ length: offset }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}

                  {days.map(({ date, day, dow }) => {
                    const data     = calData[date]
                    const status   = data?.status || null
                    const lateSlab = data?.late_slab || 0
                    const cfg      = status
                      ? (STATUS_CONFIG[status] || STATUS_CONFIG['A'])
                      : null
                    const isSun    = dow === 0
                    const is2nd4th = isNthSaturday(date, dow, [2,4])
                    const isHol    = holidays.map(h=>h.date).includes(date)

                    const isWO =
                      empSchedule === '7day'  ? false :
                      empSchedule === '6day'  ? isSun :
                      (isSun || is2nd4th)

                    const isLocked = isWO || isHol
                    const isToday  = date === new Date().toISOString().split('T')[0]
                    const isSaved  = savedDate === date

                    return (
                      <div
                        key={date}
                        onClick={() => !isLocked && cycleStatus(date, dow)}
                        style={{
                          borderRadius : 10,
                          border       : isSaved
                            ? '2px solid #12B76A'
                            : saving === date
                              ? '2px solid #2E90FA'
                              : `1.5px solid ${cfg ? cfg.border : '#E4E7EC'}`,
                          background   : cfg ? cfg.bg : isLocked ? '#F8F9FB' : '#fff',
                          padding      : '8px 6px',
                          cursor       : isLocked ? 'default' : 'pointer',
                          position     : 'relative',
                          minHeight    : 64,
                          transition   : 'all 0.15s',
                          boxShadow    : isToday ? '0 0 0 2px #F97316' : 'none',
                          opacity      : isLocked && !status ? 0.6 : 1,
                        }}
                      >
                        {/* Day number */}
                        <div style={{
                          fontSize    : 13,
                          fontWeight  : isToday ? 700 : 500,
                          color       : isSun ? '#F04438' : '#101828',
                          marginBottom: 4,
                        }}>
                          {day}
                        </div>

                        {/* Status badge */}
                        {status && (
                          <div style={{
                            fontSize  : 10,
                            fontWeight: 700,
                            color     : cfg.color,
                            lineHeight: 1.2,
                          }}>
                            {status}
                          </div>
                        )}

                        {/* Saving spinner on cell */}
                        {saving === date && (
                          <div style={{
                            position    : 'absolute',
                            top:4, right:4,
                            width:8, height:8,
                            border      : '2px solid #2E90FA',
                            borderTopColor: 'transparent',
                            borderRadius: '50%',
                            animation   : 'spin 0.6s linear infinite',
                          }} />
                        )}

                        {/* Saved tick on cell */}
                        {isSaved && !saving && (
                          <div style={{
                            position  : 'absolute',
                            top:4, right:4,
                            fontSize  : 10,
                            color     : '#12B76A',
                            fontWeight: 700,
                          }}>✓</div>
                        )}

                        {/* Late mark dot */}
                        {lateSlab > 0 && saving !== date && !isSaved && (
                          <div style={{
                            position    : 'absolute',
                            top:4, right:4,
                            width:6, height:6,
                            background  : '#F97316',
                            borderRadius: '50%',
                          }} title={`Late: ${lateSlab*100}%`} />
                        )}

                        {/* Week off / Holiday label */}
                        {isLocked && !status && (
                          <div style={{ fontSize:9, color:'#98A2B3', marginTop:2 }}>
                            {isHol ? 'H' : 'WO'}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Legend strip */}
            <div style={{ borderTop:'1px solid #F2F4F7', padding:'16px 20px' }}>
              <div style={{ fontSize:12, color:'#98A2B3', marginBottom:12 }}>
                CLICK ANY WORKDAY TO CYCLE STATUS · P → MO → AO → A → PL → back to P
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
                {STATUS_OPTIONS.filter(s => !['H','WO'].includes(s)).map(s => {
                  const cfg = STATUS_CONFIG[s]
                  return (
                    <div key={s} style={{
                      padding     : '8px 12px',
                      borderRadius: 8,
                      border      : `1.5px solid ${cfg.border}`,
                      background  : cfg.bg,
                      textAlign   : 'center',
                      fontSize    : 12,
                      fontWeight  : 600,
                      color       : cfg.color,
                    }}>
                      {s} — {cfg.label}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Late mark override per day */}
          <div className="card" style={{ marginTop:16 }}>
            <div className="card-header">
              <span className="card-title">Late Mark Override</span>
              <span className="text-muted">Set deduction slab per day manually — saves automatically</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Late Deduction</th>
                    <th>Remark</th>
                    <th style={{ width:80 }}>Saved</th>
                  </tr>
                </thead>
                <tbody>
                  {days
                    .filter(({ date }) => {
                      const s = calData[date]?.status
                      return s === 'P' || s === 'PL' || s === 'P:P'
                    })
                    .map(({ date, dow }) => {
                      const data     = calData[date] || {}
                      const dayName  = DAYS_LABEL[dow]
                      const status   = data.status || '—'
                      const lateSlab = data.late_slab || 0
                      const remark   = data.remark || ''
                      const cfg      = STATUS_CONFIG[status] || STATUS_CONFIG['A']
                      const isSaving = saving === date
                      const isSaved  = savedDate === date
                      return (
                        <tr key={date} style={{
                          background: isSaved ? '#F6FEF9' : isSaving ? '#EFF8FF' : ''
                        }}>
                          <td style={{ fontFamily:'DM Mono,monospace', fontSize:13 }}>{date}</td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{dayName}</td>
                          <td>
                            <span className="badge" style={{
                              background: cfg?.bg, color: cfg?.color,
                              border: `1px solid ${cfg?.border}`
                            }}>
                              {status}
                            </span>
                          </td>
                          <td>
                            <select
                              value={lateSlab}
                              onChange={e => updateDay(date, 'late_slab', parseFloat(e.target.value))}
                              style={{ width:260, height:32, fontSize:12,
                                borderColor: isSaved ? '#A9EFC5' : '' }}
                            >
                              {SLAB_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              value={remark}
                              onChange={e => updateDay(date, 'remark', e.target.value)}
                              placeholder="Add remark..."
                              style={{ width:'100%', minWidth:180 }}
                            />
                          </td>
                          <td style={{ textAlign:'center' }}>
                            {isSaving && (
                              <span style={{ fontSize:11, color:'#2E90FA' }}>Saving...</span>
                            )}
                            {isSaved && !isSaving && (
                              <span style={{ fontSize:13, color:'#12B76A', fontWeight:700 }}>✓ Saved</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  {days.filter(({ date }) => {
                    const s = calData[date]?.status
                    return s === 'P' || s === 'PL' || s === 'P:P'
                  }).length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign:'center',
                        padding:24, color:'var(--text-muted)', fontSize:13 }}>
                        No present days recorded yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </Layout>
  )
}

const thStyle = (align = 'right') => ({
  padding:'10px 16px', fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase',
  letterSpacing:'0.06em', borderBottom:'1px solid var(--border)', textAlign:align, background:'var(--bg)',
  whiteSpace:'nowrap',
})
