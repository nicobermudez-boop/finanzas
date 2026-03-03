import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Bar, Line, LabelList,
  BarChart, Bar as HBar, Cell
} from 'recharts'
import { Loader2, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'

const PERIODS = [
  { key: 'all', label: 'All' },
  { key: 'ytd', label: 'YTD' },
  { key: '1m', label: '1m' },
  { key: '3m', label: '3m' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
]
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#64748b','#84cc16','#14b8a6','#f43f5e']

function getAmount(t, currency) {
  if (currency === 'USD') {
    if (t.amount_usd) return parseFloat(t.amount_usd)
    if (t.currency === 'USD') return parseFloat(t.amount) || 0
    const r = parseFloat(t.exchange_rate)
    return r ? (parseFloat(t.amount) || 0) / r : 0
  }
  if (t.currency === 'ARS') return parseFloat(t.amount) || 0
  const r = parseFloat(t.exchange_rate)
  return r ? (parseFloat(t.amount) || 0) * r : 0
}

function fmt(v, c) {
  if (v == null || isNaN(v)) return '\u2013'
  return new Intl.NumberFormat(c === 'USD' ? 'en-US' : 'es-AR', { style: 'currency', currency: c, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
}
function fmtC(v, c) {
  if (v == null || isNaN(v)) return '\u2013'
  return new Intl.NumberFormat(c === 'USD' ? 'en-US' : 'es-AR', { style: 'currency', currency: c, minimumFractionDigits: 1, maximumFractionDigits: 1, notation: 'compact' }).format(v)
}
// Smart format: compact only if >= 100k (ARS) or >= 1k (USD)
function fmtSmart(v, c) {
  if (v == null || isNaN(v)) return '\u2013'
  const abs = Math.abs(v)
  const threshold = c === 'USD' ? 1000 : 100000
  if (abs >= threshold) return fmtC(v, c)
  return fmt(v, c)
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)', maxWidth: 320 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.filter(p => p.value > 0 || p.dataKey === '% Ingresos').map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill || p.stroke, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {p.dataKey === '% Ingresos' ? `${p.value}%` : fmt(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

function FilterDrawer({ title, items, selected, onToggle, icon }) {
  const [open, setOpen] = useState(false)
  const count = selected.length
  const Icon = open ? ChevronUp : ChevronDown
  return (
    <div>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontFamily: 'inherit' }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: count ? 'var(--color-accent)' : 'var(--text-muted)', fontWeight: count ? 600 : 400 }}>
          {title} {count > 0 && `(${count})`}
        </span>
        <Icon size={14} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 4px' }}>
          {items.map(item => {
            const on = selected.includes(item.id)
            return (
              <button key={item.id} onClick={() => onToggle(item.id)} style={{
                padding: '4px 10px', borderRadius: 14, border: '1px solid',
                borderColor: on ? 'var(--color-accent)' : 'var(--border-subtle)',
                background: on ? 'var(--color-accent-bg)' : 'transparent',
                color: on ? 'var(--color-accent)' : 'var(--text-muted)',
                fontSize: 12, fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
              }}>{item.icon || ''} {item.name}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Gastos() {
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('ARS')
  const [period, setPeriod] = useState('ytd')
  const [excludeExtra, setExcludeExtra] = useState(false)
  const [distGroup, setDistGroup] = useState('category')
  const [filterCats, setFilterCats] = useState([])
  const [filterSubs, setFilterSubs] = useState([])
  const [filterCons, setFilterCons] = useState([])
  const [expanded, setExpanded] = useState({})
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [txR, catR, subR, conR] = await Promise.all([
        supabase.from('transactions').select('*, categories(name)').order('date', { ascending: true }),
        supabase.from('categories').select('*').eq('type', 'expense'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
      ])
      setTransactions(txR.data || [])
      setCategories((catR.data || []).sort((a, b) => a.name.localeCompare(b.name, 'es')))
      setSubcategories(subR.data || [])
      setConcepts(conR.data || [])
      setLoading(false)
    })()
  }, [])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])

  // Conditional filter options
  const availableSubs = useMemo(() => {
    if (filterCats.length !== 1) return []
    return subcategories.filter(s => s.category_id === filterCats[0]).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filterCats, subcategories])

  const availableCons = useMemo(() => {
    if (filterCats.length !== 1 || filterSubs.length !== 1) return []
    return concepts.filter(c => c.subcategory_id === filterSubs[0]).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filterCats, filterSubs, concepts])

  const toggleCat = (id) => {
    setFilterCats(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setFilterSubs([])
    setFilterCons([])
  }
  const toggleSub = (id) => {
    setFilterSubs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    setFilterCons([])
  }
  const toggleCon = (id) => setFilterCons(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  const toggleExpand = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))


  const { kpis, barData, distData, drillData, catColors } = useMemo(() => {
    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
    let startDate

    if (period === 'all') {
      const times = transactions.map(t => new Date(t.date + 'T00:00:00').getTime()).filter(x => !isNaN(x))
      const minT = times.length ? Math.min(...times) : endDate.getTime()
      startDate = new Date(new Date(minT).getFullYear(), new Date(minT).getMonth(), 1)
    } else if (period === 'ytd') {
      startDate = new Date(now.getFullYear(), 0, 1)
    } else {
      const m = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[period]
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - m + 1, 1)
    }

    const totalM = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1

    // Previous period + year ago
    let prevStart, prevEnd
    if (period === 'ytd' || period === 'all') {
      prevStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1)
      prevEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
    } else {
      prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1)
      prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - totalM + 1, 1)
    }
    const yaStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1)
    const yaEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())

    const inR = (t, s, e) => { const d = new Date(t.date + 'T00:00:00'); return d >= s && d <= e }

    const expenses = transactions.filter(t => t.type === 'expense')
    let incomes = transactions.filter(t => t.type === 'income')
    if (excludeExtra) incomes = incomes.filter(t => t.income_subtype !== 'extraordinario')

    let curE = expenses.filter(t => inR(t, startDate, endDate))
    let prevE = expenses.filter(t => inR(t, prevStart, prevEnd))
    let yaE = expenses.filter(t => inR(t, yaStart, yaEnd))
    const curI = incomes.filter(t => inR(t, startDate, endDate))
    const prevI = incomes.filter(t => inR(t, prevStart, prevEnd))
    const yaI = incomes.filter(t => inR(t, yaStart, yaEnd))

    // Apply filters
    const applyF = (arr) => {
      let r = arr
      if (filterCats.length) r = r.filter(t => filterCats.includes(t.category_id))
      if (filterSubs.length) r = r.filter(t => filterSubs.includes(t.subcategory_id))
      if (filterCons.length) r = r.filter(t => filterCons.includes(t.concept_id))
      return r
    }
    curE = applyF(curE); prevE = applyF(prevE); yaE = applyF(yaE)

    const totalExp = curE.reduce((s, t) => s + getAmount(t, currency), 0)
    const prevTotalExp = prevE.reduce((s, t) => s + getAmount(t, currency), 0)
    const yaTotalExp = yaE.reduce((s, t) => s + getAmount(t, currency), 0)
    const totalInc = curI.reduce((s, t) => s + getAmount(t, currency), 0)
    const prevTotalInc = prevI.reduce((s, t) => s + getAmount(t, currency), 0)
    const yaTotalInc = yaI.reduce((s, t) => s + getAmount(t, currency), 0)

    const avgM = totalExp / (totalM || 1)
    const prevAvgM = prevTotalExp / (totalM || 1)
    const yaAvgM = yaTotalExp / (totalM || 1)
    const pctInc = totalInc > 0 ? (totalExp / totalInc * 100) : null
    const prevPctInc = prevTotalInc > 0 ? (prevTotalExp / prevTotalInc * 100) : null
    const yaPctInc = yaTotalInc > 0 ? (yaTotalExp / yaTotalInc * 100) : null

    // Month buckets for bar chart
    const months = []
    const d = new Date(startDate)
    while (d <= endDate) { months.push({ y: d.getFullYear(), m: d.getMonth() }); d.setMonth(d.getMonth() + 1) }

    const uniqCats = [...new Set(curE.map(t => t.category_id).filter(Boolean))]
    const cCol = {}
    uniqCats.forEach((id, i) => { cCol[id] = COLORS[i % COLORS.length] })

    const bData = months.map(({ y, m }) => {
      const label = MONTHS_SHORT[m] + ' ' + String(y).slice(2)
      const entry = { name: label }
      let mTotal = 0
      uniqCats.forEach(cid => {
        const a = curE.filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getFullYear() === y && td.getMonth() === m && t.category_id === cid }).reduce((s, t) => s + getAmount(t, currency), 0)
        entry[catMap[cid]?.name || cid] = Math.round(a)
        mTotal += a
      })
      entry._total = Math.round(mTotal)
      const mInc = curI.filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getFullYear() === y && td.getMonth() === m }).reduce((s, t) => s + getAmount(t, currency), 0)
      entry['% Ingresos'] = mInc > 0 ? Math.round((mTotal / mInc) * 100) : 0
      return entry
    })

    // Distribution data (horizontal bars)
    const dMap = {}
    curE.forEach(t => {
      let key, name
      if (distGroup === 'category') { key = t.category_id; name = catMap[t.category_id]?.name || '\u2013' }
      else if (distGroup === 'subcategory') { key = t.subcategory_id; name = subMap[t.subcategory_id]?.name || '\u2013' }
      else { key = t.concept_id; name = conMap[t.concept_id]?.name || '\u2013' }
      if (!dMap[key]) dMap[key] = { name, value: 0 }
      dMap[key].value += getAmount(t, currency)
    })
    const dData = Object.values(dMap).map(d => ({ ...d, value: Math.round(d.value) })).sort((a, b) => b.value - a.value)
    const distTotal = dData.reduce((s, d) => s + d.value, 0)
    dData.forEach(d => { d.pct = distTotal > 0 ? (d.value / distTotal * 100) : 0 })

    // Drill-down table: Cat -> Sub -> Concept -> Description
    const tree = {}
    curE.forEach(t => {
      const catName = catMap[t.category_id]?.name || 'Sin cat.'
      const subName = subMap[t.subcategory_id]?.name || 'Sin sub.'
      const conName = conMap[t.concept_id]?.name || 'Sin con.'
      const desc = t.description || conName
      const amt = getAmount(t, currency)
      if (!tree[catName]) tree[catName] = {}
      if (!tree[catName][subName]) tree[catName][subName] = {}
      if (!tree[catName][subName][conName]) tree[catName][subName][conName] = {}
      tree[catName][subName][conName][desc] = (tree[catName][subName][conName][desc] || 0) + amt
    })

    // Also build YA tree for comparison
    const yaTree = {}
    yaE.forEach(t => {
      const catName = catMap[t.category_id]?.name || 'Sin cat.'
      const subName = subMap[t.subcategory_id]?.name || 'Sin sub.'
      const conName = conMap[t.concept_id]?.name || 'Sin con.'
      const desc = t.description || conName
      const amt = getAmount(t, currency)
      if (!yaTree[catName]) yaTree[catName] = {}
      if (!yaTree[catName][subName]) yaTree[catName][subName] = {}
      if (!yaTree[catName][subName][conName]) yaTree[catName][subName][conName] = {}
      yaTree[catName][subName][conName][desc] = (yaTree[catName][subName][conName][desc] || 0) + amt
    })

    // Convert tree to array
    const sumObj = (obj) => Object.values(obj).reduce((s, v) => s + (typeof v === 'number' ? v : sumObj(v)), 0)
    const drill = Object.keys(tree).sort((a, b) => sumObj(tree[b]) - sumObj(tree[a])).map(catName => {
      const catTotal = sumObj(tree[catName])
      const yaCatTotal = yaTree[catName] ? sumObj(yaTree[catName]) : 0
      return {
        name: catName, total: catTotal, yaTotal: yaCatTotal, level: 0,
        children: Object.keys(tree[catName]).sort((a, b) => sumObj(tree[catName][b]) - sumObj(tree[catName][a])).map(subName => {
          const subTotal = sumObj(tree[catName][subName])
          const yaSubTotal = yaTree[catName]?.[subName] ? sumObj(yaTree[catName][subName]) : 0
          return {
            name: subName, total: subTotal, yaTotal: yaSubTotal, level: 1,
            children: Object.keys(tree[catName][subName]).sort((a, b) => sumObj(tree[catName][subName][b]) - sumObj(tree[catName][subName][a])).map(conName => {
              const conTotal = sumObj(tree[catName][subName][conName])
              const yaConTotal = yaTree[catName]?.[subName]?.[conName] ? sumObj(yaTree[catName][subName][conName]) : 0
              return {
                name: conName, total: conTotal, yaTotal: yaConTotal, level: 2,
                children: Object.keys(tree[catName][subName][conName]).sort((a, b) => tree[catName][subName][conName][b] - tree[catName][subName][conName][a]).map(desc => {
                  const descTotal = tree[catName][subName][conName][desc]
                  const yaDescTotal = yaTree[catName]?.[subName]?.[conName]?.[desc] || 0
                  return { name: desc, total: descTotal, yaTotal: yaDescTotal, level: 3, children: null }
                })
              }
            })
          }
        })
      }
    })

    return {
      kpis: { totalExp, prevTotalExp, yaTotalExp, totalInc, prevTotalInc, yaTotalInc, avgM, prevAvgM, yaAvgM, pctInc, prevPctInc, yaPctInc },
      barData: bData, distData: dData, drillData: drill, catColors: cCol,
    }
  }, [transactions, currency, period, excludeExtra, filterCats, filterSubs, filterCons, distGroup, catMap, subMap, conMap, categories, concepts, subcategories])


  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Cargando...</span></div>

  const pillS = (active) => ({
    padding: '4px 12px', borderRadius: 16, border: '1px solid',
    borderColor: active ? 'var(--color-accent)' : 'var(--border-subtle)',
    background: active ? 'var(--color-accent-bg)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--text-muted)',
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  })

  // Variation helpers
  const vPct = (cur, prev) => (!prev || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100
  const vColor = (v, upBad) => v == null ? 'var(--text-dim)' : (v > 0 === upBad) ? 'var(--color-expense-light)' : 'var(--color-income)'
  const fPct = (v) => v == null ? '' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const fBps = (cur, prev) => {
    if (cur == null || prev == null) return '\u2013'
    const diff = (cur - prev) * 100
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}bps`
  }

  const TotalLabel = (props) => {
    const { x, y, width, value } = props
    if (!value) return null
    return <text x={x + width / 2} y={y - 6} textAnchor="middle" fill="var(--text-muted)" fontSize={10} fontFamily="'JetBrains Mono', monospace">{fmtC(value, currency)}</text>
  }

  // Drill-down row renderer
  const renderDrillRow = (row, key, totalInc, yaTotalInc) => {
    const indent = row.level * 20
    const isExp = expanded[key]
    const has = row.children && row.children.length > 0
    const pctI = totalInc > 0 ? (row.total / totalInc * 100) : 0
    const yaPctI = yaTotalInc > 0 ? (row.yaTotal / yaTotalInc * 100) : 0
    const diffPct = row.yaTotal > 0 ? ((row.total - row.yaTotal) / Math.abs(row.yaTotal) * 100) : null
    const diffAbs = row.total - row.yaTotal
    const bps = Math.round((pctI - yaPctI) * 100)
    const fontW = row.level === 0 ? 600 : row.level === 1 ? 500 : 400
    const color = row.level === 0 ? 'var(--text-primary)' : row.level <= 2 ? 'var(--text-secondary)' : 'var(--text-muted)'

    return (
      <tr key={key} style={{ borderBottom: '1px solid var(--border-subtle)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        <td style={{ padding: '6px 8px', paddingLeft: 8 + indent }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {has ? (
              <span onClick={() => toggleExpand(key)} style={{ cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                {isExp ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            ) : <span style={{ width: 13 }} />}
            <span style={{ fontWeight: fontW, color, fontSize: 12 }}>{row.name}</span>
          </div>
        </td>
        <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--color-expense-light)', fontWeight: fontW }}>{fmtSmart(row.total, currency)}</td>
        <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--text-muted)' }}>{pctI > 0 ? `${pctI.toFixed(1)}%` : '\u2013'}</td>
        <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: vColor(diffAbs, true), fontWeight: 500 }}>
          {diffPct != null ? fPct(diffPct) : '\u2013'}
          {diffAbs !== 0 && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{diffAbs >= 0 ? '+' : ''}{fmtSmart(diffAbs, currency)}</div>}
        </td>
        <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: vColor(bps, true) }}>
          {bps !== 0 ? `${bps >= 0 ? '+' : ''}${bps}` : '\u2013'}
        </td>
      </tr>
    )
  }

  // Flatten drill-down with expansion
  const flatDrill = []
  const walkDrill = (rows, prefix) => {
    rows.forEach((row, i) => {
      const key = `${prefix}|${row.name}`
      flatDrill.push({ row, key })
      if (row.children && expanded[key]) walkDrill(row.children, key)
    })
  }
  walkDrill(drillData, 'root')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Gastos</h1>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: period === p.key ? 'var(--color-accent)' : 'transparent', color: period === p.key ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: period === p.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{p.label}</button>
            ))}
          </div>
          <button onClick={() => setExcludeExtra(!excludeExtra)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
            ...(excludeExtra ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' } : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
          }}>💰 Extraordinarios</button>
        </div>

        {/* Conditional filters */}
        {isMobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FilterDrawer title="Categorías" icon="📂" items={categories} selected={filterCats} onToggle={toggleCat} />
            {availableSubs.length > 0 && <FilterDrawer title="Subcategorías" icon="📁" items={availableSubs} selected={filterSubs} onToggle={toggleSub} />}
            {availableCons.length > 0 && <FilterDrawer title="Conceptos" icon="🏷️" items={availableCons} selected={filterCons} onToggle={toggleCon} />}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => { setFilterCats([]); setFilterSubs([]); setFilterCons([]) }} style={pillS(!filterCats.length)}>Todas</button>
              {categories.map(c => (
                <button key={c.id} onClick={() => toggleCat(c.id)} style={pillS(filterCats.includes(c.id))}>{c.icon} {c.name}</button>
              ))}
            </div>
            {availableSubs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => { setFilterSubs([]); setFilterCons([]) }} style={pillS(!filterSubs.length)}>Todas subs</button>
                {availableSubs.map(s => (
                  <button key={s.id} onClick={() => toggleSub(s.id)} style={pillS(filterSubs.includes(s.id))}>{s.name}</button>
                ))}
              </div>
            )}
            {availableCons.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterCons([])} style={pillS(!filterCons.length)}>Todos conceptos</button>
                {availableCons.map(c => (
                  <button key={c.id} onClick={() => toggleCon(c.id)} style={pillS(filterCons.includes(c.id))}>{c.name}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>Total Gastos</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense)' }}>{fmt(kpis.totalExp, currency)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>prom/mes {fmtC(kpis.avgM, currency)}</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
              {kpis.yaTotalExp > 0 && <div>vs año ant: <span style={{ color: vColor(kpis.totalExp - kpis.yaTotalExp, true), fontWeight: 600 }}>{fPct(vPct(kpis.totalExp, kpis.yaTotalExp))}</span> <span style={{ color: 'var(--text-dim)' }}>({(kpis.totalExp - kpis.yaTotalExp) >= 0 ? '+' : ''}{fmtC(kpis.totalExp - kpis.yaTotalExp, currency)})</span></div>}
              {kpis.prevTotalExp > 0 && <div>vs per. ant: <span style={{ color: vColor(kpis.totalExp - kpis.prevTotalExp, true), fontWeight: 600 }}>{fPct(vPct(kpis.totalExp, kpis.prevTotalExp))}</span> <span style={{ color: 'var(--text-dim)' }}>({(kpis.totalExp - kpis.prevTotalExp) >= 0 ? '+' : ''}{fmtC(kpis.totalExp - kpis.prevTotalExp, currency)})</span></div>}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>% sobre Ingresos</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpis.pctInc > 100 ? 'var(--color-expense)' : 'var(--text-primary)' }}>
              {kpis.pctInc != null ? `${kpis.pctInc.toFixed(1)}%` : '\u2013'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.6 }}>
              {kpis.yaPctInc != null && <div>vs año ant: <span style={{ color: vColor(kpis.pctInc - kpis.yaPctInc, true), fontWeight: 600 }}>{fBps(kpis.pctInc, kpis.yaPctInc)}</span></div>}
              {kpis.prevPctInc != null && <div>vs per. ant: <span style={{ color: vColor(kpis.pctInc - kpis.prevPctInc, true), fontWeight: 600 }}>{fBps(kpis.pctInc, kpis.prevPctInc)}</span></div>}
            </div>
          </div>
        </div>

        {/* Stacked bar chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Evolución mensual</div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={barData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtC(v, currency)} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={45} domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(catColors).map((cid, i, arr) => (
                  <Bar key={cid} yAxisId="left" dataKey={catMap[cid]?.name || cid} stackId="exp" fill={catColors[cid]}>
                    {i === arr.length - 1 && <LabelList dataKey="_total" content={TotalLabel} position="top" />}
                  </Bar>
                ))}
                <Line yAxisId="right" type="monotone" dataKey="% Ingresos" stroke="rgba(239,68,68,0.5)" strokeWidth={2} dot={{ fill: 'rgba(239,68,68,0.7)', r: 3 }} label={{ position: 'top', fill: 'rgba(239,68,68,0.7)', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", formatter: v => `${v}%` }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution (horizontal bars) + Drill-down table */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'minmax(280px, 1fr) minmax(350px, 2fr)', gap: 16 }}>
          {/* Horizontal bars */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Distribución</div>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                {[{k:'category',l:'Cat'},{k:'subcategory',l:'Sub'},{k:'concept',l:'Con'}].map(o => (
                  <button key={o.k} onClick={() => setDistGroup(o.k)} style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: distGroup === o.k ? 'var(--color-accent)' : 'transparent', color: distGroup === o.k ? '#fff' : 'var(--text-dim)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {distData.slice(0, 12).map((d, i) => (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                    <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.name}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontWeight: 500, fontSize: 11 }}>{fmtSmart(d.value, currency)} <span style={{ color: 'var(--text-dim)' }}>({d.pct.toFixed(0)}%)</span></span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${d.pct}%`, height: '100%', background: COLORS[i % COLORS.length], borderRadius: 3, transition: 'width 0.3s ease' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Drill-down table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Detalle</div>
            <div style={{ overflow: 'auto', maxHeight: 500 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'left' }}>Cat / Sub / Con / Desc</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>% Ing.</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>vs YA</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>bps</th>
                  </tr>
                </thead>
                <tbody>
                  {flatDrill.map(({ row, key }) => renderDrillRow(row, key, kpis.totalInc, kpis.yaTotalInc))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
