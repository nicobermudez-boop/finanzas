import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Clock, Plus, Pencil, ArrowRightLeft, Trash2, ChevronRight, Upload } from 'lucide-react'

const TABS = [
  { key: 'rates', label: '💱 Cotizaciones' },
  { key: 'categories', label: '📂 Categorías' },
  { key: 'persons', label: '👤 Personas' },
  { key: 'import', label: '📥 Importar' },
  { key: 'account', label: '🔒 Cuenta' },
]

// ─── Reusable CRUD List ─────────────────────────────────────────
function CrudList({ items, onAdd, onRename, onMove, onDelete, entityName, onNavigate, moveTargets, moveLabel }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [moveId, setMoveId] = useState(null)
  const [moveTo, setMoveTo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [reassignTo, setReassignTo] = useState('')

  const handleAdd = () => { if (!newName.trim()) return; onAdd(newName.trim()); setNewName(''); setAdding(false) }
  const handleRename = () => { if (!editName.trim() || !editId) return; onRename(editId, editName.trim()); setEditId(null) }
  const handleMove = () => { if (!moveId || !moveTo) return; onMove(moveId, moveTo); setMoveId(null); setMoveTo('') }
  const handleDelete = (item) => {
    if (item.txCount > 0) { setDeleteConfirm(item); setReassignTo('') }
    else { setDeleteConfirm(item); setReassignTo('__none__') }
  }
  const confirmDelete = () => {
    if (!deleteConfirm) return
    onDelete(deleteConfirm.id, reassignTo === '__none__' ? null : reassignTo)
    setDeleteConfirm(null); setReassignTo('')
  }

  const inputS = { padding: '7px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0 }
  const btnSm = (color = 'var(--text-dim)') => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color, display: 'flex', alignItems: 'center' })

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--border-subtle)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {editId === item.id ? (
            <>
              <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditId(null) }} style={inputS} autoFocus />
              <button onClick={handleRename} style={{ ...btnSm('var(--color-income)'), fontSize: 13, fontWeight: 700 }}>✓</button>
              <button onClick={() => setEditId(null)} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
            </>
          ) : moveId === item.id ? (
            <>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Mover <strong>{item.name}</strong> a:</div>
              <select value={moveTo} onChange={e => setMoveTo(e.target.value)} style={{ ...inputS, flex: 'none', minWidth: 150 }}>
                <option value="">{moveLabel || 'Seleccionar...'}</option>
                {(moveTargets || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={handleMove} disabled={!moveTo} style={{ ...btnSm(moveTo ? 'var(--color-income)' : 'var(--text-dim)'), fontSize: 13, fontWeight: 700 }}>✓</button>
              <button onClick={() => { setMoveId(null); setMoveTo('') }} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0, cursor: onNavigate ? 'pointer' : 'default' }} onClick={() => onNavigate && onNavigate(item.id)}>
                <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.icon ? `${item.icon} ` : ''}{item.name}</div>
                {item.parentName && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.parentName}</div>}
              </div>
              {item.txCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{item.txCount} tx</span>}
              <button onClick={() => { setEditId(item.id); setEditName(item.name) }} style={btnSm()} title="Renombrar"><Pencil size={13} /></button>
              {onMove && <button onClick={() => setMoveId(item.id)} style={btnSm()} title="Mover"><ArrowRightLeft size={13} /></button>}
              <button onClick={() => handleDelete(item)} style={btnSm('var(--color-expense-light)')} title="Eliminar"><Trash2 size={13} /></button>
              {onNavigate && <ChevronRight size={14} style={{ color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => onNavigate(item.id)} />}
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '4px 8px' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }} placeholder={`Nuevo ${entityName}...`} style={inputS} autoFocus />
          <button onClick={handleAdd} style={{ ...btnSm('var(--color-income)'), fontSize: 13, fontWeight: 700 }}>✓</button>
          <button onClick={() => { setAdding(false); setNewName('') }} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
          <Plus size={13} /> Agregar {entityName}
        </button>
      )}

      {/* Delete/Reassign modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 24, maxWidth: 420, width: '100%', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              {deleteConfirm.txCount > 0 ? 'Reasignar y eliminar' : 'Confirmar eliminación'}
            </div>
            {deleteConfirm.txCount > 0 ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  <strong>"{deleteConfirm.name}"</strong> tiene <strong>{deleteConfirm.txCount}</strong> transacciones. Elegí a dónde reasignarlas:
                </div>
                <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={{ ...inputS, width: '100%', marginBottom: 16, flex: 'none' }}>
                  <option value="">Seleccionar destino...</option>
                  {items.filter(i => i.id !== deleteConfirm.id).map(i => <option key={i.id} value={i.id}>{i.icon ? `${i.icon} ` : ''}{i.name}</option>)}
                </select>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                ¿Estás seguro de eliminar <strong>"{deleteConfirm.name}"</strong>? Esta acción no se puede deshacer.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirm(null); setReassignTo('') }} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleteConfirm.txCount > 0 && !reassignTo} style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: (deleteConfirm.txCount === 0 || reassignTo) ? 'var(--color-expense)' : 'var(--bg-tertiary)',
                color: (deleteConfirm.txCount === 0 || reassignTo) ? '#fff' : 'var(--text-dim)',
                cursor: (deleteConfirm.txCount === 0 || reassignTo) ? 'pointer' : 'not-allowed',
              }}>{deleteConfirm.txCount > 0 ? 'Reasignar y eliminar' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Creation Wizard ─────────────────────────────────────────
function WizardModal({ wizard, user, onComplete, setWizard }) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setSaving(true)
    if (wizard.step === 'sub') {
      const { data } = await supabase.from('subcategories').insert({ name: name.trim(), category_id: wizard.catId, user_id: user.id }).select().single()
      if (data) { setName(''); setWizard({ step: 'concept', catId: wizard.catId, subId: data.id, catName: wizard.catName, subName: name.trim() }) }
    } else if (wizard.step === 'concept') {
      await supabase.from('concepts').insert({ name: name.trim(), subcategory_id: wizard.subId, user_id: user.id })
      onComplete()
    }
    setSaving(false)
  }

  const inputS = { width: '100%', padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', fontFamily: 'inherit' }
  const stepLabel = wizard.step === 'sub' ? 'Subcategoría' : 'Concepto'
  const breadcrumb = wizard.step === 'sub' ? wizard.catName : `${wizard.catName} › ${wizard.subName}`

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 28, maxWidth: 420, width: '100%', border: '1px solid var(--border-subtle)' }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
          {['Categoría', 'Subcategoría', 'Concepto'].map((s, i) => {
            const stepIdx = wizard.step === 'sub' ? 1 : 2
            return <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: i <= stepIdx ? 'var(--color-accent)' : 'var(--border-subtle)', transition: 'background 0.2s' }} />
          })}
        </div>

        <div style={{ fontSize: 11, color: 'var(--text-dim)', marginBottom: 6 }}>{breadcrumb}</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4, color: 'var(--text-primary)' }}>Crear {stepLabel}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
          {wizard.step === 'sub'
            ? `La categoría "${wizard.catName}" necesita al menos una subcategoría.`
            : `La subcategoría "${wizard.subName}" necesita al menos un concepto.`}
        </div>

        <input value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); if (e.key === 'Escape') onComplete() }}
          placeholder={`Nombre del ${stepLabel.toLowerCase()}...`} style={inputS} autoFocus />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onComplete} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Omitir</button>
          <button onClick={handleSubmit} disabled={!name.trim() || saving} style={{
            padding: '8px 20px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            background: name.trim() ? 'var(--color-accent)' : 'var(--bg-tertiary)', color: name.trim() ? '#fff' : 'var(--text-dim)',
            cursor: name.trim() ? 'pointer' : 'not-allowed',
          }}>{saving ? '...' : wizard.step === 'concept' ? 'Crear y finalizar' : 'Siguiente →'}</button>
        </div>
      </div>
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
  const [loadError, setLoadError] = useState(null)
  const [crudError, setCrudError] = useState(null)
  const [selectedCat, setSelectedCat] = useState(null)
  const [selectedSub, setSelectedSub] = useState(null)
  const [catType, setCatType] = useState('expense')
  // Wizard: { step: 'sub'|'concept', catId, subId, catName, subName }
  const [wizard, setWizard] = useState(null)

  const showCrudError = (msg) => { setCrudError(msg); setTimeout(() => setCrudError(null), 3000) }

  const loadAll = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [catR, subR, conR] = await Promise.all([
        supabase.from('categories').select('*').order('name'),
        supabase.from('subcategories').select('*').order('name'),
        supabase.from('concepts').select('*').order('name'),
      ])
      setCategories(catR.data || [])
      setSubcategories(subR.data || [])
      setConcepts(conR.data || [])
      const { data: txData } = await supabase.from('transactions').select('category_id, subcategory_id, concept_id')
      const counts = {}
      ;(txData || []).forEach(t => {
        if (t.category_id) counts[`cat_${t.category_id}`] = (counts[`cat_${t.category_id}`] || 0) + 1
        if (t.subcategory_id) counts[`sub_${t.subcategory_id}`] = (counts[`sub_${t.subcategory_id}`] || 0) + 1
        if (t.concept_id) counts[`con_${t.concept_id}`] = (counts[`con_${t.concept_id}`] || 0) + 1
      })
      setTxCounts(counts)
    } catch (e) {
      console.error('Error loading categories:', e)
      setLoadError('No se pudieron cargar las categorías. Intentá de nuevo.')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const filteredCats = categories.filter(c => c.type === catType)
  const filteredSubs = selectedCat ? subcategories.filter(s => s.category_id === selectedCat) : []
  const filteredCons = selectedSub ? concepts.filter(c => c.subcategory_id === selectedSub) : []

  // Category CRUD
  const addCat = async (name) => {
    const { data, error } = await supabase.from('categories').insert({ name, type: catType, user_id: user.id }).select().single()
    if (error) { showCrudError('Error al agregar la categoría.'); return }
    await loadAll()
    if (data) setWizard({ step: 'sub', catId: data.id, catName: name })
  }
  const renameCat = async (id, name) => {
    const { error } = await supabase.from('categories').update({ name }).eq('id', id)
    if (error) { showCrudError('Error al renombrar la categoría.'); return }
    loadAll()
  }
  const deleteCat = async (id, reassignId) => {
    try {
      if (reassignId) {
        await supabase.from('transactions').update({ category_id: reassignId }).eq('category_id', id)
        await supabase.from('subcategories').update({ category_id: reassignId }).eq('category_id', id)
      } else {
        const subIds = subcategories.filter(s => s.category_id === id).map(s => s.id)
        if (subIds.length) { await supabase.from('concepts').delete().in('subcategory_id', subIds); await supabase.from('subcategories').delete().eq('category_id', id) }
      }
      await supabase.from('categories').delete().eq('id', id)
      setSelectedCat(null); setSelectedSub(null); loadAll()
    } catch (e) { showCrudError('Error al eliminar la categoría.') }
  }

  // Subcategory CRUD
  const addSub = async (name) => {
    const { data, error } = await supabase.from('subcategories').insert({ name, category_id: selectedCat, user_id: user.id }).select().single()
    if (error) { showCrudError('Error al agregar la subcategoría.'); return }
    await loadAll()
    if (data) setWizard({ step: 'concept', catId: selectedCat, subId: data.id, subName: name, catName: categories.find(c => c.id === selectedCat)?.name })
  }
  const renameSub = async (id, name) => {
    const { error } = await supabase.from('subcategories').update({ name }).eq('id', id)
    if (error) { showCrudError('Error al renombrar la subcategoría.'); return }
    loadAll()
  }
  const moveSub = async (id, newCatId) => {
    const { error } = await supabase.from('subcategories').update({ category_id: newCatId }).eq('id', id)
    if (error) { showCrudError('Error al mover la subcategoría.'); return }
    loadAll()
  }
  const deleteSub = async (id, reassignId) => {
    try {
      if (reassignId) {
        await supabase.from('transactions').update({ subcategory_id: reassignId }).eq('subcategory_id', id)
        await supabase.from('concepts').update({ subcategory_id: reassignId }).eq('subcategory_id', id)
      } else {
        await supabase.from('concepts').delete().eq('subcategory_id', id)
      }
      await supabase.from('subcategories').delete().eq('id', id)
      setSelectedSub(null); loadAll()
    } catch (e) { showCrudError('Error al eliminar la subcategoría.') }
  }

  // Concept CRUD
  const addCon = async (name) => {
    const { error } = await supabase.from('concepts').insert({ name, subcategory_id: selectedSub, user_id: user.id })
    if (error) { showCrudError('Error al agregar el concepto.'); return }
    loadAll()
  }
  const renameCon = async (id, name) => {
    const { error } = await supabase.from('concepts').update({ name }).eq('id', id)
    if (error) { showCrudError('Error al renombrar el concepto.'); return }
    loadAll()
  }
  const moveCon = async (id, newSubId) => {
    const { error } = await supabase.from('concepts').update({ subcategory_id: newSubId }).eq('id', id)
    if (error) { showCrudError('Error al mover el concepto.'); return }
    loadAll()
  }
  const deleteCon = async (id, reassignId) => {
    try {
      if (reassignId) await supabase.from('transactions').update({ concept_id: reassignId }).eq('concept_id', id)
      await supabase.from('concepts').delete().eq('id', id); loadAll()
    } catch (e) { showCrudError('Error al eliminar el concepto.') }
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  if (loadError) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Error al cargar</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{loadError}</div>
      <button onClick={loadAll} style={{ padding: '8px 20px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
    </div>
  )

  const catItems = filteredCats.map(c => ({ ...c, txCount: txCounts[`cat_${c.id}`] || 0 }))
  const subItems = filteredSubs.map(s => ({ ...s, txCount: txCounts[`sub_${s.id}`] || 0, parentName: categories.find(c => c.id === s.category_id)?.name }))
  const conItems = filteredCons.map(c => ({ ...c, txCount: txCounts[`con_${c.id}`] || 0, parentName: subcategories.find(s => s.id === c.subcategory_id)?.name }))

  const selectedCatName = categories.find(c => c.id === selectedCat)?.name
  const selectedSubName = subcategories.find(s => s.id === selectedSub)?.name
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }

  // Move targets
  const catMoveTargets = categories.filter(c => c.type === catType && c.id !== selectedCat).map(c => ({ id: c.id, name: `${c.icon || ''} ${c.name}`.trim() }))
  const subMoveTargets = subcategories.filter(s => s.id !== selectedSub).map(s => ({ id: s.id, name: `${s.name} (${categories.find(c => c.id === s.category_id)?.name || ''})` }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)', marginBottom: 16, width: 'fit-content' }}>
        {[{ k: 'expense', l: 'Gastos' }, { k: 'income', l: 'Ingresos' }].map(t => (
          <button key={t.k} onClick={() => { setCatType(t.k); setSelectedCat(null); setSelectedSub(null) }} style={{ padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none', background: catType === t.k ? 'var(--color-accent)' : 'transparent', color: catType === t.k ? '#fff' : 'var(--text-muted)', fontSize: 13, fontWeight: catType === t.k ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{t.l}</button>
        ))}
      </div>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, fontSize: 12, color: 'var(--text-muted)' }}>
        <span onClick={() => { setSelectedCat(null); setSelectedSub(null) }} style={{ cursor: 'pointer', color: !selectedCat ? 'var(--text-primary)' : 'var(--color-accent)', fontWeight: !selectedCat ? 600 : 400 }}>Categorías</span>
        {selectedCat && <><ChevronRight size={12} /><span onClick={() => setSelectedSub(null)} style={{ cursor: 'pointer', color: !selectedSub ? 'var(--text-primary)' : 'var(--color-accent)', fontWeight: !selectedSub ? 600 : 400 }}>{selectedCatName}</span></>}
        {selectedSub && <><ChevronRight size={12} /><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedSubName}</span></>}
      </div>

      {/* Wizard modal */}
      {wizard && <WizardModal wizard={wizard} user={user} onComplete={async () => { setWizard(null); await loadAll() }} setWizard={setWizard} />}
      {crudError && <div className="toast error">✗ {crudError}</div>}

      <div style={cardStyle}>
        {!selectedCat ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Categorías de {catType === 'expense' ? 'Gastos' : 'Ingresos'}</div>
            <CrudList items={catItems} onAdd={addCat} onRename={renameCat} onDelete={deleteCat} entityName="categoría" onNavigate={id => setSelectedCat(id)} />
          </>
        ) : !selectedSub ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Subcategorías de {selectedCatName}</div>
            <CrudList items={subItems} onAdd={addSub} onRename={renameSub} onMove={moveSub} onDelete={deleteSub} entityName="subcategoría" onNavigate={id => setSelectedSub(id)} moveTargets={catMoveTargets} moveLabel="Mover a categoría..." />
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Conceptos de {selectedSubName}</div>
            <CrudList items={conItems} onAdd={addCon} onRename={renameCon} onMove={moveCon} onDelete={deleteCon} entityName="concepto" moveTargets={subMoveTargets} moveLabel="Mover a subcategoría..." />
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
  const [loadError, setLoadError] = useState(null)
  const [crudError, setCrudError] = useState(null)

  const showCrudError = (msg) => { setCrudError(msg); setTimeout(() => setCrudError(null), 3000) }

  const loadAll = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await supabase.from('persons').select('*').order('name')
      setPersons(data || [])
      const { data: txData } = await supabase.from('transactions').select('person_id')
      const counts = {}
      ;(txData || []).forEach(t => { if (t.person_id) counts[t.person_id] = (counts[t.person_id] || 0) + 1 })
      setTxCounts(counts)
    } catch (e) {
      console.error('Error loading persons:', e)
      setLoadError('No se pudieron cargar las personas. Intentá de nuevo.')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const add = async (name) => {
    const { error } = await supabase.from('persons').insert({ name, user_id: user.id })
    if (error) { showCrudError('Error al agregar la persona.'); return }
    loadAll()
  }
  const rename = async (id, name) => {
    const { error } = await supabase.from('persons').update({ name }).eq('id', id)
    if (error) { showCrudError('Error al renombrar la persona.'); return }
    // Also update the text field in transactions for backward compat
    const person = persons.find(p => p.id === id)
    if (person) await supabase.from('transactions').update({ person: name }).eq('person', person.name)
    loadAll()
  }
  const del = async (id, reassignId) => {
    try {
      if (reassignId) {
        const target = persons.find(p => p.id === reassignId)
        await supabase.from('transactions').update({ person_id: reassignId, person: target?.name }).eq('person_id', id)
      }
      await supabase.from('persons').delete().eq('id', id); loadAll()
    } catch (e) { showCrudError('Error al eliminar la persona.') }
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  if (loadError) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Error al cargar</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{loadError}</div>
      <button onClick={loadAll} style={{ padding: '8px 20px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
    </div>
  )

  const items = persons.map(p => ({ ...p, txCount: txCounts[p.id] || 0 }))

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Personas</div>
      <CrudList items={items} onAdd={add} onRename={rename} onDelete={del} entityName="persona" />
      {crudError && <div className="toast error">✗ {crudError}</div>}
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
  const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }
  const statS = { fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }
  const labelS = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={cardS}><div style={labelS}>Última cotización</div><div style={{ ...statS, color: 'var(--color-income)' }}>{latestRate ? `$${latestRate.toLocaleString('es-AR')}` : '–'}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{latestRateDate ? fmtDate(latestRateDate) : 'Sin datos'}</div></div>
        <div style={cardS}><div style={labelS}>Registros pendientes</div><div style={{ ...statS, color: pendingCount > 0 ? 'var(--color-expense)' : 'var(--text-dim)' }}>{pendingCount}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{pendingCount > 0 ? 'Sin cotización asignada' : 'Todo actualizado'}</div></div>
        <div style={cardS}><div style={labelS}>Cotizaciones guardadas</div><div style={{ ...statS, color: 'var(--color-savings)' }}>{ratesCount}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Días con cotización en DB</div></div>
      </div>
      <div style={{ ...cardS, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Actualizar cotizaciones</div><div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Consulta la API del dólar MEP, guarda la cotización de hoy y actualiza registros pendientes.</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={runUpdate} disabled={updating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1, fontFamily: 'inherit' }}>
            {updating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}{updating ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}><Clock size={13} /><span>Automático: todos los días a las 20:00 ARG</span></div>
        </div>
        {result && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10, ...(result.type === 'success' ? { background: 'var(--color-income-bg)', border: '1px solid var(--color-income-border)' } : { background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)' }) }}>
            {result.type === 'success' ? <CheckCircle size={16} style={{ color: 'var(--color-income)', flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={16} style={{ color: 'var(--color-expense)', flexShrink: 0, marginTop: 2 }} />}
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {result.type === 'success' ? (<><div style={{ fontWeight: 600, color: 'var(--color-income)' }}>Actualización exitosa</div><div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Cotización: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>${result.data.today_rate?.toLocaleString('es-AR')}</strong> · Actualizados: <strong>{result.data.transactions_updated}</strong>/{result.data.pending_found}</div></>) : (<><div style={{ fontWeight: 600, color: 'var(--color-expense)' }}>Error</div><div style={{ color: 'var(--text-secondary)' }}>{result.msg}</div></>)}
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

  const inputS = { width: '100%', maxWidth: 320, padding: '9px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Conectado como <strong style={{ color: 'var(--text-primary)' }}>{user?.email}</strong></div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Cambiar contraseña</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input type="password" placeholder="Nueva contraseña" value={newPass} onChange={e => setNewPass(e.target.value)} style={inputS} />
        <input type="password" placeholder="Confirmar contraseña" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} style={inputS} />
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

// ─── Main ─────────────────────────────────────────
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
        {activeTab === 'import' && <ImportTab user={user} />}
        {activeTab === 'account' && <AccountTab user={user} />}
      </div>
    </div>
  )
}
// ─── Import Tab ─────────────────────────────────────────
function ImportTab({ user }) {
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [rawRows, setRawRows] = useState([])
  const [validations, setValidations] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [persons, setPersons] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [fileName, setFileName] = useState('')

  const EXPECTED_HEADERS = ['Fecha', 'Tipo', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Concepto', 'Descripcion', 'Medio de Pago', 'Cuotas', 'Cuota N', 'Persona', 'Destino', 'Recurrente', 'Monto USD', 'Cotizacion']

  useEffect(() => {
    loadLookups()
  }, [])

  const loadLookups = async () => {
    const [catR, subR, conR, perR, ratesR] = await Promise.all([
      supabase.from('categories').select('id, name, type'),
      supabase.from('subcategories').select('id, name, category_id'),
      supabase.from('concepts').select('id, name, subcategory_id'),
      supabase.from('persons').select('id, name'),
      supabase.from('exchange_rates').select('date, rate'),
    ])
    setCategories(catR.data || [])
    setSubcategories(subR.data || [])
    setConcepts(conR.data || [])
    setPersons(perR.data || [])
    const rateMap = {}
    ;(ratesR.data || []).forEach(r => { rateMap[r.date] = parseFloat(r.rate) })
    setExchangeRates(rateMap)
  }

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim())
    const result = []
    for (const line of lines) {
      const row = []
      let current = '', inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) { row.push(current.trim()); current = '' }
        else current += ch
      }
      row.push(current.trim())
      result.push(row)
    }
    return result
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const tryParse = (text) => {
      const rows = parseCSV(text)
      if (rows.length < 2) { setValidations([{ row: 0, errors: ['El archivo está vacío o solo tiene headers'] }]); setStep('preview'); return }

      const headers = rows[0]
      const headerErrors = []
      EXPECTED_HEADERS.forEach((h, i) => {
        if (!headers[i] || headers[i].toLowerCase() !== h.toLowerCase()) {
          headerErrors.push(`Columna ${i + 1}: esperaba "${h}", encontró "${headers[i] || '(vacío)'}"`)
        }
      })
      if (headerErrors.length > 0) {
        setValidations([{ row: 0, errors: headerErrors }])
        setRawRows([])
        setStep('preview')
        return
      }

      const dataRows = rows.slice(1)
      setRawRows(dataRows)
      validateRows(dataRows)
      setStep('preview')
    }

    // Try UTF-8 first
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      // Check for replacement char (encoding issue)
      if (text.includes('\ufffd') || text.includes('�')) {
        // Retry with Latin1
        const reader2 = new FileReader()
        reader2.onload = (ev2) => tryParse(ev2.target.result)
        reader2.readAsText(file, 'ISO-8859-1')
      } else {
        tryParse(text)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validateRows = (rows) => {
    const vals = []
    rows.forEach((row, idx) => {
      const errors = []
      const warnings = []
      const [fecha, tipo, monto, moneda, cat, sub, con, desc, medioPago, cuotas, cuotaN, persona, destino, recurrente, montoUsd, cotizacion] = row

      const isGasto = tipo === 'Gasto'
      const isIngreso = tipo === 'Ingreso'

      // Required fields - always needed
      if (!fecha) errors.push('Fecha vacía')
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errors.push(`Fecha inválida: "${fecha}" (YYYY-MM-DD)`)

      const isFutureDate = fecha && fecha > new Date().toISOString().slice(0, 10)
      if (isFutureDate) warnings.push('Fecha futura — Cotización y Monto USD se completarán después')

      if (!tipo) errors.push('Tipo vacío')
      else if (!['Gasto', 'Ingreso'].includes(tipo)) errors.push(`Tipo inválido: "${tipo}" (Gasto/Ingreso)`)

      if (!monto) errors.push('Monto vacío')
      else if (isNaN(parseFloat(monto))) errors.push(`Monto no numérico: "${monto}"`)

      if (!moneda) errors.push('Moneda vacía')
      else if (!['ARS', 'USD'].includes(moneda)) errors.push(`Moneda inválida: "${moneda}" (ARS/USD)`)

      // Always required
      if (!cat) errors.push('Categoría vacía')
      if (!sub) errors.push('Subcategoría vacía')
      if (!con) errors.push('Concepto vacío')
      if (!persona) errors.push('Persona vacía')
      if (!recurrente) errors.push('Recurrente vacío')
      else if (!['Sí', 'Si', 'No'].includes(recurrente)) errors.push(`Recurrente inválido: "${recurrente}" (Sí/No)`)

      // Medio de pago, cuotas, cuota N: required for Gasto, optional for Ingreso
      if (isGasto) {
        if (!medioPago) errors.push('Medio de Pago vacío')
        else if (!['Contado', 'Crédito'].includes(medioPago)) errors.push(`Medio de pago inválido: "${medioPago}" (Contado/Crédito)`)
        if (!cuotas) errors.push('Cuotas vacío')
        else if (isNaN(parseInt(cuotas))) errors.push(`Cuotas no numérico: "${cuotas}"`)
        if (!cuotaN) errors.push('Cuota N vacío')
        else if (isNaN(parseInt(cuotaN))) errors.push(`Cuota N no numérico: "${cuotaN}"`)
      } else if (isIngreso) {
        if (medioPago && !['Contado', 'Crédito'].includes(medioPago)) errors.push(`Medio de pago inválido: "${medioPago}" (Contado/Crédito)`)
        if (cuotas && isNaN(parseInt(cuotas))) errors.push(`Cuotas no numérico: "${cuotas}"`)
        if (cuotaN && isNaN(parseInt(cuotaN))) errors.push(`Cuota N no numérico: "${cuotaN}"`)
      }

      // USD fields: required for past dates, optional for future
      if (!montoUsd) { if (!isFutureDate) errors.push('Monto USD vacío') }
      else if (isNaN(parseFloat(montoUsd))) errors.push(`Monto USD no numérico: "${montoUsd}"`)

      if (!cotizacion) { if (!isFutureDate) errors.push('Cotización vacía') }
      else if (isNaN(parseFloat(cotizacion))) errors.push(`Cotización no numérico: "${cotizacion}"`)
      else if (parseFloat(cotizacion) <= 0) errors.push('Cotización debe ser mayor a 0')

      // Description: warning if empty (not error)
      if (!desc) warnings.push('Descripción vacía — se usará el Concepto')

      // Destino mandatory if category is Viajes
      if (cat && cat.toLowerCase() === 'viajes' && !destino) errors.push('Destino obligatorio para categoría Viajes')

      // Category hierarchy validation
      if (isGasto && cat) {
        const catMatch = categories.find(c => c.name.toLowerCase() === cat.toLowerCase() && c.type === 'expense')
        if (!catMatch) errors.push(`Categoría no encontrada: "${cat}"`)
        else {
          if (sub) {
            const subMatch = subcategories.find(s => s.name.toLowerCase() === sub.toLowerCase() && s.category_id === catMatch.id)
            if (!subMatch) errors.push(`Subcategoría "${sub}" no existe en "${cat}"`)
            else if (con) {
              const conMatch = concepts.find(c => c.name.toLowerCase() === con.toLowerCase() && c.subcategory_id === subMatch.id)
              if (!conMatch) errors.push(`Concepto "${con}" no existe en "${sub}"`)
            }
          }
        }
      }

      if (isIngreso && cat) {
        const catMatch = categories.find(c => c.name.toLowerCase() === cat.toLowerCase() && c.type === 'income')
        if (!catMatch) errors.push(`Categoría de ingreso no encontrada: "${cat}"`)
      }

      // Person validation
      if (persona) {
        const personMatch = persons.find(p => p.name.toLowerCase() === persona.toLowerCase())
        if (!personMatch) errors.push(`Persona no encontrada: "${persona}"`)
      }

      // Cross-validation currency
      const montoNum = parseFloat(monto)
      const usdNum = parseFloat(montoUsd)
      const fxNum = parseFloat(cotizacion)
      const hasNums = !isNaN(montoNum) && !isNaN(usdNum) && !isNaN(fxNum) && fxNum > 0

      if (hasNums && moneda === 'ARS') {
        // ARS / tipo de cambio ≈ monto USD (tolerancia 1 USD)
        const expectedUsd = montoNum / fxNum
        const diff = Math.abs(expectedUsd - usdNum)
        if (diff > 1) errors.push(`ARS ${monto} / ${cotizacion} = ${expectedUsd.toFixed(2)} USD, pero Monto USD es ${montoUsd} — dif: ${diff.toFixed(2)} USD`)
      }

      if (hasNums && moneda === 'USD') {
        // Monto debe ser igual a monto USD
        if (Math.abs(montoNum - usdNum) > 0.01) errors.push(`Moneda USD pero Monto (${monto}) ≠ Monto USD (${montoUsd})`)
      }

      // Warning: exchange rate differs from DB rate for that date (closest available)
      if (fecha && !isNaN(fxNum)) {
        // Find closest rate: exact date, or most recent before that date
        let dbRate = exchangeRates[fecha]
        if (!dbRate) {
          const sorted = Object.keys(exchangeRates).filter(d => d <= fecha).sort().reverse()
          if (sorted.length > 0) dbRate = exchangeRates[sorted[0]]
        }
        if (dbRate && Math.abs(dbRate - fxNum) > 0.01) {
          warnings.push(`Cotización CSV (${fxNum}) difiere de DB (${dbRate}) para fecha ${fecha}`)
        }
      }

      vals.push({ row: idx + 2, errors, warnings, data: row })
    })
    setValidations(vals)
  }

  const errorCount = validations.filter(v => v.errors.length > 0).length
  const warningCount = validations.filter(v => v.warnings?.length > 0 && v.errors.length === 0).length
  const validCount = validations.filter(v => v.errors.length === 0).length

  const doImport = async () => {
    setImporting(true)
    const validRows = validations.filter(v => v.errors.length === 0)
    let inserted = 0, failed = 0

    // Build lookup maps (case-insensitive)
    const catMap = {}; categories.forEach(c => { catMap[`${c.type}_${c.name.toLowerCase()}`] = c.id })
    const subMap = {}; subcategories.forEach(s => { subMap[s.name.toLowerCase() + '_' + s.category_id] = s.id })
    const conMap = {}; concepts.forEach(c => { conMap[c.name.toLowerCase() + '_' + c.subcategory_id] = c.id })
    const perMap = {}; persons.forEach(p => { perMap[p.name.toLowerCase()] = p })

    // Batch in chunks of 50
    const chunks = []
    for (let i = 0; i < validRows.length; i += 50) chunks.push(validRows.slice(i, i + 50))

    for (const chunk of chunks) {
      const records = chunk.map(v => {
        const [fecha, tipo, monto, moneda, cat, sub, con, desc, medioPago, cuotas, cuotaN, persona, destino, recurrente, montoUsd, cotizacion] = v.data
        const isExpense = tipo === 'Gasto'
        const catType = isExpense ? 'expense' : 'income'
        const catId = cat ? catMap[`${catType}_${cat.toLowerCase()}`] || null : null
        const subId = sub && catId ? subMap[sub.toLowerCase() + '_' + catId] || null : null
        const conId = con && subId ? conMap[con.toLowerCase() + '_' + subId] || null : null
        const personObj = persona ? perMap[persona.toLowerCase()] : null

        return {
          user_id: user.id,
          type: isExpense ? 'expense' : 'income',
          date: fecha,
          amount: parseFloat(monto),
          currency: moneda,
          category_id: isExpense ? catId : catId,
          subcategory_id: subId || null,
          concept_id: conId || null,
          income_concept: !isExpense ? (cat || null) : null,
          income_subtype: !isExpense ? (['Sí', 'Si'].includes(recurrente) ? 'recurrente' : 'extraordinario') : null,
          description: desc || con || null,
          payment_method: isExpense ? (medioPago || null) : null,
          installments: parseInt(cuotas) || 1,
          installment_number: parseInt(cuotaN) || 1,
          person: persona || null,
          person_id: personObj?.id || null,
          destination: destino || null,
          is_recurring: ['Sí', 'Si'].includes(recurrente),
          exchange_rate: cotizacion ? parseFloat(cotizacion) : null,
          amount_usd: montoUsd ? parseFloat(montoUsd) : null,
        }
      })

      const { error } = await supabase.from('transactions').insert(records)
      if (error) {
        console.error('Batch error:', error)
        // Try one by one to identify which records fail
        for (const rec of records) {
          const { error: singleErr } = await supabase.from('transactions').insert(rec)
          if (singleErr) { console.error('Row error:', singleErr, rec); failed++ }
          else inserted++
        }
      }
      else inserted += chunk.length
    }

    setImportResult({ inserted, failed, total: validRows.length })
    setStep('done')
    setImporting(false)
  }

  const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }
  const btnS = (active) => ({ padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: active ? 'var(--color-accent)' : 'var(--bg-tertiary)', color: active ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed', fontFamily: 'inherit' })

  // ── Upload step
  if (step === 'upload') {
    return (
      <div>
        <div style={cardS}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Importar transacciones desde CSV</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            El archivo debe tener el mismo formato que el export de Historial, con estas 16 columnas:<br />
            <code style={{ fontSize: 11, color: 'var(--color-accent)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 6 }}>
              Fecha, Tipo, Monto, Moneda, Categoría, Subcategoría, Concepto, Descripción, Medio de Pago, Cuotas, Cuota N°, Persona, Destino, Recurrente, Monto USD, Cotización
            </code>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
            <strong>Valores válidos:</strong><br />
            Fecha: YYYY-MM-DD · Tipo: Gasto/Ingreso · Moneda: ARS/USD · Medio de Pago: Contado/Crédito · Recurrente: Sí/No
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <Upload size={16} /> Seleccionar archivo CSV
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    )
  }

  // ── Preview step
  if (step === 'preview') {
    const headerError = validations.length === 1 && validations[0].row === 0
    return (
      <div>
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Preview: {fileName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {headerError ? '' : <>{rawRows.length} filas · <span style={{ color: 'var(--color-income)' }}>{validCount} válidas</span>{warningCount > 0 && <> · <span style={{ color: '#e6a817' }}>{warningCount} con advertencias</span></>}{errorCount > 0 && <> · <span style={{ color: 'var(--color-expense)' }}>{errorCount} con errores</span></>}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep('upload'); setRawRows([]); setValidations([]) }} style={btnS(true)}>← Volver</button>
              {!headerError && validCount > 0 && (
                <button onClick={doImport} style={btnS(true)}>
                  Importar {validCount} registros{errorCount > 0 ? ` (omitir ${errorCount} con error)` : ''}
                </button>
              )}
            </div>
          </div>

          {/* Header errors */}
          {headerError && (
            <div style={{ padding: 16, background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-expense)', marginBottom: 8, fontSize: 14 }}>Headers incorrectos</div>
              {validations[0].errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--color-expense-light)', marginBottom: 4 }}>{e}</div>)}
            </div>
          )}

          {/* Error summary */}
          {!headerError && errorCount > 0 && (
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-expense)', marginBottom: 8, fontSize: 13 }}>Errores ({errorCount}) — estas filas no se importarán</div>
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {validations.filter(v => v.errors.length > 0).map(v => (
                  <div key={v.row} style={{ fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>Fila {v.row}:</span>{' '}
                    {v.errors.map((e, i) => <span key={i} style={{ color: 'var(--color-expense-light)' }}>{e}{i < v.errors.length - 1 ? ' · ' : ''}</span>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warnings summary */}
          {!headerError && warningCount > 0 && (
            <div style={{ marginBottom: 16, padding: 14, background: 'rgba(230,168,23,0.08)', border: '1px solid rgba(230,168,23,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: '#e6a817', marginBottom: 8, fontSize: 13 }}>Advertencias ({warningCount}) — se importarán igualmente</div>
              <div style={{ maxHeight: 150, overflow: 'auto' }}>
                {validations.filter(v => v.warnings?.length > 0 && v.errors.length === 0).map(v => (
                  <div key={v.row} style={{ fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>Fila {v.row}:</span>{' '}
                    {v.warnings.map((w, i) => <span key={i} style={{ color: '#b8860b' }}>{w}{i < v.warnings.length - 1 ? ' · ' : ''}</span>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data preview table */}
          {!headerError && (
            <div style={{ overflow: 'auto', maxHeight: 400, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>#</th>
                    {EXPECTED_HEADERS.slice(0, 8).map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {validations.slice(0, 100).map(v => {
                    const hasErr = v.errors.length > 0
                    return (
                      <tr key={v.row} style={{ background: hasErr ? 'var(--color-expense-bg)' : 'transparent' }}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>{v.row}</td>
                        {(v.data || []).slice(0, 8).map((cell, i) => (
                          <td key={i} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
                        ))}
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                          {hasErr ? <span style={{ color: 'var(--color-expense)' }} title={v.errors.join('\n')}>✕</span> : v.warnings?.length > 0 ? <span style={{ color: '#e6a817' }} title={v.warnings.join('\n')}>⚠</span> : <span style={{ color: 'var(--color-income)' }}>✓</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {validations.length > 100 && <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>Mostrando 100 de {validations.length} filas...</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Done step
  if (step === 'done') {
    return (
      <div>
        <div style={cardS}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={48} style={{ color: 'var(--color-income)', marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Importación completa</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
              <strong style={{ color: 'var(--color-income)' }}>{importResult?.inserted}</strong> registros importados correctamente
            </div>
            {importResult?.failed > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-expense)' }}>{importResult.failed} fallaron al insertar</div>
            )}
            <button onClick={() => { setStep('upload'); setRawRows([]); setValidations([]); setImportResult(null) }} style={{ ...btnS(true), marginTop: 20 }}>Importar otro archivo</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
