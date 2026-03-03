import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Loader2, Pencil, Trash2, Download, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'

const PAGE_SIZE = 25

function fmt(value, currency) {
  if (!value) return '–'
  const n = Number(value)
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
  }
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d) {
  if (!d) return '–'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

export default function Historial() {
  const { user } = useAuth()
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('expense')
  const [page, setPage] = useState(0)
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({})
  const [deletingId, setDeletingId] = useState(null)
  const [saving, setSaving] = useState(false)

  // Fetch all data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [txRes, catRes, subRes, conRes] = await Promise.all([
        supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
      ])
      setTransactions(txRes.data || [])
      setCategories(catRes.data || [])
      setSubcategories(subRes.data || [])
      setConcepts(conRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [user])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])

  const filtered = useMemo(() =>
    transactions.filter(t => t.type === tab),
    [transactions, tab]
  )

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData = useMemo(() =>
    filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page]
  )

  // Reset page on tab change
  useEffect(() => setPage(0), [tab])

  // Edit handlers
  const startEdit = (tx) => {
    setEditingId(tx.id)
    setEditData({
      date: tx.date,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description || '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditData({})
  }

  const saveEdit = async (id) => {
    setSaving(true)
    const { error } = await supabase
      .from('transactions')
      .update({
        date: editData.date,
        amount: parseFloat(editData.amount),
        currency: editData.currency,
        description: editData.description || null,
      })
      .eq('id', id)

    if (!error) {
      setTransactions(prev => prev.map(t =>
        t.id === id ? { ...t, ...editData, amount: parseFloat(editData.amount) } : t
      ))
      setEditingId(null)
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
    }
    setSaving(false)
  }

  // CSV Export
  const exportCSV = useCallback(() => {
    const headers = ['Fecha', 'Tipo', 'Monto', 'Moneda', 'Categoría', 'Subcategoría', 'Concepto', 'Descripción', 'Medio de Pago', 'Cuotas', 'Cuota N°', 'Persona', 'Destino', 'Recurrente', 'Monto USD', 'Cotización']
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
    iconBtn: (color) => ({
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Historial</h1>
          <button
            onClick={exportCSV}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 14px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)', background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
          >
            <Download size={14} /> Exportar CSV
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)', width: 'fit-content' }}>
          <button
            onClick={() => setTab('expense')}
            style={{
              padding: '6px 16px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: tab === 'expense' ? 'var(--color-expense)' : 'transparent',
              color: tab === 'expense' ? '#fff' : 'var(--text-muted)',
              fontSize: 12, fontWeight: tab === 'expense' ? 600 : 400,
              cursor: 'pointer', fontFamily: 'inherit',
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
            }}
          >Ingresos ({transactions.filter(t => t.type === 'income').length})</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {pageData.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>{tab === 'expense' ? '📊' : '💰'}</div>
            <div style={{ fontSize: 15 }}>No hay {tab === 'expense' ? 'gastos' : 'ingresos'} registrados</div>
          </div>
        ) : (
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
                    <td style={s.cellMuted}>{catName}</td>
                    <td style={s.cellMuted}>{subName}</td>
                    <td style={s.cellMuted}>{conName}</td>
                    <td style={s.cell}>
                      {isEditing ? (
                        <input type="text" value={editData.description} onChange={e => setEditData(p => ({ ...p, description: e.target.value }))} style={s.editInput} placeholder="Descripción..." />
                      ) : (
                        <span style={{ color: tx.description ? 'var(--text-secondary)' : 'var(--text-dim)' }}>{tx.description || '–'}</span>
                      )}
                    </td>
                    <td style={s.cellMuted}>{tx.person || '–'}</td>
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
            </tbody>
          </table>
        )}
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
    </div>
  )
}
