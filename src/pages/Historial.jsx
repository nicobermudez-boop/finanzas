import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getExchangeRate } from '../lib/exchangeRate'
import { useAuth } from '../context/AuthContext'
import { Loader2, Pencil, Trash2, Download, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import useIsMobile from '../hooks/useIsMobile'
import { fetchAllTransactions } from '../lib/fetchAll'
import { fmt } from '../lib/format'

const INCOME_CONCEPTS = ['Sueldo', 'Bono', 'Rentas', 'Otros']

const PAGE_SIZE = 25

function fmtDate(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function Historial() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [persons, setPersons] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [toast, setToast] = useState(null)
  const [tab, setTab] = useState('expense')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [colFilters, setColFilters] = useState({
    date: '', amount: '', category: '', subcategory: '', concept: '', description: '', person: '', fxRate: '',
  })
  const setFilter = (key, val) => { setColFilters(prev => ({ ...prev, [key]: val })); setPage(0) }

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [txData, catRes, subRes, conRes, persRes] = await Promise.all([
        fetchAllTransactions(user.id, { orderCol: 'created_at', orderAsc: false }),
        supabase.from('categories').select('*'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
        supabase.from('persons').select('*').eq('archived', false).order('name'),
      ])
      setTransactions(txData)
      setCategories(catRes.data || [])
      setSubcategories(subRes.data || [])
      setConcepts(conRes.data || [])
      setPersons(persRes.data || [])
    } catch (e) {
      console.error('Error loading historial:', e)
      setLoadError('No se pudo cargar el historial. Revisá tu conexión e intentá de nuevo.')
    }
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])

  const filtered = useMemo(() => {
    let data = transactions.filter(t => t.type === tab)
    const cf = colFilters

    if (cf.date) data = data.filter(t => (t.date || '').includes(cf.date))
    if (cf.amount) data = data.filter(t => String(t.amount || '').includes(cf.amount))
    if (cf.category) data = data.filter(t => {
      const name = catMap[t.category_id]?.name || t.income_concept || ''
      return name === cf.category
    })
    if (cf.subcategory) data = data.filter(t => {
      const name = subMap[t.subcategory_id]?.name || t.income_subtype || ''
      return name === cf.subcategory
    })
    if (cf.concept) data = data.filter(t => {
      const name = conMap[t.concept_id]?.name || ''
      return name === cf.concept
    })
    if (cf.description) data = data.filter(t => (t.description || '').toLowerCase().includes(cf.description.toLowerCase()))
    if (cf.person) data = data.filter(t => (t.person || '') === cf.person)
    if (cf.fxRate) data = data.filter(t => String(t.exchange_rate || '').includes(cf.fxRate))

    return data
  }, [transactions, tab, colFilters, catMap, subMap, conMap])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = useMemo(() =>
    filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  )

  // Reset page and filters on tab change
  useEffect(() => { setPage(0); setColFilters({ date: '', amount: '', category: '', subcategory: '', concept: '', description: '', person: '', fxRate: '' }) }, [tab])

  // Unique values for dropdowns — based on data filtered by OTHER filters (not own column)
  const uniqueVals = useMemo(() => {
    const data = transactions.filter(t => t.type === tab)
    const cf = colFilters

    const applyOtherFilters = (exclude) => {
      let d = data
      if (exclude !== 'category' && cf.category) d = d.filter(t => (catMap[t.category_id]?.name || t.income_concept || '') === cf.category)
      if (exclude !== 'subcategory' && cf.subcategory) d = d.filter(t => (subMap[t.subcategory_id]?.name || t.income_subtype || '') === cf.subcategory)
      if (exclude !== 'concept' && cf.concept) d = d.filter(t => (conMap[t.concept_id]?.name || '') === cf.concept)
      if (exclude !== 'person' && cf.person) d = d.filter(t => (t.person || '') === cf.person)
      if (cf.date) d = d.filter(t => (t.date || '').includes(cf.date))
      if (cf.amount) d = d.filter(t => String(t.amount || '').includes(cf.amount))
      if (cf.description) d = d.filter(t => (t.description || '').toLowerCase().includes(cf.description.toLowerCase()))
      if (cf.fxRate) d = d.filter(t => String(t.exchange_rate || '').includes(cf.fxRate))
      return d
    }

    const catsData = applyOtherFilters('category')
    const subsData = applyOtherFilters('subcategory')
    const consData = applyOtherFilters('concept')
    const persData = applyOtherFilters('person')

    const cats = [...new Set(catsData.map(t => catMap[t.category_id]?.name || t.income_concept || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const subs = [...new Set(subsData.map(t => subMap[t.subcategory_id]?.name || t.income_subtype || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const cons = [...new Set(consData.map(t => conMap[t.concept_id]?.name || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const pers = [...new Set(persData.map(t => t.person).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    return { cats, subs, cons, pers }
  }, [transactions, tab, colFilters, catMap, subMap, conMap])

  // Edit handlers
  const startEdit = (tx) => {
    setEditingId(tx.id)
    setEditData({
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description || '',
      category_id: tx.category_id || null,
      subcategory_id: tx.subcategory_id || null,
      concept_id: tx.concept_id || null,
      person_id: tx.person_id || null,
      income_concept: tx.income_concept || null,
      income_subtype: tx.income_subtype || null,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const saveEdit = async (id) => {
    setSaving(true)
    const amount = parseFloat(editData.amount)
    const personName = persons.find(p => p.id === editData.person_id)?.name || null

    // Fetch exchange rate for the date and recalculate amount_usd
    let exchange_rate = null
    let amount_usd = null
    try {
      exchange_rate = await getExchangeRate(editData.date)
      if (exchange_rate) {
        amount_usd = editData.currency === 'ARS'
          ? Math.round((amount / exchange_rate) * 100) / 100
          : amount
      }
    } catch (e) {
      console.warn('Failed to fetch exchange rate:', e)
    }

    const updateData = {
      date: editData.date,
      amount,
      currency: editData.currency,
      description: editData.description || null,
      category_id: editData.category_id || null,
      subcategory_id: editData.subcategory_id || null,
      concept_id: editData.concept_id || null,
      person_id: editData.person_id || null,
      person: personName,
      income_concept: editData.income_concept || null,
      income_subtype: editData.income_subtype || null,
      exchange_rate,
      amount_usd,
    }

    const { error } = await supabase
      .from('transactions')
      .update(updateData)
      .eq('id', id)

    if (!error) {
      setTransactions(prev => prev.map(t =>
        t.id === id ? { ...t, ...updateData } : t
      ))
      setEditingId(null)
    } else {
      console.error('Error saving edit:', error)
      setToast({ type: 'error', msg: 'Error al guardar los cambios.' })
      setTimeout(() => setToast(null), 3000)
    }
    setSaving(false)
  }

  const confirmDelete = async (id) => {
    setSaving(true)
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== id))
      setDeletingId(null)
    } else {
      console.error('Error deleting transaction:', error)
      setToast({ type: 'error', msg: 'Error al eliminar la transacción.' })
      setTimeout(() => setToast(null), 3000)
    }
    setSaving(false)
  }

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ['Fecha', 'Tipo', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Concepto', 'Descripcion', 'Medio de Pago', 'Cuotas', 'Cuota N', 'Persona', 'Destino', 'Recurrente', 'Monto USD', 'Cotizacion']
    const rows = filtered.map(t => [
      t.date,
      t.type === 'expense' ? 'Gasto' : 'Ingreso',
      t.amount,
      t.currency,
      catMap[t.category_id]?.name || t.income_concept || '',
      subMap[t.subcategory_id]?.name || t.income_subtype || '',
      conMap[t.concept_id]?.name || '',
      t.description || '',
      t.payment_method || '',
      t.installments || 1,
      t.installment_number || 1,
      t.person || '',
      t.destination || '',
      t.is_recurring ? 'Sí' : 'No',
      t.amount_usd || '',
      t.exchange_rate || '',
    ])

    const csv = [headers, ...rows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `finanzas_${tab}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [filtered, tab, catMap, subMap, conMap])

  const s = {
    cell: { padding: '8px 10px', fontSize: 13, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap' },
    cellMono: { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right' },
    cellMuted: { padding: '8px 10px', fontSize: 12, borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
    editInput: { padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', width: '100%' },
    filterInput: { width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    filterSelect: { width: '100%', padding: '4px 6px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 11, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' },
    iconBtn: () => ({
      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
      color: 'var(--text-muted)', transition: 'color 0.15s',
      display: 'flex', alignItems: 'center',
    }),
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        <span>Cargando...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Error al cargar</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{loadError}</div>
        <button onClick={fetchData} style={{
          padding: '10px 24px', background: 'var(--color-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Reintentar</button>
      </div>
    )
  }

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: isMobile ? '12px 16px 10px' : '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: isMobile ? 'nowrap' : 'wrap', ...(isMobile ? {} : { marginBottom: 16 }) }}>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)', ...(isMobile ? { flex: 1 } : { width: 'fit-content' }) }}>
            <button
              onClick={() => setTab('expense')}
              style={{
                padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: tab === 'expense' ? 'var(--color-expense)' : 'transparent',
                color: tab === 'expense' ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: tab === 'expense' ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                ...(isMobile ? { flex: 1 } : {}),
              }}
            >Gastos ({transactions.filter(t => t.type === 'expense').length})</button>
            <button
              onClick={() => setTab('income')}
              style={{
                padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: tab === 'income' ? 'var(--color-income)' : 'transparent',
                color: tab === 'income' ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: tab === 'income' ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
                ...(isMobile ? { flex: 1 } : {}),
              }}
            >Ingresos ({transactions.filter(t => t.type === 'income').length})</button>
          </div>
          {/* Export button */}
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              whiteSpace: 'nowrap', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Download size={14} /> {isMobile ? 'CSV' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: isMobile ? 'none' : 1, overflow: isMobile ? 'visible' : 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-strong)' }}>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Monto</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categoría</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Subcategoría</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Concepto</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Descripción</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Persona</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>FX Rate</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: 80 }}>Acciones</th>
              </tr>
              {/* Filter row */}
              <tr style={{ position: 'sticky', top: 33, zIndex: 4, background: 'var(--bg-secondary)' }}>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input type="text" value={colFilters.date} onChange={e => setFilter('date', e.target.value)} placeholder="YYYY-MM-DD" style={s.filterInput} />
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input type="text" value={colFilters.amount} onChange={e => setFilter('amount', e.target.value)} placeholder="Monto" style={{ ...s.filterInput, textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <select value={colFilters.category} onChange={e => setFilter('category', e.target.value)} style={s.filterSelect}>
                    <option value="">Todas</option>
                    {uniqueVals.cats.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <select value={colFilters.subcategory} onChange={e => setFilter('subcategory', e.target.value)} style={s.filterSelect}>
                    <option value="">Todas</option>
                    {uniqueVals.subs.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <select value={colFilters.concept} onChange={e => setFilter('concept', e.target.value)} style={s.filterSelect}>
                    <option value="">Todos</option>
                    {uniqueVals.cons.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input type="text" value={colFilters.description} onChange={e => setFilter('description', e.target.value)} placeholder="Buscar..." style={s.filterInput} />
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <select value={colFilters.person} onChange={e => setFilter('person', e.target.value)} style={s.filterSelect}>
                    <option value="">Todas</option>
                    {uniqueVals.pers.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <input type="text" value={colFilters.fxRate} onChange={e => setFilter('fxRate', e.target.value)} placeholder="..." style={{ ...s.filterInput, textAlign: 'right' }} />
                </td>
                <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                  {Object.values(colFilters).some(v => v) && (
                    <button onClick={() => setColFilters({ date: '', amount: '', category: '', subcategory: '', concept: '', description: '', person: '', fxRate: '' })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-expense-light)', fontSize: 11, fontFamily: 'inherit', padding: '2px 6px' }}>
                      Limpiar
                    </button>
                  )}
                </td>
              </tr>
            </thead>
            <tbody>
              {pageData.map(tx => {
                const isEditing = editingId === tx.id
                const isDeleting = deletingId === tx.id
                const catName = catMap[tx.category_id]?.name || tx.income_concept || '–'
                const subName = subMap[tx.subcategory_id]?.name || tx.income_subtype || '–'
                const conName = conMap[tx.concept_id]?.name || '–'

                return (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={s.cell}>
                      {isEditing ? (
                        <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} style={{ ...s.editInput, width: 130 }} />
                      ) : fmtDate(tx.date)}
                    </td>
                    <td style={s.cellMono}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <input type="text" value={editData.amount} onChange={e => setEditData(p => ({ ...p, amount: e.target.value }))} style={{ ...s.editInput, width: 80, textAlign: 'right' }} />
                          <select value={editData.currency} onChange={e => setEditData(p => ({ ...p, currency: e.target.value }))} style={{ ...s.editInput, width: 60 }}>
                            <option value="ARS">ARS</option>
                            <option value="USD">USD</option>
                          </select>
                        </div>
                      ) : (
                        <span style={{ color: tx.type === 'expense' ? 'var(--color-expense-light)' : 'var(--color-income-light)' }}>
                          {fmt(tx.amount, tx.currency)}
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>{tx.currency}</span>
                        </span>
                      )}
                    </td>
                    <td style={s.cellMuted}>
                      {isEditing ? (
                        tx.type === 'expense' ? (
                          <select value={editData.category_id || ''} onChange={e => {
                            const val = e.target.value || null
                            setEditData(p => ({ ...p, category_id: val, subcategory_id: null, concept_id: null }))
                          }} style={s.editInput}>
                            <option value="">–</option>
                            {categories.filter(c => c.type === 'expense' && !c.archived).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        ) : (
                          <select value={editData.income_concept || ''} onChange={e => setEditData(p => ({ ...p, income_concept: e.target.value || null }))} style={s.editInput}>
                            <option value="">–</option>
                            {INCOME_CONCEPTS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
                          </select>
                        )
                      ) : catName}
                    </td>
                    <td style={s.cellMuted}>
                      {isEditing ? (
                        tx.type === 'expense' ? (
                          <select value={editData.subcategory_id || ''} onChange={e => {
                            const val = e.target.value || null
                            setEditData(p => ({ ...p, subcategory_id: val, concept_id: null }))
                          }} style={s.editInput}>
                            <option value="">–</option>
                            {subcategories.filter(sc => sc.category_id === editData.category_id && !sc.archived).map(sc => (
                              <option key={sc.id} value={sc.id}>{sc.name}</option>
                            ))}
                          </select>
                        ) : (
                          <select value={editData.income_subtype || ''} onChange={e => setEditData(p => ({ ...p, income_subtype: e.target.value || null }))} style={s.editInput}>
                            <option value="">–</option>
                            <option value="recurrente">Recurrente</option>
                            <option value="extraordinario">Extraordinario</option>
                          </select>
                        )
                      ) : subName}
                    </td>
                    <td style={s.cellMuted}>
                      {isEditing && tx.type === 'expense' ? (
                        <select value={editData.concept_id || ''} onChange={e => setEditData(p => ({ ...p, concept_id: e.target.value || null }))} style={s.editInput}>
                          <option value="">–</option>
                          {concepts.filter(c => c.subcategory_id === editData.subcategory_id && !c.archived).map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      ) : conName}
                    </td>
                    <td style={s.cell}>
                      {isEditing ? (
                        <input type="text" value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} style={s.editInput} placeholder="Descripción..." />
                      ) : (
                        <span style={{ color: tx.description ? 'var(--text-secondary)' : 'var(--text-dim)' }}>{tx.description || '–'}</span>
                      )}
                    </td>
                    <td style={s.cellMuted}>
                      {isEditing ? (
                        <select value={editData.person_id || ''} onChange={e => setEditData(p => ({ ...p, person_id: e.target.value || null }))} style={s.editInput}>
                          <option value="">–</option>
                          {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      ) : (tx.person || '–')}
                    </td>
                    <td style={s.cellMono}>
                      {tx.exchange_rate ? parseFloat(tx.exchange_rate).toLocaleString('es-AR', { maximumFractionDigits: 2 }) : <span style={{ color: 'var(--text-dim)' }}>–</span>}
                    </td>
                    <td style={{ ...s.cell, textAlign: 'center' }}>
                      {isDeleting ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => confirmDelete(tx.id)} disabled={saving}
                            style={{ ...s.iconBtn(), color: 'var(--color-expense-light)', fontSize: 11, fontFamily: 'inherit', background: 'var(--color-expense-bg)', borderRadius: 4, padding: '2px 8px', border: '1px solid var(--color-expense-border)' }}>
                            Borrar
                          </button>
                          <button onClick={() => setDeletingId(null)}
                            style={{ ...s.iconBtn(), fontSize: 11, fontFamily: 'inherit', padding: '2px 8px' }}>
                            No
                          </button>
                        </div>
                      ) : isEditing ? (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => saveEdit(tx.id)} disabled={saving}
                            style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-income)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <Check size={15} />
                          </button>
                          <button onClick={cancelEdit}
                            style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                          <button onClick={() => startEdit(tx)}
                            style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeletingId(tx.id)}
                            style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>{tab === 'expense' ? '📊' : '💰'}</div>
                    <div style={{ fontSize: 14 }}>
                      {Object.values(colFilters).some(v => v) ? 'No hay resultados con los filtros aplicados' : `No hay ${tab === 'expense' ? 'gastos' : 'ingresos'} registrados`}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          padding: '12px 24px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {filtered.length} registros · Página {page + 1} de {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: page === 0 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: page === 0 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', opacity: page >= totalPages - 1 ? 0.4 : 1, display: 'flex', alignItems: 'center' }}>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>✗ {toast.msg}</div>}
    </div>
  )
}
