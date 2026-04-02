import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { supabase } from '../lib/supabase'
import { getExchangeRate } from '../lib/exchangeRate'
import { useAuth } from '../context/AuthContext'
import { Pencil, Trash2, Download, Check, X, ChevronLeft, ChevronRight, ChevronDown, ListChecks } from 'lucide-react'
import { SkeletonTable } from '../components/Skeleton'
import useIsMobile from '../hooks/useIsMobile'
import { fetchAllTransactions } from '../lib/fetchAll'
import { fmt } from '../lib/format'

const PAGE_SIZE = 25
const INCOME_CONCEPTS = ['Sueldo', 'Bono', 'Rentas', 'Otros']

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
  const [tab, setTab] = usePersistedState('finanzas-filter-historial-tab', 'expense')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [bulkMode, setBulkMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkData, setBulkData] = useState({})
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [colFilters, setColFilters] = useState({
    date: '', amount: '', category: '', subcategory: '', concept: '', description: '', person: '', fxRate: '',
  })
  const setFilter = (key, val) => { setColFilters(prev => ({ ...prev, [key]: val })); setPage(0) }
  const [sortBy, setSortBy] = usePersistedState('finanzas-historial-sort', 'date')
  const [collapsedGroups, setCollapsedGroups] = useState(new Set())

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

  // Concepts that belong to income categories (for the inline edit dropdown)
  const incomeConcepts = useMemo(() => {
    const incomeCatIds = new Set(categories.filter(c => c.type === 'income').map(c => c.id))
    const incomeSubIds = new Set(subcategories.filter(s => incomeCatIds.has(s.category_id)).map(s => s.id))
    return concepts.filter(c => incomeSubIds.has(c.subcategory_id))
  }, [categories, subcategories, concepts])

  const filtered = useMemo(() => {
    let data = transactions.filter(t => t.type === tab)
    const cf = colFilters

    if (cf.date) data = data.filter(t => (t.date || '').includes(cf.date))
    if (cf.amount) data = data.filter(t => String(t.amount || '').includes(cf.amount))
    if (cf.category) data = data.filter(t => (catMap[t.category_id]?.name || '') === cf.category)
    if (cf.subcategory) data = data.filter(t => {
      const name = t.type === 'income' ? (conMap[t.concept_id]?.name || t.income_concept || '') : (subMap[t.subcategory_id]?.name || '')
      return name === cf.subcategory
    })
    if (cf.concept) data = data.filter(t => {
      const name = t.type === 'income' ? (t.income_subtype || '') : (conMap[t.concept_id]?.name || '')
      return name === cf.concept
    })
    if (cf.description) data = data.filter(t => (t.description || '').toLowerCase().includes(cf.description.toLowerCase()))
    if (cf.person) data = data.filter(t => (t.person || '') === cf.person)
    if (cf.fxRate) data = data.filter(t => String(t.exchange_rate || '').includes(cf.fxRate))

    if (sortBy === 'date') {
      data = [...data].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0))
    }
    // sortBy === 'created_at': already sorted from fetch

    return data
  }, [transactions, tab, colFilters, catMap, subMap, conMap, sortBy])

  // Group installment transactions (cuotas) visually
  const displayRows = useMemo(() => {
    const groupMap = {}
    for (const tx of filtered) {
      if (tx.installment_group_id) {
        if (!groupMap[tx.installment_group_id]) groupMap[tx.installment_group_id] = []
        groupMap[tx.installment_group_id].push(tx)
      }
    }
    for (const gid in groupMap) {
      groupMap[gid].sort((a, b) => (a.installment_number || 0) - (b.installment_number || 0))
    }
    const rows = []
    const seen = new Set()
    for (const tx of filtered) {
      if (tx.installment_group_id) {
        if (!seen.has(tx.installment_group_id)) {
          seen.add(tx.installment_group_id)
          rows.push({ type: 'group', groupId: tx.installment_group_id, txs: groupMap[tx.installment_group_id] })
        }
      } else {
        rows.push({ type: 'single', tx })
      }
    }
    return rows
  }, [filtered])

  const totalPages = Math.ceil(displayRows.length / PAGE_SIZE)
  const pageData = useMemo(() =>
    displayRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [displayRows, page]
  )

  // Reset page and filters on tab change
  useEffect(() => { setPage(0); setColFilters({ date: '', amount: '', category: '', subcategory: '', concept: '', description: '', person: '', fxRate: '' }); setBulkMode(false); setSelectedIds(new Set()); setBulkData({}) }, [tab])

  // Unique values for dropdowns — based on data filtered by OTHER filters (not own column)
  const uniqueVals = useMemo(() => {
    const data = transactions.filter(t => t.type === tab)
    const cf = colFilters

    const applyOtherFilters = (exclude) => {
      let d = data
      if (exclude !== 'category' && cf.category) d = d.filter(t => (catMap[t.category_id]?.name || '') === cf.category)
      if (exclude !== 'subcategory' && cf.subcategory) d = d.filter(t => {
        const name = t.type === 'income' ? (conMap[t.concept_id]?.name || t.income_concept || '') : (subMap[t.subcategory_id]?.name || '')
        return name === cf.subcategory
      })
      if (exclude !== 'concept' && cf.concept) d = d.filter(t => {
        const name = t.type === 'income' ? (t.income_subtype || '') : (conMap[t.concept_id]?.name || '')
        return name === cf.concept
      })
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

    const cats = [...new Set(catsData.map(t => catMap[t.category_id]?.name || '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const subs = [...new Set(subsData.map(t => t.type === 'income' ? (conMap[t.concept_id]?.name || t.income_concept || '') : (subMap[t.subcategory_id]?.name || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const cons = [...new Set(consData.map(t => t.type === 'income' ? (t.income_subtype || '') : (conMap[t.concept_id]?.name || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    const pers = [...new Set(persData.map(t => t.person).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'))
    return { cats, subs, cons, pers }
  }, [transactions, tab, colFilters, catMap, subMap, conMap])

  // Bulk mode helpers
  const toggleBulkMode = () => {
    if (bulkMode) { setSelectedIds(new Set()); setBulkData({}) }
    setBulkMode(prev => !prev)
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    const allIds = filtered.map(t => t.id)
    const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))
    setSelectedIds(allSelected ? new Set() : new Set(allIds))
  }

  const toggleGroup = (groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })
  }

  const toggleSelectGroup = (groupId, txs) => {
    const ids = txs.map(t => t.id)
    const allSelected = ids.every(id => selectedIds.has(id))
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) ids.forEach(id => next.delete(id))
      else ids.forEach(id => next.add(id))
      return next
    })
  }

  const setBulkField = (key, value) => {
    setBulkData(prev => {
      const next = { ...prev }
      if (value === '' || value === null || value === undefined) delete next[key]
      else next[key] = value
      return next
    })
  }

  const setBulkCategory = (catId) => {
    setBulkData(prev => {
      const next = { ...prev }
      if (catId) next.category_id = catId; else delete next.category_id
      delete next.subcategory_id; delete next.concept_id
      return next
    })
  }

  const setBulkSubcategory = (subId) => {
    setBulkData(prev => {
      const next = { ...prev }
      if (subId) next.subcategory_id = subId; else delete next.subcategory_id
      delete next.concept_id
      return next
    })
  }

  const bulkSubcats = useMemo(() => {
    if (!bulkData.category_id) return []
    return subcategories.filter(sc => sc.category_id === bulkData.category_id && !sc.archived)
  }, [bulkData.category_id, subcategories])

  const bulkConcepts = useMemo(() => {
    if (!bulkData.subcategory_id) return []
    return concepts.filter(c => c.subcategory_id === bulkData.subcategory_id && !c.archived)
  }, [bulkData.subcategory_id, concepts])

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
      income_subtype: tx.income_subtype || null,
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const saveEdit = async (id) => {
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
      throw error
    }
  }

  const confirmDelete = async (id) => {
    const { error } = await supabase
      .from('transactions')
      .delete()
      .eq('id', id)

    if (!error) {
      setTransactions(prev => prev.filter(t => t.id !== id))
    } else {
      console.error('Error deleting transaction:', error)
      throw error
    }
  }

  // Confirmation flow
  const fieldLabel = (key) => {
    const labels = { date: 'Fecha', amount: 'Monto', currency: 'Moneda', category_id: 'Categoría', subcategory_id: 'Subcategoría', concept_id: 'Concepto', description: 'Descripción', person_id: 'Persona', income_concept: 'Concepto', income_subtype: 'Tipo' }
    return labels[key] || key
  }

  const resolveValue = (key, val) => {
    if (!val) return '–'
    if (key === 'category_id') return catMap[val]?.name || '–'
    if (key === 'subcategory_id') return subMap[val]?.name || '–'
    if (key === 'concept_id') return conMap[val]?.name || '–'
    if (key === 'person_id') return persons.find(p => p.id === val)?.name || '–'
    if (key === 'date') return fmtDate(val)
    if (key === 'amount') return fmt(parseFloat(val))
    return String(val)
  }

  const requestSaveEdit = (id) => {
    const original = transactions.find(t => t.id === id)
    const fields = ['date', 'amount', 'currency', 'category_id', 'subcategory_id', 'concept_id', 'description', 'person_id', 'income_concept', 'income_subtype']
    const changes = {}
    for (const f of fields) {
      const oldVal = original[f] ?? ''
      const newVal = editData[f] ?? ''
      if (String(oldVal) !== String(newVal)) {
        changes[f] = { from: resolveValue(f, oldVal), to: resolveValue(f, newVal) }
      }
    }
    if (Object.keys(changes).length === 0) { cancelEdit(); return }
    setConfirmAction({ mode: 'edit', id, changes })
  }

  const requestDelete = (tx) => {
    setConfirmAction({ mode: 'delete', tx })
  }

  const requestBulkEdit = () => {
    const fieldCount = Object.keys(bulkData).length
    if (fieldCount === 0 || selectedIds.size === 0) return
    const fields = {}
    if (bulkData.category_id) fields['Categoría'] = catMap[bulkData.category_id]?.name
    if (bulkData.subcategory_id) fields['Subcategoría'] = subMap[bulkData.subcategory_id]?.name
    if (bulkData.concept_id) fields['Concepto'] = conMap[bulkData.concept_id]?.name
    if (bulkData.description !== undefined) fields['Descripción'] = bulkData.description || '(vacío)'
    if (bulkData.person_id) fields['Persona'] = persons.find(p => p.id === bulkData.person_id)?.name
    if (bulkData.income_concept) fields['Concepto'] = bulkData.income_concept
    if (bulkData.income_subtype) fields['Tipo'] = bulkData.income_subtype
    const ids = [...selectedIds].filter(id => filtered.some(t => t.id === id))
    setConfirmAction({ mode: 'bulk', ids, fields, bulkData: { ...bulkData } })
  }

  const requestBulkDelete = () => {
    if (selectedIds.size === 0) return
    const ids = [...selectedIds].filter(id => filtered.some(t => t.id === id))
    setConfirmAction({ mode: 'bulkDelete', ids })
  }

  const executeBulkEdit = async (ids, data) => {
    const updatePayload = {}
    if (data.category_id) {
      updatePayload.category_id = data.category_id
      if (!data.subcategory_id) updatePayload.subcategory_id = null
      if (!data.concept_id) updatePayload.concept_id = null
    }
    if (data.subcategory_id) {
      updatePayload.subcategory_id = data.subcategory_id
      if (!data.concept_id) updatePayload.concept_id = null
    }
    if (data.concept_id) updatePayload.concept_id = data.concept_id
    if (data.description !== undefined) updatePayload.description = data.description || null
    if (data.person_id) {
      updatePayload.person_id = data.person_id
      updatePayload.person = persons.find(p => p.id === data.person_id)?.name || null
    }
    if (data.income_concept) updatePayload.income_concept = data.income_concept
    if (data.income_subtype) updatePayload.income_subtype = data.income_subtype

    const BATCH = 100
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const { error } = await supabase.from('transactions').update(updatePayload).in('id', batch)
      if (error) throw error
    }
    setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, ...updatePayload } : t))
    setSelectedIds(new Set()); setBulkData({})
  }

  const executeBulkDelete = async (ids) => {
    const BATCH = 100
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const { error } = await supabase.from('transactions').delete().in('id', batch)
      if (error) throw error
    }
    setTransactions(prev => prev.filter(t => !ids.includes(t.id)))
    setSelectedIds(new Set()); setBulkData({})
  }

  const executeConfirm = async () => {
    setConfirming(true)
    try {
      if (confirmAction.mode === 'edit') {
        await saveEdit(confirmAction.id)
      } else if (confirmAction.mode === 'delete') {
        await confirmDelete(confirmAction.tx.id)
      } else if (confirmAction.mode === 'bulk') {
        await executeBulkEdit(confirmAction.ids, confirmAction.bulkData)
      } else if (confirmAction.mode === 'bulkDelete') {
        await executeBulkDelete(confirmAction.ids)
      }
      setConfirmAction(null)
      const successMsgs = { edit: 'Cambios guardados.', delete: 'Transacción eliminada.', bulk: `${confirmAction.ids?.length} transacciones actualizadas.`, bulkDelete: `${confirmAction.ids?.length} transacciones eliminadas.` }
      setToast({ type: confirmAction.mode === 'delete' || confirmAction.mode === 'bulkDelete' ? 'expense' : 'income', msg: successMsgs[confirmAction.mode] })
      setTimeout(() => setToast(null), 3000)
    } catch (e) {
      console.error('Confirmation error:', e)
      setToast({ type: 'error', msg: 'Error al procesar la operación.' })
      setTimeout(() => setToast(null), 3000)
    }
    setConfirming(false)
  }

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ['Fecha', 'Tipo', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Concepto', 'Descripcion', 'Medio de Pago', 'Cuotas', 'Cuota N', 'Persona', 'Destino', 'Recurrente', 'Monto USD', 'Cotizacion']
    const rows = filtered.map(t => [
      t.date,
      t.type === 'expense' ? 'Gasto' : 'Ingreso',
      t.amount,
      t.currency,
      catMap[t.category_id]?.name || '',
      subMap[t.subcategory_id]?.name || '',
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

  if (loading) return <SkeletonTable />

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
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          {/* Bulk + Export buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <button
              onClick={() => setSortBy(s => s === 'date' ? 'created_at' : 'date')}
              title={sortBy === 'date' ? 'Ordenado por fecha de transacción' : 'Ordenado por fecha de carga'}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              {sortBy === 'date' ? 'Fecha tx' : 'Fecha alta'}
            </button>
            <button
              onClick={toggleBulkMode}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                border: `1px solid ${bulkMode ? 'var(--color-accent)' : 'var(--border-subtle)'}`,
                background: bulkMode ? 'var(--color-accent-bg)' : 'var(--bg-tertiary)',
                color: bulkMode ? 'var(--color-accent)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              <ListChecks size={14} /> {isMobile ? '' : (bulkMode ? 'Cancelar' : 'Seleccionar')}
            </button>
            <button
              onClick={exportCSV}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)',
                color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
            >
              <Download size={14} /> {isMobile ? 'CSV' : 'Exportar CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* Bulk edit bar */}
      {bulkMode && selectedIds.size > 0 && (
        <div style={{
          padding: '10px 16px', background: 'var(--color-accent-bg)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent)', marginRight: 4, whiteSpace: 'nowrap' }}>
            {[...selectedIds].filter(id => filtered.some(t => t.id === id)).length} seleccionados
          </span>

          {tab === 'expense' && <>
            <select value={bulkData.category_id || ''} onChange={e => setBulkCategory(e.target.value || null)} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Categoría...</option>
              {categories.filter(c => c.type === 'expense' && !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={bulkData.subcategory_id || ''} onChange={e => setBulkSubcategory(e.target.value || null)} disabled={!bulkData.category_id} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Subcategoría...</option>
              {bulkSubcats.map(sc => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
            </select>
            <select value={bulkData.concept_id || ''} onChange={e => setBulkField('concept_id', e.target.value || null)} disabled={!bulkData.subcategory_id} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Concepto...</option>
              {bulkConcepts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </>}

          {tab === 'income' && <>
            <select value={bulkData.category_id || ''} onChange={e => setBulkCategory(e.target.value || null)} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Categoría...</option>
              {categories.filter(c => c.type === 'income' && !c.archived).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={bulkData.income_concept || ''} onChange={e => setBulkField('income_concept', e.target.value || null)} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Concepto...</option>
              {INCOME_CONCEPTS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
            </select>
            <select value={bulkData.income_subtype || ''} onChange={e => setBulkField('income_subtype', e.target.value || null)} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
              <option value="">Tipo...</option>
              <option value="recurrente">Recurrente</option>
              <option value="extraordinario">Extraordinario</option>
            </select>
          </>}

          <input type="text" value={bulkData.description ?? ''} onChange={e => setBulkField('description', e.target.value)} placeholder="Descripción..." style={{ ...s.filterInput, width: 'auto', minWidth: 100, maxWidth: 160 }} />
          <select value={bulkData.person_id || ''} onChange={e => setBulkField('person_id', e.target.value || null)} style={{ ...s.filterSelect, width: 'auto', minWidth: 100 }}>
            <option value="">Persona...</option>
            {persons.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexShrink: 0 }}>
            <button onClick={requestBulkDelete} style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--color-expense-bg)', color: 'var(--color-expense)',
              border: '1px solid var(--color-expense-border)', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              <Trash2 size={12} style={{ marginRight: 4, verticalAlign: -1 }} />Eliminar
            </button>
            <button onClick={requestBulkEdit} disabled={Object.keys(bulkData).length === 0} style={{
              padding: '5px 14px', borderRadius: 'var(--radius-sm)',
              background: Object.keys(bulkData).length > 0 ? 'var(--color-accent)' : 'var(--bg-tertiary)',
              color: Object.keys(bulkData).length > 0 ? '#fff' : 'var(--text-dim)',
              border: 'none', fontSize: 12, fontWeight: 600,
              cursor: Object.keys(bulkData).length > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}>Aplicar</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--bg-secondary)', borderBottom: '2px solid var(--border-strong)' }}>
                {bulkMode && <th style={{ ...s.cell, width: 36, textAlign: 'center' }}>
                  <input type="checkbox" checked={filtered.length > 0 && filtered.every(t => selectedIds.has(t.id))} onChange={toggleSelectAll} style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                </th>}
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Fecha</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>Monto</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Categoría</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tab === 'income' ? 'Concepto' : 'Subcategoría'}</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{tab === 'income' ? 'Tipo' : 'Concepto'}</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Descripción</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Persona</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right' }}>FX Rate</th>
                <th style={{ ...s.cell, fontWeight: 600, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', width: 80 }}>Acciones</th>
              </tr>
              {/* Filter row */}
              <tr style={{ position: 'sticky', top: 33, zIndex: 4, background: 'var(--bg-secondary)' }}>
                {bulkMode && <td style={{ padding: '4px 6px', borderBottom: '1px solid var(--border-subtle)' }} />}
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
              {pageData.flatMap(item => {
                const renderTxRow = (tx, isChild) => {
                  const isEditing = editingId === tx.id
                  const isDeleteTarget = confirmAction?.mode === 'delete' && confirmAction.tx?.id === tx.id
                  const isRowSelected = bulkMode && selectedIds.has(tx.id)
                  const catName = catMap[tx.category_id]?.name || '–'
                  const subName = tx.type === 'income' ? (conMap[tx.concept_id]?.name || tx.income_concept || '–') : (subMap[tx.subcategory_id]?.name || '–')
                  const conName = tx.type === 'income' ? (tx.income_subtype || '–') : (conMap[tx.concept_id]?.name || '–')
                  const rowBg = isEditing ? 'var(--color-accent-bg)' : isDeleteTarget ? 'var(--color-expense-bg)' : isRowSelected ? 'var(--color-accent-bg)' : 'transparent'
                  const rowShadow = isChild
                    ? (isEditing ? 'inset 3px 0 0 var(--color-accent)' : isDeleteTarget ? 'inset 3px 0 0 var(--color-expense)' : 'inset 3px 0 0 var(--border-subtle)')
                    : (isEditing ? 'inset 3px 0 0 var(--color-accent)' : isDeleteTarget ? 'inset 3px 0 0 var(--color-expense)' : 'none')
                  return (
                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s', background: rowBg, boxShadow: rowShadow }}
                      onMouseEnter={e => { if (!isEditing && !isDeleteTarget && !isRowSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
                    >
                      {bulkMode && <td style={{ ...s.cell, textAlign: 'center', width: 36 }}>
                        <input type="checkbox" checked={selectedIds.has(tx.id)} onChange={() => toggleSelect(tx.id)} style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }} />
                      </td>}
                      <td style={s.cell}>
                        {isEditing ? (
                          <input type="date" value={editData.date} onChange={e => setEditData(p => ({ ...p, date: e.target.value }))} style={{ ...s.editInput, width: 130 }} />
                        ) : isChild ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 20 }}>
                            <span style={{ fontSize: 10, background: 'var(--color-accent-bg)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 5px', color: 'var(--color-accent)', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                              {tx.installment_number}/{tx.installments}
                            </span>
                            {fmtDate(tx.date)}
                          </div>
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
                          <select value={editData.category_id || ''} onChange={e => {
                            const val = e.target.value || null
                            setEditData(p => ({ ...p, category_id: val, subcategory_id: null, concept_id: null }))
                          }} style={s.editInput}>
                            <option value="">–</option>
                            {categories.filter(c => c.type === tab && !c.archived).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
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
                            <select value={editData.concept_id || ''} onChange={e => setEditData(p => ({ ...p, concept_id: e.target.value || null }))} style={s.editInput}>
                              <option value="">–</option>
                              {incomeConcepts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          )
                        ) : subName}
                      </td>
                      <td style={s.cellMuted}>
                        {isEditing ? (
                          tx.type === 'expense' ? (
                            <select value={editData.concept_id || ''} onChange={e => setEditData(p => ({ ...p, concept_id: e.target.value || null }))} style={s.editInput}>
                              <option value="">–</option>
                              {concepts.filter(c => c.subcategory_id === editData.subcategory_id && !c.archived).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          ) : (
                            <select value={editData.income_subtype || ''} onChange={e => setEditData(p => ({ ...p, income_subtype: e.target.value || null }))} style={s.editInput}>
                              <option value="">–</option>
                              <option value="recurrente">Recurrente</option>
                              <option value="extraordinario">Extraordinario</option>
                            </select>
                          )
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
                        {tx.exchange_rate ? parseFloat(tx.exchange_rate).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : <span style={{ color: 'var(--text-dim)' }}>–</span>}
                      </td>
                      <td style={{ ...s.cell, textAlign: 'center' }}>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => requestSaveEdit(tx.id)} disabled={confirming}
                              style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-income)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <Check size={15} />
                            </button>
                            <button onClick={cancelEdit}
                              style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <X size={15} />
                            </button>
                          </div>
                        ) : !bulkMode ? (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            <button onClick={() => startEdit(tx)}
                              style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-accent)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <Pencil size={14} />
                            </button>
                            <button onClick={() => requestDelete(tx)}
                              style={s.iconBtn()} onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  )
                }

                if (item.type === 'single') return [renderTxRow(item.tx, false)]

                // Installment group
                const { groupId, txs } = item
                const isExpanded = !collapsedGroups.has(groupId)
                const firstTx = txs[0]
                const groupAllSelected = bulkMode && txs.every(t => selectedIds.has(t.id))
                const groupPartialSelected = bulkMode && !groupAllSelected && txs.some(t => selectedIds.has(t.id))
                const gCatName = catMap[firstTx.category_id]?.name || '–'
                const gSubName = firstTx.type === 'income' ? (conMap[firstTx.concept_id]?.name || firstTx.income_concept || '–') : (subMap[firstTx.subcategory_id]?.name || '–')
                const gConName = firstTx.type === 'income' ? (firstTx.income_subtype || '–') : (conMap[firstTx.concept_id]?.name || '–')
                const totalInst = firstTx.installments || txs.length
                const groupBg = groupAllSelected ? 'var(--color-accent-bg)' : 'var(--bg-secondary)'

                const groupRow = (
                  <tr key={`group-${groupId}`}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s', background: groupBg, cursor: 'pointer' }}
                    onClick={() => toggleGroup(groupId)}
                    onMouseEnter={e => { if (!groupAllSelected) e.currentTarget.style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = groupBg }}
                  >
                    {bulkMode && <td style={{ ...s.cell, textAlign: 'center', width: 36 }} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={groupAllSelected}
                        ref={el => { if (el) el.indeterminate = groupPartialSelected }}
                        onChange={() => toggleSelectGroup(groupId, txs)}
                        style={{ cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                      />
                    </td>}
                    <td style={s.cell}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </span>
                        {fmtDate(firstTx.date)}
                      </div>
                    </td>
                    <td style={s.cellMono}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <span style={{ color: firstTx.type === 'expense' ? 'var(--color-expense-light)' : 'var(--color-income-light)' }}>
                          {fmt(firstTx.amount, firstTx.currency)}
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', marginLeft: 4 }}>{firstTx.currency}</span>
                        </span>
                        <span style={{ fontSize: 10, background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 4, padding: '1px 5px', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                          {txs.length}/{totalInst} cuotas
                        </span>
                      </div>
                    </td>
                    <td style={s.cellMuted}>{gCatName}</td>
                    <td style={s.cellMuted}>{gSubName}</td>
                    <td style={s.cellMuted}>{gConName}</td>
                    <td style={s.cell}><span style={{ color: firstTx.description ? 'var(--text-secondary)' : 'var(--text-dim)' }}>{firstTx.description || '–'}</span></td>
                    <td style={s.cellMuted}>{firstTx.person || '–'}</td>
                    <td style={s.cellMono}>
                      {firstTx.exchange_rate ? parseFloat(firstTx.exchange_rate).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : <span style={{ color: 'var(--text-dim)' }}>–</span>}
                    </td>
                    <td style={{ ...s.cell, textAlign: 'center' }} />
                  </tr>
                )

                if (!isExpanded) return [groupRow]
                return [groupRow, ...txs.map(tx => renderTxRow(tx, true))]
              })}
              {pageData.length === 0 && (
                <tr>
                  <td colSpan={bulkMode ? 10 : 9} style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
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
            {displayRows.length} registros · Página {page + 1} de {totalPages}
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

      {toast && <div className={`toast ${toast.type}`}>{toast.type === 'error' ? '✗' : '✓'} {toast.msg}</div>}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          animation: 'fadeIn 0.2s ease',
        }} onClick={e => { if (e.target === e.currentTarget && !confirming) setConfirmAction(null) }}>
          <div style={{
            width: '100%', maxWidth: 520, background: 'var(--bg-card)',
            borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
            padding: '20px 20px 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.25s ease',
            maxHeight: '80vh', overflowY: 'auto',
          }}>
            {/* Title */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                {confirmAction.mode === 'edit' && 'Confirmar cambios'}
                {confirmAction.mode === 'bulk' && 'Confirmar edición masiva'}
                {confirmAction.mode === 'delete' && 'Confirmar eliminación'}
                {confirmAction.mode === 'bulkDelete' && 'Confirmar eliminación masiva'}
              </div>
              <button onClick={() => setConfirmAction(null)} disabled={confirming}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>
                ×
              </button>
            </div>

            {/* Inline edit: show before/after */}
            {confirmAction.mode === 'edit' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {Object.entries(confirmAction.changes).map(([field, { from, to }]) => (
                  <div key={field} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                    fontSize: 12,
                  }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-muted)', minWidth: 90 }}>{fieldLabel(field)}</span>
                    <span style={{ color: 'var(--color-expense-light)', textDecoration: 'line-through', flex: 1 }}>{from || '–'}</span>
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>→</span>
                    <span style={{ color: 'var(--color-income-light)', fontWeight: 600, flex: 1, textAlign: 'right' }}>{to || '–'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Bulk edit: show count + fields */}
            {confirmAction.mode === 'bulk' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {confirmAction.ids.length} transacciones serán modificadas
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(confirmAction.fields).map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 12px', fontSize: 12 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Single delete: show tx details */}
            {confirmAction.mode === 'delete' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)',
                  borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {catMap[confirmAction.tx.category_id]?.name || confirmAction.tx.income_concept || '–'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {fmtDate(confirmAction.tx.date)} · {fmt(confirmAction.tx.amount, confirmAction.tx.currency)}
                  </div>
                  {confirmAction.tx.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>{confirmAction.tx.description}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-expense-light)', marginTop: 10 }}>
                  Esta acción no se puede deshacer.
                </div>
              </div>
            )}

            {/* Bulk delete: show count */}
            {confirmAction.mode === 'bulkDelete' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)',
                  borderRadius: 'var(--radius-sm)', padding: '12px 14px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {confirmAction.ids.length} transacciones serán eliminadas
                  </div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-expense-light)', marginTop: 10 }}>
                  Esta acción no se puede deshacer.
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmAction(null)} disabled={confirming} style={{
                flex: 1, padding: '12px', border: '1.5px solid var(--border-default)',
                background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
                cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: confirming ? 0.5 : 1, transition: 'all 0.15s',
              }}>Volver</button>
              <button onClick={executeConfirm} disabled={confirming} style={{
                flex: 2, padding: '12px', border: 'none',
                background: (confirmAction.mode === 'delete' || confirmAction.mode === 'bulkDelete') ? 'var(--color-expense)' : 'var(--color-accent)',
                color: '#fff',
                borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700,
                cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                opacity: confirming ? 0.7 : 1, transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                {confirming
                  ? <><span className="sb-spin sb-spin-white" /> Procesando...</>
                  : (confirmAction.mode === 'delete' || confirmAction.mode === 'bulkDelete') ? 'Eliminar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
