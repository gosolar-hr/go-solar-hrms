import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const CATEGORIES = [
  { value:'solar_pv_modules',   label:'Solar PV Modules',   color:'#F97316' },
  { value:'inverter',           label:'Inverter',            color:'#2E90FA' },
  { value:'acdb',               label:'ACDB',                color:'#F04438' },
  { value:'dcdb',               label:'DCDB',                color:'#B42318' },
  { value:'generation_meter',   label:'Generation Meter',    color:'#7F56D9' },
  { value:'net_meter',          label:'Net Meter',           color:'#6941C6' },
  { value:'z_clamp',            label:'Z-Clamp',             color:'#12B76A' },
  { value:'mid_clamp',          label:'Mid-Clamp',           color:'#027A48' },
  { value:'table_structure',    label:'Table Structure',     color:'#667085' },
  { value:'ac_cable',           label:'AC Cable',            color:'#1D4ED8' },
  { value:'dc_cable',           label:'DC Cable',            color:'#1570EF' },
  { value:'apdm_rubber',        label:'APDM Rubber',         color:'#344054' },
  { value:'lightning_arrester', label:'Lightning Arrester',  color:'#F79009' },
  { value:'earthing_rod',       label:'Earthing Rod',        color:'#854D0E' },
  { value:'gi_earthing_strip',  label:'GI Earthing Strip',   color:'#92400E' },
  { value:'earthing_epoxy',     label:'Earthing Epoxy',      color:'#78350F' },
]

const UNITS   = ['pcs','mtr','kg','set','roll','box','ltr','pair']
const MOV_TYPES = [
  { value:'inward',   label:'Stock In',          color:'#12B76A', icon:'↓' },
  { value:'outward',  label:'Issue to Site',     color:'#F04438', icon:'↑' },
  { value:'transfer', label:'Transfer',          color:'#2E90FA', icon:'⇄' },
  { value:'return',   label:'Return to HO',      color:'#F79009', icon:'↩' },
]

const EMPTY_ITEM = { item_name:'', category:'solar_pv_modules', unit:'pcs', reorder_level:'', description:'', opening_stock:'' }
const EMPTY_MOV  = { movement_type:'outward', site_id:'', reference:'', remarks:'', movement_date: new Date().toISOString().split('T')[0] }
const EMPTY_LINE      = { item_id:'', quantity:'' }
const EMPTY_SITE_FORM = {
  client_name:'', site_type:'commercial', address:'', city:'',
  system_size_kw:'', sanctioned_load_kw:'', installation_date:'',
  contact_name:'', contact_phone:'',
  assigned_to_emp_code:'', assigned_to_name:'', notes:'',
}

