import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Clock, Plus, Pencil, Archive, Trash2, RotateCcw, ChevronRight } from 'lucide-react'

const TABS = [
  { key: 'rates', label: '💱 Cotizaciones' },
  { key: 'categories', label: '📂 Categorías' },
  { key: 'persons', label: '👤 Personas' },
  { key: 'account', label: '🔒 Cuenta' },
]

// ─── Reusable CRUD List ─────────────────────────────────────────
function CrudList({ items, onAdd, onRename, onArchive, onRestore, onDelete, entityName, showParent, parentLabel }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [reassignTo, setReassignTo] = useState(null)

  const active = items.filter(i => !i.archived)
  const archived = items.filter(i => i.archived)

  const handleAdd = () => {
    if (!newName.trim()) return
    onAdd(newName.trim())
    setNewName('')
    setAdding(false)
  }

  const handleRename = () => {
    if (!editName.trim() || !editId) return
    onRename(editId, editName.trim())
    setEditId(null)
    setEditName('')
  }

  const handleDelete = (item) => {
    if (item.txCount > 0) {
      setDeleteConfirm(item)
      setReassignTo(null)
    } else {
      onDelete(item.id, null)
    }
  }

  const confirmReassignDelete = () => {
    if (!deleteConfirm || !reassignTo) return
    onDelete(deleteConfirm.id, reassignTo)
    setDeleteConfirm(null)
    setReassignTo(null)
  }

  const inputStyle = {
    padding: '7px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0,
  }
  const btnSm = (color = 'var(--text-dim)') => ({
    background: 'none', border: 'none', cursor: 'pointer', padding: 4, color, display: 'flex', alignItems: 'center',
  })

  return (
    <div>
      {/* Active items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {active.map(item => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--radius-sm)', transition: 'background 0.1s' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} style={inputStyle} autoFocus />
                <button onClick={handleRename} style={{ ...btnSm('var(--color-income)'), fontWeight: 600, fontSize: 12 }}>✓</button>
                <button onClick={() => setEditId(null)} style={{ ...btnSm(), fontSize: 12 }}>✕</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.icon ? `${item.icon} ` : ''}{item.name}</div>
                  {showParent && item.parentName && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.parentName}</div>}
                </div>
                {item.txCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{item.txCount} tx</span>}
                <button onClick={() => { setEditId(item.id); setEditName(item.name) }} style={btnSm()} title="Renombrar"><Pencil size={13} /></button>
                <button onClick={() => onArchive(item.id)} style={btnSm('var(--color-expense-light)')} title="Archivar"><Archive size={13} /></button>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Add new */}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '4px 8px' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAdd()} placeholder={`Nuevo ${entityName}...`} style={inputStyle} autoFocus />
          <button onClick={handleAdd} style={{ ...btnSm('var(--color-income)'), fontWeight: 600, fontSize: 12 }}>✓</button>
          <button onClick={() => { setAdding(false); setNewName('') }} style={{ ...btnSm(), fontSize: 12 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 8px', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
          <Plus size={13} /> Agregar {entityName}
        </button>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Archivados ({archived.length})</div>
          {archived.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', opacity: 0.6 }}>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{item.name}</div>
              <button onClick={() => onRestore(item.id)} style={btnSm('var(--color-income)')} title="Restaurar"><RotateCcw size={13} /></button>
              <button onClick={() => handleDelete(item)} style={btnSm('var(--color-expense-light)')} title="Eliminar"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Reassign modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 24, maxWidth: 400, width: '100%', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>Reasignar y eliminar</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
              <strong>"{deleteConfirm.name}"</strong> tiene <strong>{deleteConfirm.txCount}</strong> transacciones. Elegí a dónde reasignarlas antes de eliminar:
            </div>
            <select value={reassignTo || ''} onChange={e => setReassignTo(e.target.value)} style={{ ...inputStyle, width: '100%', marginBottom: 16 }}>
              <option value="">Seleccionar destino...</option>
              {active.filter(i => i.id !== deleteConfirm.id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={confirmReassignDelete} disabled={!reassignTo} style={{ padding: '8px 16px', background: reassignTo ? 'var(--color-expense)' : 'var(--bg-tertiary)', border: 'none', borderRadius: 'var(--radius-sm)', color: reassignTo ? '#fff' : 'var(--text-dim)', fontSize: 13, fontWeight: 600, cursor: reassignTo ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>Reasignar y eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Categories Tab ─────────────────────────────────────────
function CategoriesTab({ user }) {
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [txCounts, setTxCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [catType, setCatType] = useState('expense')

  const loadAll = async () => {
    setLoading(true)
    const [catR, subR, conR] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('subcategories').select('*').order('name'),
      supabase.from('concepts').select('*').order('name'),
    ])
    setCategories(catR.data || [])
    setSubcategories(subR.data || [])
    setConcepts(conR.data || [])

    // Count transactions per entity
    const { data: txData } = await supabase.from('transactions').select('category_id, subcategory_id, concept_id')
    const counts = {}
    ;(txData || []).forEach(t => {
      if (t.category_id) counts[`cat_${t.category_id}`] = (counts[`cat_${t.category_id}`] || 0) + 1
      if (t.subcategory_id) counts[`sub_${t.subcategory_id}`] = (counts[`sub_${t.subcategory_id}`] || 0) + 1
      if (t.concept_id) counts[`con_${t.concept_id}`] = (counts[`con_${t.concept_id}`] || 0) + 1
    })
    setTxCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const filteredCats = categories.filter(c => c.type === catType)
  const filteredSubs = selectedCat ? subcategories.filter(s => s.category_id === selectedCat) : []
  const filteredCons = selectedSub ? concepts.filter(c => c.subcategory_id === selectedSub) : []

  // CRUD handlers for categories
  const addCat = async (name) => {
    await supabase.from('categories').insert({ name, type: catType, user_id: user.id })
    loadAll()
  }
  const renameCat = async (id, name) => { await supabase.from('categories').update({ name }).eq('id', id); loadAll() }
  const archiveCat = async (id) => { await supabase.from('categories').update({ archived: true }).eq('id', id); loadAll() }
  const restoreCat = async (id) => { await supabase.from('categories').update({ archived: false }).eq('id', id); loadAll() }
  const deleteCat = async (id, reassignId) => {
    if (reassignId) {
      await supabase.from('transactions').update({ category_id: reassignId }).eq('category_id', id)
      // Move subcategories to new category
      await supabase.from('subcategories').update({ category_id: reassignId }).eq('category_id', id)
    }
    // Delete concepts under this cat's subcategories, then subcategories, then category
    const subIds = subcategories.filter(s => s.category_id === id).map(s => s.id)
    if (subIds.length && !reassignId) {
      await supabase.from('concepts').delete().in('subcategory_id', subIds)
      await supabase.from('subcategories').delete().eq('category_id', id)
    }
    await supabase.from('categories').delete().eq('id', id)
    setSelectedCat(null); setSelectedSub(null); loadAll()
  }

  // CRUD for subcategories
  const addSub = async (name) => {
    await supabase.from('subcategories').insert({ name, category_id: selectedCat, user_id: user.id })
    loadAll()
  }
  const renameSub = async (id, name) => { await supabase.from('subcategories').update({ name }).eq('id', id); loadAll() }
  const archiveSub = async (id) => { await supabase.from('subcategories').update({ archived: true }).eq('id', id); loadAll() }
  const restoreSub = async (id) => { await supabase.from('subcategories').update({ archived: false }).eq('id', id); loadAll() }
  const deleteSub = async (id, reassignId) => {
    if (reassignId) {
      await supabase.from('transactions').update({ subcategory_id: reassignId }).eq('subcategory_id', id)
      await supabase.from('concepts').update({ subcategory_id: reassignId }).eq('subcategory_id', id)
    }
    const conIds = concepts.filter(c => c.subcategory_id === id).map(c => c.id)
    if (conIds.length && !reassignId) await supabase.from('concepts').delete().in('id', conIds)
    await supabase.from('subcategories').delete().eq('id', id)
    setSelectedSub(null); loadAll()
  }

  // CRUD for concepts
  const addCon = async (name) => {
    await supabase.from('concepts').insert({ name, subcategory_id: selectedSub, user_id: user.id })
    loadAll()
  }
  const renameCon = async (id, name) => { await supabase.from('concepts').update({ name }).eq('id', id); loadAll() }
  const archiveCon = async (id) => { await supabase.from('concepts').update({ archived: true }).eq('id', id); loadAll() }
  const restoreCon = async (id) => { await supabase.from('concepts').update({ archived: false }).eq('id', id); loadAll() }
  const deleteCon = async (id, reassignId) => {
    if (reassignId) await supabase.from('transactions').update({ concept_id: reassignId }).eq('concept_id', id)
    await supabase.from('concepts').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  const catItems = filteredCats.map(c => ({ ...c, txCount: txCounts[`cat_${c.id}`] || 0 }))
  const subItems = filteredSubs.map(s => ({ ...s, txCount: txCounts[`sub_${s.id}`] || 0, parentName: categories.find(c => c.id === s.category_id)?.name }))
  const conItems = filteredCons.map(c => ({ ...c, txCount: txCounts[`con_${c.id}`] || 0, parentName: subcategories.find(s => s.id === c.subcategory_id)?.name }))

  const selectedCatName = categories.find(c => c.id === selectedCat)?.name
  const selectedSubName = subcategories.find(s => s.id === selectedSub)?.name

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }

  return (
    <div>
      {/* Type toggle */}
      <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)', marginBottom: 16, width: 'fit-content' }}>
        {[{ k: 'expense', l: 'Gastos' }, { k: 'income', l: 'Ingresos' }].map(t => (
          <button key={t.k} onClick={() => { setCatType(t.k); setSelectedCat(null); setSelectedSub(null) }} style={{
            padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: catType === t.k ? 'var(--color-accent)' : 'transparent',
            color: catType === t.k ? '#fff' : 'var(--text-muted)',
            fontSize: 13, fontWeight: catType === t.k ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
          }}>{t.l}</button>
        ))}
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span onClick={() => { setSelectedCat(null); setSelectedSub(null) }} style={{ cursor: 'pointer', color: !selectedCat ? 'var(--text-primary)' : 'var(--color-accent)', fontWeight: !selectedCat ? 600 : 400 }}>Categorías</span>
        {selectedCat && <><ChevronRight size={12} /><span onClick={() => setSelectedSub(null)} style={{ cursor: 'pointer', color: !selectedSub ? 'var(--text-primary)' : 'var(--color-accent)', fontWeight: !selectedSub ? 600 : 400 }}>{selectedCatName}</span></>}
        {selectedSub && <><ChevronRight size={12} /><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedSubName}</span></>}
      </div>

      <div style={cardStyle}>
        {!selectedCat ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Categorías de {catType === 'expense' ? 'Gastos' : 'Ingresos'}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {catItems.filter(c => !c.archived).map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedCat(c.id)}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.icon ? `${c.icon} ` : ''}{c.name}</div>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{c.txCount} tx</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                </div>
              ))}
            </div>
            <CrudList items={catItems} onAdd={addCat} onRename={renameCat} onArchive={archiveCat} onRestore={restoreCat} onDelete={deleteCat} entityName="categoría" />
          </>
        ) : !selectedSub ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Subcategorías de {selectedCatName}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {subItems.filter(s => !s.archived).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => setSelectedSub(s.id)}>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</div>
                  <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{s.txCount} tx</span>
                  <ChevronRight size={14} style={{ color: 'var(--text-dim)' }} />
                </div>
              ))}
            </div>
            <CrudList items={subItems} onAdd={addSub} onRename={renameSub} onArchive={archiveSub} onRestore={restoreSub} onDelete={deleteSub} entityName="subcategoría" />
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Conceptos de {selectedSubName}</div>
            <CrudList items={conItems} onAdd={addCon} onRename={renameCon} onArchive={archiveCon} onRestore={restoreCon} onDelete={deleteCon} entityName="concepto" />
          </>
        )}
      </div>
    </div>
  )
}

