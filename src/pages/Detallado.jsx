import { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import { ChevronRight, ChevronDown, Filter, Loader2 } from 'lucide-react'

// Format currency amounts
function fmt(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  if (value === 0) return '–'
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0
    }).format(value)
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(value)
}

// Generate month columns based on range
function getMonthColumns(months) {
  const cols = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    cols.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      shortLabel: d.toLocaleDateString('es-AR', { month: 'short' }),
      year: d.getFullYear(),
      month: d.getMonth() + 1,
    })
  }
  return cols
}

// Month range selector
function MonthRangeSelector({ value, onChange }) {
  const options = [3, 6, 12, 24]
  return (
    <div style={{
      display: 'flex',
      gap: 4,
      background: 'var(--bg-tertiary)',
      borderRadius: 'var(--radius-md)',
      padding: 3,
      border: '1px solid var(--border-subtle)',
    }}>
      {options.map(n => (
        <button
          key={n}
          onClick={() => onChange(n)}
          style={{
            padding: '6px 12px',
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: value === n ? 'var(--bg-active)' : 'transparent',
            color: value === n ? 'var(--text-primary)' : 'var(--text-muted)',
            fontSize: 12,
            fontWeight: value === n ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {n}m
        </button>
      ))}
    </div>
  )
}

// Dropdown filter
function FilterDropdown({ label, value, options, onChange }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '7px 12px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        color: value === 'all' ? 'var(--text-muted)' : 'var(--text-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
        cursor: 'pointer',
        outline: 'none',
        minWidth: 130,
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 28,
      }}
    >
      <option value="all">{label}</option>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

// Expandable row component
function TreeRow({ row, depth, expanded, onToggle, monthColumns, currency, isTotal }) {
  const hasChildren = row.children && row.children.length > 0
  const isExpanded = expanded[row.key]
  const indent = depth * 20

  const rowBg = isTotal
    ? 'var(--bg-tertiary)'
    : depth === 0
      ? 'transparent'
      : 'transparent'

  const textWeight = depth === 0 ? 600 : depth === 1 ? 500 : 400
  const textColor = depth === 0 ? 'var(--text-primary)' : depth === 3 ? 'var(--text-muted)' : 'var(--text-secondary)'
  const fontSize = depth === 0 ? 13 : 13

  return (
    <>
      <tr
        style={{
          background: rowBg,
          borderBottom: '1px solid var(--border-subtle)',
          transition: 'background 0.1s ease',
        }}
        onMouseEnter={e => {
          if (!isTotal) e.currentTarget.style.background = 'var(--bg-hover)'
        }}
        onMouseLeave={e => {
          if (!isTotal) e.currentTarget.style.background = rowBg
        }}
      >
        {/* Label cell */}
        <td style={{
          padding: '8px 10px',
          paddingLeft: 10 + indent,
          position: 'sticky',
          left: 0,
          background: 'inherit',
          zIndex: 2,
          borderRight: '1px solid var(--border-subtle)',
          minWidth: 220,
          maxWidth: 320,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {hasChildren ? (
              <span
                onClick={() => onToggle(row.key)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'var(--text-muted)',
                  flexShrink: 0,
                }}
              >
                {isExpanded
                  ? <ChevronDown size={14} />
                  : <ChevronRight size={14} />
                }
              </span>
            ) : (
              <span style={{ width: 14, flexShrink: 0 }} />
            )}
            <span style={{
              fontWeight: isTotal ? 700 : textWeight,
              color: isTotal ? 'var(--text-primary)' : textColor,
              fontSize,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {row.label}
            </span>
          </div>
        </td>

        {/* Total column */}
        <td style={{
          padding: '8px 12px',
          textAlign: 'right',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12,
          fontWeight: isTotal ? 700 : (depth <= 1 ? 600 : 400),
          color: isTotal ? 'var(--text-primary)' : (depth === 0 ? 'var(--text-primary)' : 'var(--text-secondary)'),
          borderRight: '2px solid var(--border-strong)',
          whiteSpace: 'nowrap',
          position: 'sticky',
          left: 220,
          background: 'inherit',
          zIndex: 2,
          minWidth: 100,
        }}>
          {fmt(row.total, currency)}
        </td>

        {/* Month cells */}
        {monthColumns.map(col => {
          const val = row.months?.[col.key] || 0
          return (
            <td key={col.key} style={{
              padding: '8px 10px',
              textAlign: 'right',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              fontWeight: isTotal ? 600 : 400,
              color: val === 0
                ? 'var(--text-dim)'
                : isTotal ? 'var(--text-primary)' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              minWidth: 90,
            }}>
              {fmt(val, currency)}
            </td>
          )
        })}
      </tr>

      {/* Children (if expanded) */}
      {hasChildren && isExpanded && row.children.map(child => (
        <TreeRow
          key={child.key}
          row={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          monthColumns={monthColumns}
          currency={currency}
          isTotal={false}
        />
      ))}
    </>
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
  const [expanded, setExpanded] = useState({})

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const now = new Date()
      const fromDate = new Date(now.getFullYear(), now.getMonth() - monthRange + 1, 1)
      const dateStr = fromDate.toISOString().split('T')[0]

      const [txRes, catRes, subcatRes, conceptRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('*')
          .eq('type', 'expense')
          .gte('date', dateStr)
          .order('date', { ascending: true }),
        supabase.from('categories').select('*').eq('type', 'expense'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
      ])

      setTransactions(txRes.data || [])
      setCategories(catRes.data || [])
      setSubcategories(subcatRes.data || [])
      setConcepts(conceptRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [monthRange])

  // Lookup maps
  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subcatMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conceptMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])

  const monthColumns = useMemo(() => getMonthColumns(monthRange), [monthRange])

  // Filter options
  const catOptions = useMemo(() => [...new Set(categories.map(c => c.name))].sort(), [categories])
  const subcatOptions = useMemo(() => {
    if (filterCat === 'all') return [...new Set(subcategories.map(s => s.name))].sort()
    const catIds = categories.filter(c => c.name === filterCat).map(c => c.id)
    return [...new Set(subcategories.filter(s => catIds.includes(s.category_id)).map(s => s.name))].sort()
  }, [filterCat, categories, subcategories])
  const conceptOptions = useMemo(() => {
    let filtered = concepts
    if (filterSubcat !== 'all') {
      const subIds = subcategories.filter(s => s.name === filterSubcat).map(s => s.id)
      filtered = concepts.filter(c => subIds.includes(c.subcategory_id))
    } else if (filterCat !== 'all') {
      const catIds = categories.filter(c => c.name === filterCat).map(c => c.id)
      const subIds = subcategories.filter(s => catIds.includes(s.category_id)).map(s => s.id)
      filtered = concepts.filter(c => subIds.includes(c.subcategory_id))
    }
    return [...new Set(filtered.map(c => c.name))].sort()
  }, [filterCat, filterSubcat, categories, subcategories, concepts])

  // Build tree data
  const treeData = useMemo(() => {
    // Filter transactions
    let filtered = transactions.filter(t => {
      if (filterCat !== 'all') {
        const cat = catMap[t.category_id]
        if (!cat || cat.name !== filterCat) return false
      }
      if (filterSubcat !== 'all') {
        const sub = subcatMap[t.subcategory_id]
        if (!sub || sub.name !== filterSubcat) return false
      }
      if (filterConcept !== 'all') {
        const con = conceptMap[t.concept_id]
        if (!con || con.name !== filterConcept) return false
      }
      return true
    })

    // Get amount in selected currency
    const getAmount = (t) => {
      if (currency === 'USD') {
        // If amount_usd exists, use it; if currency is USD and amount_usd is null, use amount directly
        if (t.amount_usd) return parseFloat(t.amount_usd)
        if (t.currency === 'USD') return parseFloat(t.amount) || 0
        // ARS transaction without amount_usd: try to convert
        const rate = parseFloat(t.exchange_rate)
        return rate ? (parseFloat(t.amount) || 0) / rate : 0
      } else {
        if (t.currency === 'ARS') return parseFloat(t.amount) || 0
        // USD transaction → convert to ARS (if no rate, show 0)
        const rate = parseFloat(t.exchange_rate)
        if (rate) return (parseFloat(t.amount) || 0) * rate
        // No rate available — can't convert, return 0
        return 0
      }
    }

    // Get month key from date
    const getMonthKey = (dateStr) => {
      const d = new Date(dateStr + 'T00:00:00')
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    // Build hierarchy: category → subcategory → concept → description
    const catTree = {}

    filtered.forEach(t => {
      const catName = catMap[t.category_id]?.name || 'Sin categoría'
      const subcatName = subcatMap[t.subcategory_id]?.name || 'Sin subcategoría'
      const conceptName = conceptMap[t.concept_id]?.name || 'Sin concepto'
      const desc = t.description || '(sin descripción)'
      const amount = getAmount(t)
      const monthKey = getMonthKey(t.date)

      if (!catTree[catName]) catTree[catName] = {}
      if (!catTree[catName][subcatName]) catTree[catName][subcatName] = {}
      if (!catTree[catName][subcatName][conceptName]) catTree[catName][subcatName][conceptName] = {}
      if (!catTree[catName][subcatName][conceptName][desc]) {
        catTree[catName][subcatName][conceptName][desc] = {}
      }
      catTree[catName][subcatName][conceptName][desc][monthKey] =
        (catTree[catName][subcatName][conceptName][desc][monthKey] || 0) + amount
    })

    // Convert to array with totals
    const rows = []
    const grandTotalMonths = {}

    Object.keys(catTree).sort().forEach(catName => {
      const catMonths = {}
      const catChildren = []

      Object.keys(catTree[catName]).sort().forEach(subcatName => {
        const subcatMonths = {}
        const subcatChildren = []

        Object.keys(catTree[catName][subcatName]).sort().forEach(conceptName => {
          const conceptMonths = {}
          const conceptChildren = []

          Object.keys(catTree[catName][subcatName][conceptName]).sort().forEach(desc => {
            const descMonths = catTree[catName][subcatName][conceptName][desc]
            const descTotal = Object.values(descMonths).reduce((a, b) => a + b, 0)

            // Accumulate up
            Object.entries(descMonths).forEach(([mk, v]) => {
              conceptMonths[mk] = (conceptMonths[mk] || 0) + v
              subcatMonths[mk] = (subcatMonths[mk] || 0) + v
              catMonths[mk] = (catMonths[mk] || 0) + v
              grandTotalMonths[mk] = (grandTotalMonths[mk] || 0) + v
            })

            conceptChildren.push({
              key: `${catName}|${subcatName}|${conceptName}|${desc}`,
              label: desc,
              months: descMonths,
              total: descTotal,
              children: null,
            })
          })

          const conceptTotal = Object.values(conceptMonths).reduce((a, b) => a + b, 0)
          subcatChildren.push({
            key: `${catName}|${subcatName}|${conceptName}`,
            label: conceptName,
            months: conceptMonths,
            total: conceptTotal,
            children: conceptChildren.length > 0 ? conceptChildren : null,
          })
        })

        const subcatTotal = Object.values(subcatMonths).reduce((a, b) => a + b, 0)
        catChildren.push({
          key: `${catName}|${subcatName}`,
          label: subcatName,
          months: subcatMonths,
          total: subcatTotal,
          children: subcatChildren.length > 0 ? subcatChildren : null,
        })
      })

      const catTotal = Object.values(catMonths).reduce((a, b) => a + b, 0)
      rows.push({
        key: catName,
        label: catName,
        months: catMonths,
        total: catTotal,
        children: catChildren.length > 0 ? catChildren : null,
      })
    })

    const grandTotal = Object.values(grandTotalMonths).reduce((a, b) => a + b, 0)

    return {
      rows,
      totalRow: {
        key: '__TOTAL__',
        label: 'TOTAL',
        months: grandTotalMonths,
        total: grandTotal,
        children: null,
      }
    }
  }, [transactions, currency, filterCat, filterSubcat, filterConcept, catMap, subcatMap, conceptMap])

  const toggleExpand = useCallback((key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const expandAll = useCallback(() => {
    const all = {}
    const walk = (rows) => {
      rows.forEach(r => {
        if (r.children) {
          all[r.key] = true
          walk(r.children)
        }
      })
    }
    walk(treeData.rows)
    setExpanded(all)
  }, [treeData])

  const collapseAll = useCallback(() => setExpanded({}), [])

  // Reset dependent filters
  useEffect(() => {
    setFilterSubcat('all')
    setFilterConcept('all')
  }, [filterCat])

  useEffect(() => {
    setFilterConcept('all')
  }, [filterSubcat])

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div className="page-header" style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          marginBottom: 16,
        }}>
          <h1 style={{
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}>
            Detallado de Gastos
          </h1>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <MonthRangeSelector value={monthRange} onChange={setMonthRange} />
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>
        </div>

        {/* Filters row */}
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <Filter size={15} style={{ color: 'var(--text-muted)' }} />
          <FilterDropdown
            label="Categoría"
            value={filterCat}
            options={catOptions}
            onChange={setFilterCat}
          />
          <FilterDropdown
            label="Subcategoría"
            value={filterSubcat}
            options={subcatOptions}
            onChange={setFilterSubcat}
          />
          <FilterDropdown
            label="Concepto"
            value={filterConcept}
            options={conceptOptions}
            onChange={setFilterConcept}
          />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button
              onClick={expandAll}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Expandir todo
            </button>
            <button
              onClick={collapseAll}
              style={{
                padding: '6px 12px',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-muted)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Colapsar todo
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        position: 'relative',
      }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 10,
            color: 'var(--text-muted)',
          }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Cargando...</span>
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : treeData.rows.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 12,
            color: 'var(--text-muted)',
          }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>📊</div>
            <div style={{ fontSize: 15 }}>No hay gastos en el período seleccionado</div>
            <div style={{ fontSize: 13, color: 'var(--text-dim)' }}>
              Cargá transacciones desde "Cargar" o importá el histórico del Excel
            </div>
          </div>
        ) : (
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            tableLayout: 'auto',
          }}>
            <thead>
              <tr style={{
                position: 'sticky',
                top: 0,
                zIndex: 10,
                background: 'var(--bg-secondary)',
                borderBottom: '2px solid var(--border-strong)',
              }}>
                <th style={{
                  padding: '10px 10px',
                  textAlign: 'left',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  position: 'sticky',
                  left: 0,
                  background: 'var(--bg-secondary)',
                  zIndex: 11,
                  borderRight: '1px solid var(--border-subtle)',
                  minWidth: 220,
                }}>
                  Concepto
                </th>
                <th style={{
                  padding: '10px 12px',
                  textAlign: 'right',
                  fontSize: 11,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  borderRight: '2px solid var(--border-strong)',
                  whiteSpace: 'nowrap',
                  position: 'sticky',
                  left: 220,
                  background: 'var(--bg-secondary)',
                  zIndex: 11,
                  minWidth: 100,
                }}>
                  Total
                </th>
                {monthColumns.map(col => (
                  <th key={col.key} style={{
                    padding: '10px 10px',
                    textAlign: 'right',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                    minWidth: 90,
                  }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {treeData.rows.map(row => (
                <TreeRow
                  key={row.key}
                  row={row}
                  depth={0}
                  expanded={expanded}
                  onToggle={toggleExpand}
                  monthColumns={monthColumns}
                  currency={currency}
                  isTotal={false}
                />
              ))}
              {/* Grand total */}
              <TreeRow
                row={treeData.totalRow}
                depth={0}
                expanded={expanded}
                onToggle={toggleExpand}
                monthColumns={monthColumns}
                currency={currency}
                isTotal={true}
              />
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
