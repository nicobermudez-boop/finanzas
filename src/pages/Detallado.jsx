import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllTransactions } from '../lib/fetchAll'
import CurrencyToggle from '../components/CurrencyToggle'
import { Filter, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { fmt } from '../lib/format'
import { getAmount } from '../lib/currency'

function getMonthColumns(months) {
  const cols = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    cols.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return cols
}

function MonthRangeSelector({ value, onChange }) {
  const options = [3, 6, 12, 24]
  return (
    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
      {options.map(n => (
        <button key={n} onClick={() => onChange(n)} style={{
          padding: '6px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
          background: value === n ? 'var(--bg-active)' : 'transparent',
          color: value === n ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: 12, fontWeight: value === n ? 600 : 400,
          cursor: 'pointer', fontFamily: "'JetBrains Mono', monospace",
        }}>{n}m</button>
      ))}
    </div>
  )
}

function FilterDropdown({ label, value, options, onChange }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      padding: '7px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)', color: value === 'all' ? 'var(--text-muted)' : 'var(--text-primary)',
      fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', outline: 'none', minWidth: 130,
      appearance: 'none', paddingRight: 28,
      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
    }}>
      <option value="all">{label}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

export default function Detallado() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('ARS')
  const [monthRange, setMonthRange] = useState(6)
  const [filterCat, setFilterCat] = useState('all')
  const [filterSubcat, setFilterSubcat] = useState('all')
  const [filterConcept, setFilterConcept] = useState('all')
  const [sortCol, setSortCol] = useState('total')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const now = new Date()
      const fromDate = new Date(now.getFullYear(), now.getMonth() - monthRange + 1, 1)
      const dateStr = fromDate.toISOString().split('T')[0]
      const [txData, catRes, subcatRes, conceptRes] = await Promise.all([
        fetchAllTransactions(null, { select: '*', eq: [['type', 'expense']], gte: [['date', dateStr]], orderCol: 'date', orderAsc: true }),
        supabase.from('categories').select('*').eq('type', 'expense'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
      ])
      setTransactions(txData)
      setCategories(catRes.data || [])
      setSubcategories(subcatRes.data || [])
      setConcepts(conceptRes.data || [])
      setLoading(false)
    })()
  }, [monthRange])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subcatMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conceptMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])
  const monthColumns = useMemo(() => getMonthColumns(monthRange), [monthRange])

  // Filter options (cascading)
  const catOptions = useMemo(() => [...new Set(categories.map(c => c.name))].sort((a, b) => a.localeCompare(b, 'es')), [categories])
  const subcatOptions = useMemo(() => {
    if (filterCat === 'all') return [...new Set(subcategories.map(s => s.name))].sort((a, b) => a.localeCompare(b, 'es'))
    if (filterCat === 'Viajes') {
      const dests = [...new Set(transactions.filter(t => catMap[t.category_id]?.name === 'Viajes' && t.destination).map(t => t.destination))]
      return dests.sort((a, b) => a.localeCompare(b, 'es'))
    }
    const catIds = categories.filter(c => c.name === filterCat).map(c => c.id)
    return [...new Set(subcategories.filter(s => catIds.includes(s.category_id)).map(s => s.name))].sort((a, b) => a.localeCompare(b, 'es'))
  }, [filterCat, categories, subcategories, transactions, catMap])
  const conceptOptions = useMemo(() => {
    let filtered = concepts
    if (filterSubcat !== 'all') {
      if (filterCat === 'Viajes') {
        const usedConceptIds = new Set(
          transactions
            .filter(t => catMap[t.category_id]?.name === 'Viajes' && t.destination === filterSubcat && t.concept_id)
            .map(t => t.concept_id)
        )
        filtered = concepts.filter(c => usedConceptIds.has(c.id))
      } else {
        const subIds = subcategories.filter(s => s.name === filterSubcat).map(s => s.id)
        filtered = concepts.filter(c => subIds.includes(c.subcategory_id))
      }
    } else if (filterCat !== 'all') {
      if (filterCat === 'Viajes') {
        const usedConceptIds = new Set(
          transactions
            .filter(t => catMap[t.category_id]?.name === 'Viajes' && t.concept_id)
            .map(t => t.concept_id)
        )
        filtered = concepts.filter(c => usedConceptIds.has(c.id))
      } else {
        const catIds = categories.filter(c => c.name === filterCat).map(c => c.id)
        const subIds = subcategories.filter(s => catIds.includes(s.category_id)).map(s => s.id)
        filtered = concepts.filter(c => subIds.includes(c.subcategory_id))
      }
    }
    return [...new Set(filtered.map(c => c.name))].sort((a, b) => a.localeCompare(b, 'es'))
  }, [filterCat, filterSubcat, categories, subcategories, concepts, transactions, catMap])

  // Filter change handlers (reset dependent filters)
  const handleFilterCat = (v) => { setFilterCat(v); setFilterSubcat('all'); setFilterConcept('all') }
  const handleFilterSubcat = (v) => { setFilterSubcat(v); setFilterConcept('all') }

  // Determine which hierarchy columns are visible (hide filtered ones)
  const showCatCol = filterCat === 'all'
  const showSubCol = filterSubcat === 'all'
  const showConCol = filterConcept === 'all'


  // Build flat tabular data
  const { rows, totals } = useMemo(() => {
    let filtered = transactions.filter(t => {
      if (filterCat !== 'all') {
        const cat = catMap[t.category_id]
        if (!cat || cat.name !== filterCat) return false
      }
      if (filterSubcat !== 'all') {
        const isViajes = catMap[t.category_id]?.name === 'Viajes'
        if (isViajes) {
          if (t.destination !== filterSubcat) return false
        } else {
          const sub = subcatMap[t.subcategory_id]
          if (!sub || sub.name !== filterSubcat) return false
        }
      }
      if (filterConcept !== 'all') {
        const con = conceptMap[t.concept_id]
        if (!con || con.name !== filterConcept) return false
      }
      return true
    })

    const getMonthKey = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    // Group by unique combination of cat/sub/concept/description
    const rowMap = {}
    filtered.forEach(t => {
      const catName = catMap[t.category_id]?.name || 'Sin categoría'
      const isViajes = catName === 'Viajes'
      const subcatName = isViajes && t.destination ? t.destination : (subcatMap[t.subcategory_id]?.name || 'Sin subcategoría')
      const conceptName = conceptMap[t.concept_id]?.name || 'Sin concepto'
      const desc = t.description || conceptName
      const key = `${catName}||${subcatName}||${conceptName}||${desc}`
      const amount = getAmount(t, currency)
      const mk = getMonthKey(t.date)

      if (!rowMap[key]) {
        rowMap[key] = { catName, subcatName, conceptName, desc, total: 0, months: {} }
      }
      rowMap[key].total += amount
      rowMap[key].months[mk] = (rowMap[key].months[mk] || 0) + amount
    })

    let rowArr = Object.values(rowMap).map(r => ({
      ...r,
      total: Math.round(r.total),
      months: Object.fromEntries(Object.entries(r.months).map(([k, v]) => [k, Math.round(v)])),
    }))

    // Sort
    if (sortCol === 'total') {
      rowArr.sort((a, b) => sortDir === 'desc' ? b.total - a.total : a.total - b.total)
    } else if (sortCol === 'catName' || sortCol === 'subcatName' || sortCol === 'conceptName' || sortCol === 'desc') {
      rowArr.sort((a, b) => sortDir === 'desc' ? b[sortCol].localeCompare(a[sortCol], 'es') : a[sortCol].localeCompare(b[sortCol], 'es'))
    } else {
      // Month column
      rowArr.sort((a, b) => {
        const va = a.months[sortCol] || 0
        const vb = b.months[sortCol] || 0
        return sortDir === 'desc' ? vb - va : va - vb
      })
    }

    // Totals row
    const totalMonths = {}
    rowArr.forEach(r => {
      Object.entries(r.months).forEach(([mk, v]) => {
        totalMonths[mk] = (totalMonths[mk] || 0) + v
      })
    })
    const grandTotal = rowArr.reduce((s, r) => s + r.total, 0)

    return { rows: rowArr, totals: { total: grandTotal, months: totalMonths } }
  }, [transactions, currency, filterCat, filterSubcat, filterConcept, catMap, subcatMap, conceptMap, sortCol, sortDir])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')
    else { setSortCol(col); setSortDir('desc') }
  }

  const renderSortIcon = (col) => {
    if (sortCol !== col) return <ArrowUpDown size={10} style={{ opacity: 0.3 }} />
    return sortDir === 'desc' ? <ArrowDown size={10} /> : <ArrowUp size={10} />
  }

  const thStyle = (align = 'left') => ({
    padding: '10px 10px', textAlign: align, fontSize: 11, fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em',
    whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none',
    position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-secondary)',
  })

  const stickyTh = (left, align = 'left', extra = {}) => ({
    ...thStyle(align), position: 'sticky', left, zIndex: 11,
    background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)', ...extra,
  })


  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <MonthRangeSelector value={monthRange} onChange={setMonthRange} />
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <FilterDropdown label="Categoría" value={filterCat} options={catOptions} onChange={handleFilterCat} />
          <FilterDropdown label="Subcategoría" value={filterSubcat} options={subcatOptions} onChange={handleFilterSubcat} />
          <FilterDropdown label="Concepto" value={filterConcept} options={conceptOptions} onChange={setFilterConcept} />
          <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>
            {rows.length} filas
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', position: 'relative', WebkitOverflowScrolling: 'touch' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Cargando...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : rows.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: 15 }}>No hay gastos en el período seleccionado</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                {/* Hierarchy columns - only show unfiltered ones */}
                {showCatCol && (
                  <th onClick={() => handleSort('catName')} style={stickyTh(0)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Categoría {renderSortIcon("catName")}</div>
                  </th>
                )}
                {showSubCol && (
                  <th onClick={() => handleSort('subcatName')} style={{ ...thStyle(), minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Subcategoría {renderSortIcon("subcatName")}</div>
                  </th>
                )}
                {showConCol && (
                  <th onClick={() => handleSort('conceptName')} style={{ ...thStyle(), minWidth: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Concepto {renderSortIcon("conceptName")}</div>
                  </th>
                )}
                <th onClick={() => handleSort('desc')} style={{ ...thStyle(), minWidth: 140 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>Descripción {renderSortIcon("desc")}</div>
                </th>
                {/* Total */}
                <th onClick={() => handleSort('total')} style={{ ...thStyle('right'), borderLeft: '2px solid var(--border-strong)', minWidth: 100 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>Total {renderSortIcon("total")}</div>
                </th>
                {/* Month columns */}
                {monthColumns.map(col => (
                  <th key={col.key} onClick={() => handleSort(col.key)} style={{ ...thStyle('right'), minWidth: 90 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>{col.label} {renderSortIcon(col.key)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  {showCatCol && (
                    <td style={{ padding: '8px 10px', fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'inherit', zIndex: 2, borderRight: '1px solid var(--border-subtle)', minWidth: 120 }}>
                      {row.catName}
                    </td>
                  )}
                  {showSubCol && (
                    <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 120 }}>
                      {row.subcatName}
                    </td>
                  )}
                  {showConCol && (
                    <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 120 }}>
                      {row.conceptName}
                    </td>
                  )}
                  <td style={{ padding: '8px 10px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.desc}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', borderLeft: '2px solid var(--border-strong)', whiteSpace: 'nowrap' }}>
                    {fmt(row.total, currency)}
                  </td>
                  {monthColumns.map(col => {
                    const val = row.months[col.key] || 0
                    return (
                      <td key={col.key} style={{ padding: '8px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: val === 0 ? 'var(--text-dim)' : 'var(--text-secondary)', whiteSpace: 'nowrap', minWidth: 90 }}>
                        {fmt(val, currency)}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {/* Total row */}
              <tr style={{ borderTop: '2px solid var(--border-strong)', background: 'var(--bg-tertiary)', position: 'sticky', bottom: 0, zIndex: 5 }}>
                {showCatCol && <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', position: 'sticky', left: 0, background: 'var(--bg-tertiary)', zIndex: 6, borderRight: '1px solid var(--border-subtle)' }}>TOTAL</td>}
                {showSubCol && <td style={{ padding: '10px 10px' }}>{!showCatCol && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>}</td>}
                {showConCol && <td style={{ padding: '10px 10px' }}>{!showCatCol && !showSubCol && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>}</td>}
                <td style={{ padding: '10px 10px' }}>{!showCatCol && !showSubCol && !showConCol && <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TOTAL</span>}</td>
                <td style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderLeft: '2px solid var(--border-strong)' }}>
                  {fmt(totals.total, currency)}
                </td>
                {monthColumns.map(col => (
                  <td key={col.key} style={{ padding: '10px 10px', textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmt(totals.months[col.key] || 0, currency)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