// ─── Persons Tab ─────────────────────────────────────────
function PersonsTab({ user }) {
  const [persons, setPersons] = useState([])
  const [txCounts, setTxCounts] = useState({})
  const [loading, setLoading] = useState(true)

  const loadAll = async () => {
    setLoading(true)
    const { data } = await supabase.from('persons').select('*').order('name')
    setPersons(data || [])
    const { data: txData } = await supabase.from('transactions').select('person_id')
    const counts = {}
    ;(txData || []).forEach(t => { if (t.person_id) counts[t.person_id] = (counts[t.person_id] || 0) + 1 })
    setTxCounts(counts)
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const add = async (name) => { await supabase.from('persons').insert({ name, user_id: user.id }); loadAll() }
  const rename = async (id, name) => { await supabase.from('persons').update({ name }).eq('id', id); loadAll() }
  const archive = async (id) => { await supabase.from('persons').update({ archived: true }).eq('id', id); loadAll() }
  const restore = async (id) => { await supabase.from('persons').update({ archived: false }).eq('id', id); loadAll() }
  const del = async (id, reassignId) => {
    if (reassignId) await supabase.from('transactions').update({ person_id: reassignId }).eq('person_id', id)
    await supabase.from('persons').delete().eq('id', id)
    loadAll()
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  const items = persons.map(p => ({ ...p, txCount: txCounts[p.id] || 0 }))

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Personas</div>
      <CrudList items={items} onAdd={add} onRename={rename} onArchive={archive} onRestore={restore} onDelete={del} entityName="persona" />
    </div>
  )
}

// ─── Rates Tab ─────────────────────────────────────────
function RatesTab() {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [latestRate, setLatestRate] = useState(null)
  const [latestRateDate, setLatestRateDate] = useState(null)
  const [ratesCount, setRatesCount] = useState(0)

  async function loadStats() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const { count: pending } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).lte('date', today).is('exchange_rate', null)
    setPendingCount(pending || 0)
    const { data: rateData } = await supabase.from('exchange_rates').select('rate, date').order('date', { ascending: false }).limit(1).single()
    if (rateData) { setLatestRate(rateData.rate); setLatestRateDate(rateData.date) }
    const { count: rc } = await supabase.from('exchange_rates').select('*', { count: 'exact', head: true })
    setRatesCount(rc || 0)
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])

  async function runUpdate() {
    setUpdating(true); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://uujhejfkbdjgerbbqwtv.supabase.co/functions/v1/update-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.success) { setResult({ type: 'success', data }); await loadStats() }
      else setResult({ type: 'error', msg: data.error || 'Error desconocido' })
    } catch (e) { setResult({ type: 'error', msg: e.message }) }
    setUpdating(false)
  }

  const fmtDate = (d) => { if (!d) return '–'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }
  const statStyle = { fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }
  const labelStyle = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Última cotización</div>
          <div style={{ ...statStyle, color: 'var(--color-income)' }}>{latestRate ? `$${latestRate.toLocaleString('es-AR')}` : '–'}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{latestRateDate ? fmtDate(latestRateDate) : 'Sin datos'}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Registros pendientes</div>
          <div style={{ ...statStyle, color: pendingCount > 0 ? 'var(--color-expense)' : 'var(--text-dim)' }}>{pendingCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{pendingCount > 0 ? 'Sin cotización asignada' : 'Todo actualizado'}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Cotizaciones guardadas</div>
          <div style={{ ...statStyle, color: 'var(--color-savings)' }}>{ratesCount}</div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Días con cotización en DB</div>
        </div>
      </div>

      <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Actualizar cotizaciones</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Consulta la API del dólar MEP, guarda la cotización de hoy y actualiza todos los registros pendientes.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={runUpdate} disabled={updating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1, fontFamily: 'inherit' }}>
            {updating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}
            {updating ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}><Clock size={13} /><span>Automático: todos los días a las 20:00 ARG</span></div>
        </div>
        {result && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10, ...(result.type === 'success' ? { background: 'var(--color-income-bg)', border: '1px solid var(--color-income-border)' } : { background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)' }) }}>
            {result.type === 'success' ? <CheckCircle size={16} style={{ color: 'var(--color-income)', flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={16} style={{ color: 'var(--color-expense)', flexShrink: 0, marginTop: 2 }} />}
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {result.type === 'success' ? (
                <><div style={{ fontWeight: 600, color: 'var(--color-income)' }}>Actualización exitosa</div><div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Cotización hoy: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>${result.data.today_rate?.toLocaleString('es-AR')}</strong> · Registros actualizados: <strong>{result.data.transactions_updated}</strong> de {result.data.pending_found} pendientes</div></>
              ) : (
                <><div style={{ fontWeight: 600, color: 'var(--color-expense)' }}>Error</div><div style={{ color: 'var(--text-secondary)' }}>{result.msg}</div></>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Account Tab ─────────────────────────────────────────
function AccountTab({ user }) {
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const handleChange = async () => {
    setResult(null)
    if (newPass.length < 6) { setResult({ type: 'error', msg: 'La contraseña debe tener al menos 6 caracteres' }); return }
    if (newPass !== confirmPass) { setResult({ type: 'error', msg: 'Las contraseñas no coinciden' }); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    if (error) setResult({ type: 'error', msg: error.message })
    else { setResult({ type: 'success', msg: 'Contraseña actualizada correctamente' }); setNewPass(''); setConfirmPass('') }
    setLoading(false)
  }

  const inputStyle = { width: '100%', maxWidth: 320, padding: '9px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        Conectado como <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong>
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Cambiar contraseña</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input type="password" placeholder="Nueva contraseña" value={newPass} onChange={e => setNewPass(e.target.value)} style={inputStyle} />
        <input type="password" placeholder="Confirmar contraseña" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inputStyle} />
      </div>
      <button onClick={handleChange} disabled={loading || !newPass || !confirmPass} style={{ padding: '9px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: (loading || !newPass || !confirmPass) ? 0.5 : 1, fontFamily: 'inherit' }}>
        {loading ? 'Guardando...' : 'Cambiar contraseña'}
      </button>
      {result && (
        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 13, ...(result.type === 'success' ? { background: 'var(--color-income-bg)', border: '1px solid var(--color-income-border)', color: 'var(--color-income)' } : { background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', color: 'var(--color-expense-light)' }) }}>
          {result.msg}
        </div>
      )}
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────
export default function Configuracion() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('rates')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 16 }}>Configuración</h1>
        <div style={{ display: 'flex', gap: 0, overflow: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
              padding: '10px 18px', border: 'none', borderBottom: `2px solid ${activeTab === t.key ? 'var(--color-accent)' : 'transparent'}`,
              background: 'transparent', color: activeTab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: 13, fontWeight: activeTab === t.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}>{t.label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {activeTab === 'rates' && <RatesTab />}
        {activeTab === 'categories' && <CategoriesTab user={user} />}
        {activeTab === 'persons' && <PersonsTab user={user} />}
        {activeTab === 'account' && <AccountTab user={user} />}
      </div>
    </div>
  )
}