export default function Inventory() {
  const [items,      setItems]      = useState([])
  const [movements,  setMovements]  = useState([])
  const [sites,      setSites]      = useState([])
  const [employees,  setEmployees]  = useState([])
  const [lowStock,   setLowStock]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [alert,      setAlert]      = useState(null)
  const [activeTab,  setActiveTab]  = useState('stock')
  const [showAddItem, setShowAddItem] = useState(false)
  const [showMovForm, setShowMovForm] = useState(false)
  const [showAddSite, setShowAddSite] = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [itemForm,   setItemForm]   = useState(EMPTY_ITEM)
  const [movForm,    setMovForm]    = useState(EMPTY_MOV)
  const [dispatchLines, setDispatchLines] = useState([{ ...EMPTY_LINE }])
  const [siteForm,   setSiteForm]   = useState(EMPTY_SITE_FORM)
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('all')
  const [editItem,   setEditItem]   = useState(null)
  const [editForm,   setEditForm]   = useState({})

  const load = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/inventory/items').then(r => r.json()),
      fetch('/api/inventory/movements?limit=50').then(r => r.json()),
      fetch('/api/inventory/sites').then(r => r.json()),
      fetch('/api/employees').then(r => r.json()),
    ]).then(([itemsData, movsData, sitesData, empsData]) => {
      const itemsList = Array.isArray(itemsData) ? itemsData : []
      setItems(itemsList)
      setLowStock(itemsList.filter(i => i.is_low))
      setMovements(Array.isArray(movsData) ? movsData : [])
      setSites(Array.isArray(sitesData) ? sitesData : [])
      setEmployees(Array.isArray(empsData) ? empsData : [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const onItemChange = e => setItemForm(f => ({ ...f, [e.target.name]: e.target.value }))
  const onMovChange  = e => setMovForm(f => ({ ...f, [e.target.name]: e.target.value }))

  const saveItem = async () => {
    if (!itemForm.item_name) return setAlert({ type:'error', msg:'Item name is required' })
    setSaving(true)
    const res = await fetch('/api/inventory/items', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ...itemForm, reorder_level: Number(itemForm.reorder_level)||0, opening_stock: Number(itemForm.opening_stock)||0 })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`${data.item_name} added to inventory.` })
    setItemForm(EMPTY_ITEM)
    setShowAddItem(false)
    load()
  }

  const saveEdit = async () => {
    if (!editForm.item_name) return setAlert({ type:'error', msg:'Item name is required' })
    setSaving(true)
    const res = await fetch('/api/inventory/items', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        id           : editItem.id,
        item_name    : editForm.item_name,
        category     : editForm.category,
        unit         : editForm.unit,
        reorder_level: Number(editForm.reorder_level) || 0,
        description  : editForm.description || '',
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`${data.item_name} updated successfully.` })
    setEditItem(null)
    setEditForm({})
    load()
  }

  const saveMovement = async () => {
    const validLines = dispatchLines.filter(l => l.item_id && Number(l.quantity) > 0)
    if (validLines.length === 0) {
      return setAlert({ type:'error', msg:'Add at least one item with a quantity.' })
    }
    if (['outward','transfer','return'].includes(movForm.movement_type) && !movForm.site_id) {
      return setAlert({ type:'error', msg:'Please select a site.' })
    }
    setSaving(true)

    let successCount = 0
    let lastError = null

    for (const line of validLines) {
      let from = null
      let to   = 'HO'

      if (movForm.movement_type === 'inward') {
        from = null; to = 'HO'
      } else if (movForm.movement_type === 'outward') {
        from = 'HO'
        const site = sites.find(s => s.id === movForm.site_id)
        to = site ? site.client_name : 'Site'
      } else if (movForm.movement_type === 'return') {
        const site = sites.find(s => s.id === movForm.site_id)
        from = site ? site.client_name : 'Site'
        to = 'HO'
      } else if (movForm.movement_type === 'transfer') {
        from = 'HO'
        const site = sites.find(s => s.id === movForm.site_id)
        to = site ? site.client_name : 'Site'
      }

      const res = await fetch('/api/inventory/movements', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          item_id       : line.item_id,
          movement_type : movForm.movement_type,
          quantity      : Number(line.quantity),
          from_location : from,
          to_location   : to,
          site_id       : movForm.site_id || null,
          reference     : movForm.reference || null,
          remarks       : movForm.remarks   || null,
          movement_date : movForm.movement_date,
        })
      })
      const data = await res.json()
      if (!res.ok) { lastError = data.error; break }
      successCount++
    }

    setSaving(false)
    if (lastError) return setAlert({ type:'error', msg: `Error on item ${successCount + 1}: ${lastError}` })

    setAlert({ type:'success', msg: `${successCount} item${successCount !== 1 ? 's' : ''} dispatched successfully.` })
    setMovForm(EMPTY_MOV)
    setDispatchLines([{ ...EMPTY_LINE }])
    setShowMovForm(false)
    load()
  }

  const saveSite = async () => {
    if (!siteForm.client_name) return setAlert({ type:'error', msg:'Site/Client name is required' })
    setSaving(true)
    const res = await fetch('/api/inventory/sites', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        ...siteForm,
        system_size_kw    : siteForm.system_size_kw     ? Number(siteForm.system_size_kw)     : null,
        sanctioned_load_kw: siteForm.sanctioned_load_kw ? Number(siteForm.sanctioned_load_kw) : null,
      })
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) return setAlert({ type:'error', msg: data.error })
    setAlert({ type:'success', msg:`Site "${data.client_name}" created. You can now dispatch stock to it.` })
    setSiteForm(EMPTY_SITE_FORM)
    setShowAddSite(false)
    load()
  }

  const onSiteFormChange = e => {
    const { name, value } = e.target
    if (name === 'assigned_to_emp_code') {
      const emp = employees.find(em => em.emp_code === value || em.id === value)
      setSiteForm(f => ({ ...f, assigned_to_emp_code: emp?.emp_code || value, assigned_to_name: emp?.name || '' }))
    } else {
      setSiteForm(f => ({ ...f, [name]: value }))
    }
  }

  const SITE_TYPE_CONFIG = {
    residential : { label:'Residential', color:'#2E90FA' },
    commercial  : { label:'Commercial',  color:'#F79009' },
    industrial  : { label:'Industrial',  color:'#7F56D9' },
  }

  const STATUS_CONFIG = {
    pre_amc  : { label:'Pre-AMC',   color:'#B54708', bg:'#FFFAEB', border:'#FEF0C7' },
    active   : { label:'AMC Active', color:'#027A48', bg:'#ECFDF3', border:'#A9EFC5' },
    inactive : { label:'Inactive',   color:'#667085', bg:'#F8F9FB', border:'#E4E7EC' },
  }

  const getCatConfig = (cat) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[6]
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'}) : '—'

  const filteredItems = items.filter(item => {
    const matchSearch = !search || item.item_name.toLowerCase().includes(search.toLowerCase()) || item.item_code.toLowerCase().includes(search.toLowerCase())
    const matchCat    = catFilter === 'all' || item.category === catFilter
    return matchSearch && matchCat
  })

  // Stats
  const totalItems   = items.length
  const lowCount     = lowStock.length

  const movTypeConf = (type) => MOV_TYPES.find(m => m.value === type) || MOV_TYPES[0]

  return (
    <Layout>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-sub">Material tracking — Head Office & Site level</p>
        </div>
        <div className="flex gap-8 items-center">
          <button className="btn btn-outline" onClick={() => { setShowMovForm(s=>!s); setShowAddItem(false); setShowAddSite(false); setAlert(null) }}>
            ⇄ Material Dispatch
          </button>
          <button className="btn btn-outline" onClick={() => { setShowAddSite(s=>!s); setShowAddItem(false); setShowMovForm(false); setAlert(null) }}>
            📍 Add Site
          </button>
          <button className="btn btn-primary" onClick={() => { setShowAddItem(s=>!s); setShowMovForm(false); setShowAddSite(false); setAlert(null) }}>
            + Add Item
          </button>
        </div>
      </div>

      {alert && <div className={`alert alert-${alert.type}`}>{alert.msg}</div>}

      {/* Low stock alert */}
      {lowCount > 0 && (
        <div className="alert alert-warning" style={{ marginBottom:16 }}>
          ⚠ <strong>{lowCount} item{lowCount!==1?'s':''}</strong> at or below reorder level:{' '}
          {lowStock.map(i => i.item_name).join(', ')}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns:'repeat(4,1fr)', marginBottom:20 }}>
        {[
          { label:'Total Items',    value: totalItems,  color:'var(--accent)', hint:'In catalog' },
          { label:'HO Stock Items', value: items.filter(i=>i.ho_stock>0).length, color:'#12B76A', hint:'In warehouse' },
          { label:'Low Stock',      value: lowCount,    color: lowCount>0?'#F04438':'#12B76A', hint:'Need reorder' },
          { label:'Recent Movements',value: movements.length, color:'#2E90FA', hint:'Last 50' },
        ].map(s => (
          <div key={s.label} className="card stat-card" style={{ borderTop:`3px solid ${s.color}` }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ fontSize:22, color:s.color }}>{s.value}</div>
            <div className="stat-hint">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <div className="card card-pad" style={{ marginBottom:20 }}>
          <div className="card-title" style={{ marginBottom:20 }}>Add New Item to Catalog</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Item Name *</label>
              <input name="item_name" placeholder="e.g. Solar Panel 540W" value={itemForm.item_name} onChange={onItemChange} />
            </div>
            <div className="form-group">
              <label>Category *</label>
              <select name="category" value={itemForm.category} onChange={onItemChange}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select name="unit" value={itemForm.unit} onChange={onItemChange}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Reorder Level</label>
              <input name="reorder_level" type="number" placeholder="Alert when stock falls below" value={itemForm.reorder_level} onChange={onItemChange} />
            </div>
            <div className="form-group">
              <label>Opening Stock (at HO)</label>
              <input name="opening_stock" type="number" placeholder="Current stock count" value={itemForm.opening_stock} onChange={onItemChange} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <input name="description" placeholder="Optional details" value={itemForm.description} onChange={onItemChange} />
            </div>
          </div>
          <div className="divider" />
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={saveItem} disabled={saving}>{saving?'Saving...':'Add Item'}</button>
            <button className="btn btn-outline" onClick={() => setShowAddItem(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Add Site Form */}
      {showAddSite && (
        <div className="card card-pad" style={{ marginBottom:20 }}>
          <div className="card-title" style={{ marginBottom:4 }}>Add New Site / Project</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:20 }}>
            Sites created here are available for stock dispatch immediately. AMC details are added later in the O&M module once the deal is finalised.
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label>Site / Client Name *</label>
              <input name="client_name" placeholder="e.g. Tata Motors Pune Plant" value={siteForm.client_name} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>Site Type</label>
              <select name="site_type" value={siteForm.site_type} onChange={onSiteFormChange}>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
              </select>
            </div>
            <div className="form-group">
              <label>System Size (kW)</label>
              <input name="system_size_kw" type="number" placeholder="e.g. 100" value={siteForm.system_size_kw} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>Sanctioned Load (kW)</label>
              <input name="sanctioned_load_kw" type="number" placeholder="e.g. 120" value={siteForm.sanctioned_load_kw} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>Installation Date</label>
              <input name="installation_date" type="date" value={siteForm.installation_date} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>City</label>
              <input name="city" placeholder="e.g. Pune" value={siteForm.city} onChange={onSiteFormChange} />
            </div>
            <div className="form-group full">
              <label>Address</label>
              <input name="address" placeholder="Full site address" value={siteForm.address} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>Contact Person</label>
              <input name="contact_name" placeholder="Name" value={siteForm.contact_name} onChange={onSiteFormChange} />
            </div>
            <div className="form-group">
              <label>Contact Phone</label>
              <input name="contact_phone" placeholder="9876543210" value={siteForm.contact_phone} onChange={onSiteFormChange} />
            </div>
            <div className="form-group full">
              <label>Assign Technician</label>
              <select name="assigned_to_emp_code" value={siteForm.assigned_to_emp_code} onChange={onSiteFormChange}>
                <option value="">Select employee...</option>
                {employees.filter(e => e.is_active !== false).map(e => (
                  <option key={e.id} value={e.emp_code}>{e.emp_code} — {e.name} ({e.department})</option>
                ))}
              </select>
            </div>
            <div className="form-group full">
              <label>Notes</label>
              <input name="notes" placeholder="Any project notes" value={siteForm.notes} onChange={onSiteFormChange} />
            </div>
          </div>
          <div className="divider" />
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={saveSite} disabled={saving}>{saving?'Saving...':'Create Site'}</button>
            <button className="btn btn-outline" onClick={() => setShowAddSite(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Movement Form */}
      {showMovForm && (
        <div className="card card-pad" style={{ marginBottom:20 }}>
          <div className="card-title" style={{ marginBottom:20 }}>Material Dispatch</div>

          {/* Top row — movement type, site, date, reference */}
          <div className="form-grid" style={{ marginBottom:16 }}>
            <div className="form-group">
              <label>Movement Type *</label>
              <select name="movement_type" value={movForm.movement_type} onChange={onMovChange}>
                {MOV_TYPES.map(m => <option key={m.value} value={m.value}>{m.icon} {m.label}</option>)}
              </select>
            </div>

            {['outward','transfer','return'].includes(movForm.movement_type) && (
              <div className="form-group">
                <label>{movForm.movement_type === 'return' ? 'Return From Site *' : 'Site *'}</label>
                <select name="site_id" value={movForm.site_id} onChange={onMovChange}>
                  <option value="">Select site...</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.client_name}</option>)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Date</label>
              <input name="movement_date" type="date" value={movForm.movement_date} onChange={onMovChange} />
            </div>
            <div className="form-group">
              <label>Reference (PO / Invoice)</label>
              <input name="reference" placeholder="Optional" value={movForm.reference} onChange={onMovChange} />
            </div>
            <div className="form-group full">
              <label>Remarks</label>
              <input name="remarks" placeholder="Any additional notes" value={movForm.remarks} onChange={onMovChange} />
            </div>
          </div>

          {/* Multi-item lines */}
          <div style={{ marginBottom:8 }}>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:10 }}>
              Items to Dispatch
            </div>

            {/* Line header */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 140px 36px',
              gap:8, marginBottom:6, padding:'0 4px' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)' }}>Item</div>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text-muted)' }}>Quantity</div>
              <div/>
            </div>

            {dispatchLines.map((line, idx) => {
              const selItem = items.find(i => i.id === line.item_id)
              return (
                <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 140px 36px',
                  gap:8, marginBottom:8, alignItems:'center' }}>

                  {/* Item select — full list same as Category items */}
                  <select
                    value={line.item_id}
                    onChange={e => {
                      const updated = [...dispatchLines]
                      updated[idx] = { ...updated[idx], item_id: e.target.value }
                      setDispatchLines(updated)
                    }}
                    style={{ width:'100%' }}>
                    <option value="">Select item…</option>
                    {items.map(i => (
                      <option key={i.id} value={i.id}>
                        [{CATEGORIES.find(c=>c.value===i.category)?.label || i.category}] {i.item_name} — HO: {i.ho_stock} {i.unit}
                      </option>
                    ))}
                  </select>

                  {/* Quantity */}
                  <div style={{ position:'relative' }}>
                    <input
                      type="number" min="0.01" step="0.01"
                      placeholder="Qty"
                      value={line.quantity}
                      onChange={e => {
                        const updated = [...dispatchLines]
                        updated[idx] = { ...updated[idx], quantity: e.target.value }
                        setDispatchLines(updated)
                      }}
                      style={{ width:'100%', paddingRight: selItem ? 32 : 10 }}
                    />
                    {selItem && (
                      <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
                        fontSize:10, color:'var(--text-muted)', pointerEvents:'none' }}>
                        {selItem.unit}
                      </span>
                    )}
                  </div>

                  {/* Remove line */}
                  <button
                    onClick={() => setDispatchLines(lines => lines.filter((_, i) => i !== idx))}
                    disabled={dispatchLines.length === 1}
                    style={{ width:32, height:32, display:'flex', alignItems:'center',
                      justifyContent:'center', border:'1px solid #FECDCA', background:'#FEF3F2',
                      borderRadius:6, cursor: dispatchLines.length === 1 ? 'not-allowed' : 'pointer',
                      color:'#B42318', fontSize:16, opacity: dispatchLines.length === 1 ? 0.4 : 1 }}>
                    ×
                  </button>
                </div>
              )
            })}

            {/* Add another item row */}
            <button
              onClick={() => setDispatchLines(lines => [...lines, { ...EMPTY_LINE }])}
              style={{ marginTop:4, fontSize:12, color:'var(--accent)', background:'transparent',
                border:'1px dashed var(--accent)', borderRadius:6, padding:'5px 14px',
                cursor:'pointer', fontWeight:600 }}>
              + Add Another Item
            </button>
          </div>

          {/* Summary */}
          {dispatchLines.some(l => l.item_id && l.quantity) && (
            <div style={{ padding:'10px 14px', background:'#EFF8FF', border:'1px solid #B2DDFF',
              borderRadius:8, marginTop:12, fontSize:13, color:'#1849A9' }}>
              {movForm.movement_type === 'inward'  && `↓ Adding ${dispatchLines.filter(l=>l.item_id&&l.quantity).length} item type(s) to HO stock`}
              {movForm.movement_type === 'outward' && `↑ Issuing ${dispatchLines.filter(l=>l.item_id&&l.quantity).length} item type(s) from HO to site`}
              {movForm.movement_type === 'transfer'&& `⇄ Transferring ${dispatchLines.filter(l=>l.item_id&&l.quantity).length} item type(s)`}
              {movForm.movement_type === 'return'  && `↩ Returning ${dispatchLines.filter(l=>l.item_id&&l.quantity).length} item type(s) from site to HO`}
            </div>
          )}

          <div className="divider" />
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={saveMovement} disabled={saving}>
              {saving ? 'Saving...' : `Dispatch ${dispatchLines.filter(l=>l.item_id&&l.quantity).length || ''} Item${dispatchLines.filter(l=>l.item_id&&l.quantity).length!==1?'s':''}`}
            </button>
            <button className="btn btn-outline" onClick={() => {
              setShowMovForm(false)
              setMovForm(EMPTY_MOV)
              setDispatchLines([{ ...EMPTY_LINE }])
            }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {[
          { key:'stock',     label:`Stock Overview (${items.length})` },
          { key:'movements', label:`Movement History (${movements.length})` },
          { key:'sites',     label:`Sites (${sites.length})` },
          { key:'site_stock',label:'Site-wise Stock' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding:'8px 18px', borderRadius:8, border:'1px solid var(--border)',
            background: activeTab === tab.key ? 'var(--accent)' : '#fff',
            color:      activeTab === tab.key ? '#fff' : 'var(--text-secondary)',
            fontWeight:600, fontSize:13, cursor:'pointer', transition:'all 0.15s',
          }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── STOCK OVERVIEW TAB ── */}
      {activeTab === 'stock' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Item Catalog & HO Stock</span>
            <div className="flex gap-8 items-center">
              <input placeholder="Search item..." value={search}
                onChange={e => setSearch(e.target.value)} style={{ width:180 }} />
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width:150 }}>
                <option value="all">All Categories</option>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="table-wrap">
            {loading ? (
              <div className="empty-state"><p>Loading...</p></div>
            ) : filteredItems.length === 0 ? (
              <div className="empty-state">
                <strong>No items found</strong>
                <p>Add items to the catalog using the "+ Add Item" button.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Item Name</th>
                    <th>Category</th>
                    <th style={{ textAlign:'right' }}>HO Stock</th>
                    <th style={{ textAlign:'right' }}>Reorder Level</th>
                    <th style={{ textAlign:'right' }}>Total (All Locations)</th>
                    <th>Status</th>
                    <th>Unit</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const cat = getCatConfig(item.category)
                    return (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td style={{ fontFamily:'DM Mono,monospace', fontSize:12, color:'var(--text-muted)' }}>
                            {item.item_code}
                          </td>
                          <td style={{ fontWeight:500 }}>
                            {item.item_name}
                            {item.description && (
                              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.description}</div>
                            )}
                          </td>
                          <td>
                            <span style={{
                              background:`${cat.color}18`, color:cat.color,
                              border:`1px solid ${cat.color}35`,
                              padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600,
                            }}>
                              {cat.label}
                            </span>
                          </td>
                          <td style={{ textAlign:'right', fontFamily:'DM Mono,monospace',
                            fontWeight:700, fontSize:14,
                            color: item.is_low ? '#F04438' : item.ho_stock > 0 ? '#101828' : '#98A2B3' }}>
                            {item.ho_stock}
                          </td>
                          <td style={{ textAlign:'right', fontFamily:'DM Mono,monospace',
                            fontSize:13, color:'var(--text-muted)' }}>
                            {item.reorder_level || '—'}
                          </td>
                          <td style={{ textAlign:'right', fontFamily:'DM Mono,monospace', fontSize:13 }}>
                            {item.total_stock}
                          </td>
                          <td>
                            {item.is_low ? (
                              <span style={{ background:'#FEF3F2', color:'#B42318',
                                border:'1px solid #FECDCA', padding:'2px 8px',
                                borderRadius:20, fontSize:11, fontWeight:600 }}>
                                ⚠ Low Stock
                              </span>
                            ) : item.ho_stock > 0 ? (
                              <span style={{ background:'#ECFDF3', color:'#027A48',
                                border:'1px solid #A9EFC5', padding:'2px 8px',
                                borderRadius:20, fontSize:11, fontWeight:600 }}>
                                ✓ In Stock
                              </span>
                            ) : (
                              <span style={{ background:'var(--surface-2)', color:'var(--text-muted)',
                                border:'1px solid var(--border)', padding:'2px 8px',
                                borderRadius:20, fontSize:11, fontWeight:600 }}>
                                Out of Stock
                              </span>
                            )}
                          </td>
                          <td style={{ color:'var(--text-muted)', fontSize:12 }}>{item.unit}</td>
                          <td>
                            <button
                              onClick={() => { setEditItem(item); setEditForm({
                                item_name    : item.item_name,
                                category     : item.category,
                                unit         : item.unit,
                                reorder_level: item.reorder_level || '',
                                description  : item.description  || '',
                              }); setShowAddItem(false); setShowMovForm(false); }}
                              style={{ padding:'4px 12px', fontSize:12, fontWeight:600,
                                borderRadius:6, border:'1px solid var(--border)',
                                background:'#fff', cursor:'pointer', color:'var(--text-primary)' }}>
                              ✏ Edit
                            </button>
                          </td>
                        </tr>
                        {/* Inline edit row */}
                        {editItem?.id === item.id && (
                          <tr>
                            <td colSpan={9} style={{ padding:0, background:'#F8F9FB',
                              borderBottom:'2px solid var(--accent)' }}>
                              <div style={{ padding:'16px 20px' }}>
                                <div style={{ fontWeight:700, fontSize:13, marginBottom:14,
                                  color:'var(--accent)' }}>
                                  Edit Item — {editItem.item_code}
                                </div>
                                <div className="form-grid">
                                  <div className="form-group">
                                    <label>Item Name *</label>
                                    <input name="item_name" value={editForm.item_name}
                                      onChange={e => setEditForm(f => ({ ...f, item_name: e.target.value }))} />
                                  </div>
                                  <div className="form-group">
                                    <label>Category *</label>
                                    <select name="category" value={editForm.category}
                                      onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}>
                                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Unit</label>
                                    <select name="unit" value={editForm.unit}
                                      onChange={e => setEditForm(f => ({ ...f, unit: e.target.value }))}>
                                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                  </div>
                                  <div className="form-group">
                                    <label>Reorder Level</label>
                                    <input name="reorder_level" type="number"
                                      value={editForm.reorder_level}
                                      onChange={e => setEditForm(f => ({ ...f, reorder_level: e.target.value }))} />
                                  </div>
                                  <div className="form-group">
                                    <label>Description</label>
                                    <input name="description" value={editForm.description}
                                      onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                                  </div>
                                </div>
                                <div style={{ marginTop:12, display:'flex', gap:8 }}>
                                  <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                                    {saving ? 'Saving...' : 'Save Changes'}
                                  </button>
                                  <button className="btn btn-outline"
                                    onClick={() => { setEditItem(null); setEditForm({}) }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── MOVEMENTS TAB ── */}
      {activeTab === 'movements' && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Movement History</span>
            <span style={{ fontSize:12, color:'var(--text-muted)' }}>Showing last 50 movements</span>
          </div>
          <div className="table-wrap">
            {movements.length === 0 ? (
              <div className="empty-state">
                <strong>No movements yet</strong>
                <p>Use "Material Dispatch" to log material in/out.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Item</th>
                    <th style={{ textAlign:'right' }}>Qty</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Site</th>
                    <th>Reference</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map(mov => {
                    const mc = movTypeConf(mov.movement_type)
                    return (
                      <tr key={mov.id}>
                        <td style={{ fontFamily:'DM Mono,monospace', fontSize:12 }}>
                          {fmt(mov.movement_date)}
                        </td>
                        <td>
                          <span style={{ background:`${mc.color}15`, color:mc.color,
                            border:`1px solid ${mc.color}30`,
                            padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {mc.icon} {mc.label}
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight:500, fontSize:13 }}>
                            {mov.inventory_items?.item_name || '—'}
                          </div>
                          <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                            {mov.inventory_items?.item_code}
                          </div>
                        </td>
                        <td style={{ textAlign:'right', fontFamily:'DM Mono,monospace',
                          fontWeight:700, color: mov.movement_type==='inward'||mov.movement_type==='return' ? '#12B76A' : '#F04438' }}>
                          {mov.movement_type==='inward'||mov.movement_type==='return' ? '+' : '-'}
                          {mov.quantity} {mov.inventory_items?.unit}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {mov.from_location || '—'}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {mov.to_location || '—'}
                        </td>
                        <td style={{ fontSize:12 }}>
                          {mov.amc_sites?.client_name || '—'}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {mov.reference || '—'}
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-secondary)' }}>
                          {mov.remarks || '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── SITES MASTER TAB ── */}
      {activeTab === 'sites' && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div className="card-header" style={{ padding:'14px 20px' }}>
            <span className="card-title">Site / Project Master</span>
            <button className="btn btn-primary btn-sm"
              onClick={() => { setShowAddSite(true); setActiveTab('stock') }}>
              + Add Site
            </button>
          </div>
          {sites.length === 0 ? (
            <div className="empty-state">
              <strong>No sites yet</strong>
              <p>Add your first site/project using "📍 Add Site" to start dispatching stock.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Site / Client</th>
                    <th>Type</th>
                    <th>Capacity (kW)</th>
                    <th>City</th>
                    <th>Contact</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>AMC Valid Upto</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map(site => {
                    const tc  = SITE_TYPE_CONFIG[site.site_type] || SITE_TYPE_CONFIG.commercial
                    const sc  = STATUS_CONFIG[site.project_status] || STATUS_CONFIG.pre_amc
                    return (
                      <tr key={site.id}>
                        <td>
                          <div style={{ fontWeight:600, fontSize:13 }}>{site.client_name}</div>
                          {site.address && <div style={{ fontSize:11, color:'var(--text-muted)' }}>{site.address}</div>}
                        </td>
                        <td>
                          <span style={{ background:`${tc.color}18`, color:tc.color,
                            border:`1px solid ${tc.color}35`, padding:'2px 8px',
                            borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {tc.label}
                          </span>
                        </td>
                        <td style={{ fontFamily:'DM Mono,monospace', fontSize:13 }}>
                          {site.system_size_kw ? `${site.system_size_kw} kW` : '—'}
                        </td>
                        <td style={{ fontSize:13 }}>{site.city || '—'}</td>
                        <td style={{ fontSize:12 }}>
                          {site.contact_name && <div>{site.contact_name}</div>}
                          {site.contact_phone && <div style={{ color:'var(--text-muted)' }}>{site.contact_phone}</div>}
                          {!site.contact_name && '—'}
                        </td>
                        <td style={{ fontSize:12 }}>{site.assigned_to_name || '—'}</td>
                        <td>
                          <span style={{ background:sc.bg, color:sc.color,
                            border:`1px solid ${sc.border}`, padding:'2px 10px',
                            borderRadius:20, fontSize:11, fontWeight:600 }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ fontSize:12, color:'var(--text-muted)' }}>
                          {site.amc_valid_upto
                            ? new Date(site.amc_valid_upto).toLocaleDateString('en-IN', {day:'2-digit',month:'short',year:'numeric'})
                            : <span style={{ color:'#98A2B3', fontStyle:'italic' }}>Not set (Pre-AMC)</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SITE-WISE STOCK TAB ── */}
      {activeTab === 'site_stock' && (
        <div>
          {(() => {
            // Build site stock map from items
            const siteMap = {}
            items.forEach(item => {
              ;(item.site_stock || []).forEach(ss => {
                if (!siteMap[ss.location]) siteMap[ss.location] = []
                siteMap[ss.location].push({ ...item, site_qty: ss.quantity })
              })
            })

            const siteNames = Object.keys(siteMap)

            if (siteNames.length === 0) {
              return (
                <div className="card">
                  <div className="empty-state">
                    <strong>No site stock yet</strong>
                    <p>Issue material to a site using "Material Dispatch" → "Issue to Site".</p>
                  </div>
                </div>
              )
            }

            return siteNames.map(siteName => (
              <div key={siteName} className="card" style={{ marginBottom:16 }}>
                <div className="card-header">
                  <span className="card-title">📍 {siteName}</span>
                  <span style={{ fontSize:12, color:'var(--text-muted)' }}>
                    {siteMap[siteName].length} item type{siteMap[siteName].length!==1?'s':''}
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th style={{ textAlign:'right' }}>Qty at Site</th>
                        <th>Unit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {siteMap[siteName].map(item => {
                        const cat = getCatConfig(item.category)
                        return (
                          <tr key={item.id}>
                            <td>
                              <div style={{ fontWeight:500 }}>{item.item_name}</div>
                              <div style={{ fontSize:11, color:'var(--text-muted)' }}>{item.item_code}</div>
                            </td>
                            <td>
                              <span style={{ background:`${cat.color}18`, color:cat.color,
                                padding:'2px 8px', borderRadius:20, fontSize:11, fontWeight:600 }}>
                                {cat.label}
                              </span>
                            </td>
                            <td style={{ textAlign:'right', fontFamily:'DM Mono,monospace',
                              fontWeight:700, fontSize:14, color:'#F97316' }}>
                              {item.site_qty}
                            </td>
                            <td style={{ color:'var(--text-muted)', fontSize:12 }}>{item.unit}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          })()}
        </div>
      )}
    </Layout>
  )
}
