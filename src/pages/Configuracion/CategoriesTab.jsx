import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAllTransactions } from '../../lib/fetchAll'
import { ChevronRight } from 'lucide-react'
import CrudList from './CrudList'
import WizardModal from './WizardModal'

export default function CategoriesTab({ user }) {
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
      const txData = await fetchAllTransactions(user.id, { select: 'category_id, subcategory_id, concept_id' })
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
    } catch { showCrudError('Error al eliminar la categoría.') }
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
    const { error: e1 } = await supabase.from('subcategories').update({ category_id: newCatId }).eq('id', id)
    if (e1) { showCrudError('Error al mover la subcategoría.'); return }
    const { error: e2 } = await supabase.from('transactions').update({ category_id: newCatId }).eq('subcategory_id', id).eq('user_id', user.id)
    if (e2) { showCrudError('Error al migrar transacciones de la subcategoría.'); return }
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
    } catch { showCrudError('Error al eliminar la subcategoría.') }
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
    const { error: e1 } = await supabase.from('concepts').update({ subcategory_id: newSubId }).eq('id', id)
    if (e1) { showCrudError('Error al mover el concepto.'); return }
    const targetSub = subcategories.find(s => s.id === newSubId)
    const newCatId = targetSub?.category_id
    const { error: e2 } = await supabase.from('transactions').update({ subcategory_id: newSubId, category_id: newCatId }).eq('concept_id', id).eq('user_id', user.id)
    if (e2) { showCrudError('Error al migrar transacciones del concepto.'); return }
    loadAll()
  }
  const deleteCon = async (id, reassignId) => {
    try {
      if (reassignId) await supabase.from('transactions').update({ concept_id: reassignId }).eq('concept_id', id)
      await supabase.from('concepts').delete().eq('id', id); loadAll()
    } catch { showCrudError('Error al eliminar el concepto.') }
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
