import { useState, useEffect, useMemo } from 'react'
import { usePersistedState } from '../hooks/usePersistedState'
import { supabase } from '../lib/supabase'
import { fetchAllTransactions } from '../lib/fetchAll'
import CurrencyToggle from '../components/CurrencyToggle'
import { usePrivacy } from '../context/PrivacyContext'
import useIsMobile from '../hooks/useIsMobile'
import {
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ComposedChart, Bar, Line, LabelList,
} from 'recharts'
import { ChevronDown, ChevronUp, Plane, Wallet } from 'lucide-react'
import CategoryIcon from '../components/CategoryIcon'
import { getIconColor } from '../lib/categoryIcons'
import { SkeletonGastos } from '../components/Skeleton'
import { fmt, fmtCompact as fmtC, fmtSmart } from '../lib/format'
import { getAmount } from '../lib/currency'

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

function CustomTooltip({ active, payload, label, currency, hideNumbers }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)', maxWidth: 320 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.filter(p => p.value > 0 || p.dataKey === '% Ingresos').map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill || p.stroke, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {p.dataKey === '% Ingresos' ? `${p.value}%` : (hideNumbers ? '••••••' : fmt(p.value, currency))}
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
        <span style={{ flex: 1, textAlign: 'left', fontSize: 13, color: count ? 'var(--color-accent)' : 'var(--text-muted)', fontWeight: count ? 600 : 400 }}>{title} {count > 0 && `(${count})`}</span>
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
  const { hideNumbers } = usePrivacy()
  const H = (s) => hideNumbers ? '••••••' : s
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = usePersistedState('finanzas-filter-gastos-currency', 'ARS')
  const [period, setPeriod] = usePersistedState('finanzas-filter-gastos-period', 'ytd')
  const [now0] = useState(() => new Date())
  const defYear = now0.getMonth() === 0 ? now0.getFullYear() - 1 : now0.getFullYear()
  const defMonth = now0.getMonth() === 0 ? 11 : now0.getMonth() - 1
  const [baseYear, setBaseYear] = useState(defYear)
  const [baseMonthIdx, setBaseMonthIdx] = useState(defMonth)
  const [excludeExtra, setExcludeExtra] = usePersistedState('finanzas-filter-gastos-excludeExtra', false)
  const [excludeViajes, setExcludeViajes] = usePersistedState('finanzas-filter-gastos-excludeViajes', false)
  const [distGroup, setDistGroup] = usePersistedState('finanzas-filter-gastos-distGroup', 'category')
  const [tableGroup, setTableGroup] = usePersistedState('finanzas-filter-gastos-tableGroup', 'concept')
  const [compareMode, setCompareMode] = usePersistedState('finanzas-filter-gastos-compareMode', 'ya')
  const [filterCats, setFilterCats] = useState([])
  const [filterSubs, setFilterSubs] = useState([])
  const [filterCons, setFilterCons] = useState([])
  const isMobile = useIsMobile()

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const [txData, catR, subR, conR] = await Promise.all([
        fetchAllTransactions(null, { select: '*, categories(name)', orderCol: 'date', orderAsc: true }),
        supabase.from('categories').select('*').eq('type', 'expense'),
        supabase.from('subcategories').select('*'),
        supabase.from('concepts').select('*'),
      ])
      setTransactions(txData)
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
    const selectedCat = catMap[filterCats[0]]
    if (selectedCat?.name === 'Viajes') {
      const dests = [...new Set(transactions.filter(t => t.category_id === filterCats[0] && t.destination).map(t => t.destination))]
      return dests.sort((a, b) => a.localeCompare(b, 'es')).map(d => ({ id: `dest_${d}`, name: d }))
    }
    return subcategories.filter(s => s.category_id === filterCats[0]).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filterCats, subcategories, transactions, catMap])

  const availableCons = useMemo(() => {
    if (filterCats.length !== 1 || filterSubs.length !== 1) return []
    const selectedCat = catMap[filterCats[0]]
    if (selectedCat?.name === 'Viajes' && String(filterSubs[0]).startsWith('dest_')) {
      const dest = String(filterSubs[0]).replace('dest_', '')
      const usedConceptIds = new Set(
        transactions
          .filter(t => t.category_id === filterCats[0] && t.destination === dest && t.concept_id)
          .map(t => t.concept_id)
      )
      return concepts.filter(c => usedConceptIds.has(c.id)).sort((a, b) => a.name.localeCompare(b.name, 'es'))
    }
    return concepts.filter(c => c.subcategory_id === filterSubs[0]).sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [filterCats, filterSubs, concepts, transactions, catMap])

  const toggleCat = (id) => { setFilterCats(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); setFilterSubs([]); setFilterCons([]) }
  const toggleSub = (id) => { setFilterSubs(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); setFilterCons([]) }
  const toggleCon = (id) => setFilterCons(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])

  const { kpis, barData, distData, tableData, chartColors } = useMemo(() => {
    const endDate = new Date(baseYear, baseMonthIdx + 1, 0)
    let startDate

    if (period === 'all') {
      const times = transactions.map(t => new Date(t.date + 'T00:00:00').getTime()).filter(x => !isNaN(x))
      const minT = times.length ? Math.min(...times) : endDate.getTime()
      startDate = new Date(new Date(minT).getFullYear(), new Date(minT).getMonth(), 1)
    } else if (period === 'ytd') {
      startDate = new Date(baseYear, 0, 1)
    } else {
      const m = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[period]
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - m + 1, 1)
    }

    const totalM = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1

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

    let expenses = transactions.filter(t => t.type === 'expense')
    if (excludeViajes) expenses = expenses.filter(t => t.categories?.name !== 'Viajes')
    let incomes = transactions.filter(t => t.type === 'income')
    if (excludeExtra) incomes = incomes.filter(t => t.income_subtype !== 'extraordinario')

    let curE = expenses.filter(t => inR(t, startDate, endDate))
    let prevE = expenses.filter(t => inR(t, prevStart, prevEnd))
    let yaE = expenses.filter(t => inR(t, yaStart, yaEnd))
    const curI = incomes.filter(t => inR(t, startDate, endDate))
    const prevI = incomes.filter(t => inR(t, prevStart, prevEnd))
    const yaI = incomes.filter(t => inR(t, yaStart, yaEnd))

    const applyF = (arr) => {
      let r = arr
      if (filterCats.length) r = r.filter(t => filterCats.includes(t.category_id))
      if (filterSubs.length) {
        const destFilters = filterSubs.filter(s => String(s).startsWith('dest_')).map(s => String(s).replace('dest_', ''))
        const subIdFilters = filterSubs.filter(s => !String(s).startsWith('dest_'))
        r = r.filter(t => {
          if (destFilters.length && destFilters.includes(t.destination)) return true
          if (subIdFilters.length && subIdFilters.includes(t.subcategory_id)) return true
          return false
        })
      }
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
    const pctInc = totalInc > 0 ? (totalExp / totalInc * 100) : null
    const prevPctInc = prevTotalInc > 0 ? (prevTotalExp / prevTotalInc * 100) : null
    const yaPctInc = yaTotalInc > 0 ? (yaTotalExp / yaTotalInc * 100) : null

    // Bar chart
    const months = []
    const d = new Date(startDate)
    while (d <= endDate) { months.push({ y: d.getFullYear(), m: d.getMonth() }); d.setMonth(d.getMonth() + 1) }

    const chartDim = filterCats.length === 1 && filterSubs.length === 1 ? 'concept'
                   : filterCats.length === 1 ? 'subcategory'
                   : 'category'
    const getChartKey = (t) => {
      if (chartDim === 'concept') return t.concept_id
      if (chartDim === 'subcategory') {
        if (catMap[t.category_id]?.name === 'Viajes' && t.destination) return `dest_${t.destination}`
        return t.subcategory_id
      }
      return t.category_id
    }
    const getChartName = (id) => {
      if (chartDim === 'concept') return conMap[id]?.name || '\u2013'
      if (chartDim === 'subcategory') {
        if (String(id).startsWith('dest_')) return String(id).replace('dest_', '')
        return subMap[id]?.name || '\u2013'
      }
      return catMap[id]?.name || '\u2013'
    }
    const uniqItems = [...new Set(curE.map(t => getChartKey(t)).filter(Boolean))]
    const chartColors = {}
    uniqItems.forEach((id, i) => { chartColors[getChartName(id)] = COLORS[i % COLORS.length] })

    const bData = months.map(({ y, m }) => {
      const label = MONTHS_SHORT[m] + ' ' + String(y).slice(2)
      const entry = { name: label }; let mTotal = 0
      uniqItems.forEach(id => {
        const name = getChartName(id)
        const a = curE.filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getFullYear() === y && td.getMonth() === m && getChartKey(t) === id }).reduce((s, t) => s + getAmount(t, currency), 0)
        entry[name] = Math.round(a); mTotal += a
      })
      entry._total = Math.round(mTotal)
      const mInc = curI.filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getFullYear() === y && td.getMonth() === m }).reduce((s, t) => s + getAmount(t, currency), 0)
      entry['% Ingresos'] = mInc > 0 ? Math.round((mTotal / mInc) * 1000) / 10 : 0
      return entry
    })

    // Distribution
    const dMap = {}
    curE.forEach(t => {
      let key, name
      const isViajes = catMap[t.category_id]?.name === 'Viajes'
      if (distGroup === 'category') { key = t.category_id; name = catMap[t.category_id]?.name || '\u2013' }
      else if (distGroup === 'subcategory') {
        if (isViajes && t.destination) { key = `dest_${t.destination}`; name = t.destination }
        else { key = t.subcategory_id; name = subMap[t.subcategory_id]?.name || '\u2013' }
      }
      else { key = t.concept_id; name = conMap[t.concept_id]?.name || '\u2013' }
      if (!dMap[key]) dMap[key] = { name, value: 0 }
      dMap[key].value += getAmount(t, currency)
    })
    const dData = Object.values(dMap).map(d => ({ ...d, value: Math.round(d.value) })).sort((a, b) => b.value - a.value)
    const distTotal = dData.reduce((s, d) => s + d.value, 0)
    dData.forEach(d => { d.pct = distTotal > 0 ? (d.value / distTotal * 100) : 0 })

    // Table data: group by tableGroup level
    const buildGroup = (arr, incArr) => {
      const gMap = {}
      const incTotal = incArr.reduce((s, t) => s + getAmount(t, currency), 0)
      arr.forEach(t => {
        let key, name, parent
        const isViajes = catMap[t.category_id]?.name === 'Viajes'
        if (tableGroup === 'category') { key = t.category_id; name = catMap[t.category_id]?.name || '\u2013'; parent = '' }
        else if (tableGroup === 'subcategory') {
          if (isViajes && t.destination) { key = `dest_${t.destination}`; name = t.destination; parent = 'Viajes' }
          else { key = t.subcategory_id; name = subMap[t.subcategory_id]?.name || '\u2013'; parent = catMap[t.category_id]?.name || '\u2013' }
        }
        else if (tableGroup === 'concept') { key = t.concept_id; name = conMap[t.concept_id]?.name || '\u2013'; parent = isViajes && t.destination ? t.destination : subMap[t.subcategory_id]?.name || '\u2013' }
        else { key = `${t.concept_id}||${t.description || conMap[t.concept_id]?.name || '(sin desc)'}`; name = t.description || conMap[t.concept_id]?.name || '(sin desc)'; parent = conMap[t.concept_id]?.name || '\u2013' }
        if (!gMap[key]) gMap[key] = { name, parent, total: 0 }
        gMap[key].total += getAmount(t, currency)
      })
      return { groups: gMap, incTotal }
    }

    const cur = buildGroup(curE, curI)
    const ya = buildGroup(yaE, yaI)
    const prev = buildGroup(prevE, prevI)

    const tData = Object.entries(cur.groups).map(([key, row]) => {
      const yaRow = ya.groups[key]; const prevRow = prev.groups[key]
      const yaTotal = yaRow ? yaRow.total : 0; const prevTotal = prevRow ? prevRow.total : 0
      const curPctI = totalInc > 0 ? (row.total / totalInc * 100) : 0
      const yaPctI = yaTotalInc > 0 ? (yaTotal / yaTotalInc * 100) : 0
      const prevPctI = prevTotalInc > 0 ? (prevTotal / prevTotalInc * 100) : 0
      const avg = row.total / (totalM || 1)
      const yaAvg = yaTotal / (totalM || 1)
      const prevAvg = prevTotal / (totalM || 1)
      const yaBps = Math.round((curPctI - yaPctI) * 100)
      const prevBps = Math.round((curPctI - prevPctI) * 100)
      return {
        ...row, total: Math.round(row.total), avg: Math.round(avg),
        pctIncome: totalInc > 0 ? (row.total / totalInc * 100).toFixed(1) : '\u2013',
        yaTotal: Math.round(yaTotal), prevTotal: Math.round(prevTotal),
        yaDiffPct: yaTotal > 0 ? ((row.total - yaTotal) / yaTotal * 100) : null,
        yaDiffAbs: Math.round(row.total - yaTotal),
        yaAvgDiffAbs: Math.round(avg - yaAvg),
        yaBps, yaBpsImpact: totalInc > 0 ? Math.round(yaBps / 10000 * totalInc) : 0,
        prevDiffPct: prevTotal > 0 ? ((row.total - prevTotal) / prevTotal * 100) : null,
        prevDiffAbs: Math.round(row.total - prevTotal),
        prevAvgDiffAbs: Math.round(avg - prevAvg),
        prevBps, prevBpsImpact: totalInc > 0 ? Math.round(prevBps / 10000 * totalInc) : 0,
      }
    }).sort((a, b) => b.total - a.total)

    return {
      kpis: { totalExp, prevTotalExp, yaTotalExp, totalInc, prevTotalInc, yaTotalInc, avgM, totalM, pctInc, prevPctInc, yaPctInc },
      barData: bData, distData: dData, tableData: tData, chartColors,
    }
  }, [transactions, currency, period, baseYear, baseMonthIdx, excludeExtra, excludeViajes, filterCats, filterSubs, filterCons, distGroup, tableGroup, catMap, subMap, conMap])

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date + 'T00:00:00').getFullYear()).filter(y => !isNaN(y)))
    years.add(defYear)
    return [...years].filter(y => y <= now0.getFullYear()).sort()
  }, [transactions, defYear, now0])

  const maxMonth = baseYear === now0.getFullYear() ? now0.getMonth() : 11
  const handleYearChange = (y) => {
    setBaseYear(y)
    const max = y === now0.getFullYear() ? now0.getMonth() : 11
    if (baseMonthIdx > max) setBaseMonthIdx(max)
  }

  const selectStyle = {
    padding: '5px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)',
    background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
    fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
  }

  if (loading) return <SkeletonGastos />

  const pillS = (active) => ({
    padding: '4px 12px', borderRadius: 16, border: '1px solid',
    borderColor: active ? 'var(--color-accent)' : 'var(--border-subtle)',
    background: active ? 'var(--color-accent-bg)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--text-muted)',
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  })

  const vPct = (cur, prev) => (!prev || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100
  const vColor = (v, upBad) => v == null ? 'var(--text-dim)' : (v > 0 === upBad) ? 'var(--color-expense-light)' : 'var(--color-income)'
  const fPct = (v) => v == null ? '\u2013' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
  const fBps = (cur, prev) => { if (cur == null || prev == null) return '\u2013'; const d = (cur - prev) * 100; return `${d >= 0 ? '+' : ''}${Math.round(d)}bps` }

  const TotalLabel = (props) => {
    const { x, y, width, value } = props
    if (!value || hideNumbers) return null
    const chartTop = 10
    const labelY = y - 6 < chartTop ? y + 14 : y - 6
    const fill = y - 6 < chartTop ? '#fff' : 'var(--text-muted)'
    return <text x={x + width / 2} y={labelY} textAnchor="middle" fill={fill} fontSize={10} fontFamily="'JetBrains Mono', monospace">{fmtC(value, currency)}</text>
  }

  const excludedStyle = { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
  const viajesBtnStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
    ...(active ? excludedStyle : { background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.3)', color: '#06B6D4' }),
  })
  const extrasBtnStyle = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
    ...(active ? excludedStyle : { background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)', color: '#22C55E' }),
  })

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', display: 'flex', flexDirection: 'column', overflow: isMobile ? 'visible' : 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: isMobile ? '12px 16px 10px' : '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        {isMobile ? (
          <>
            {/* Mobile row 1: periods + currency toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)', flex: 1 }}>
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{ flex: 1, padding: '5px 4px', borderRadius: 'var(--radius-sm)', border: 'none', background: period === p.key ? 'var(--color-accent)' : 'transparent', color: period === p.key ? '#fff' : 'var(--text-muted)', fontSize: 11, fontWeight: period === p.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{p.label}</button>
                ))}
              </div>
              <CurrencyToggle currency={currency} onChange={setCurrency} />
            </div>
            {/* Mobile row 2: year + month + filter chips */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <select value={baseYear} onChange={e => handleYearChange(Number(e.target.value))} style={selectStyle}>
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
              <select value={baseMonthIdx} onChange={e => setBaseMonthIdx(Number(e.target.value))} style={selectStyle}>
                {MONTHS_SHORT.map((m, i) => i <= maxMonth || baseYear < now0.getFullYear() ? <option key={i} value={i}>{m}</option> : null)}
              </select>
              <button onClick={() => setExcludeViajes(!excludeViajes)} style={{ ...viajesBtnStyle(excludeViajes), fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}><Plane size={12} /> Viajes</button>
              <button onClick={() => setExcludeExtra(!excludeExtra)} style={{ ...extrasBtnStyle(excludeExtra), fontSize: 12, padding: '5px 10px', whiteSpace: 'nowrap' }}><Wallet size={12} /> Extras</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
              <CurrencyToggle currency={currency} onChange={setCurrency} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
                {PERIODS.map(p => (
                  <button key={p.key} onClick={() => setPeriod(p.key)} style={{ padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: period === p.key ? 'var(--color-accent)' : 'transparent', color: period === p.key ? '#fff' : 'var(--text-muted)', fontSize: 12, fontWeight: period === p.key ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{p.label}</button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <select value={baseYear} onChange={e => handleYearChange(Number(e.target.value))} style={selectStyle}>
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <select value={baseMonthIdx} onChange={e => setBaseMonthIdx(Number(e.target.value))} style={selectStyle}>
                  {MONTHS_SHORT.map((m, i) => i <= maxMonth || baseYear < now0.getFullYear() ? <option key={i} value={i}>{m}</option> : null)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setExcludeViajes(!excludeViajes)} style={viajesBtnStyle(excludeViajes)}><Plane size={13} /> Viajes</button>
                <button onClick={() => setExcludeExtra(!excludeExtra)} style={extrasBtnStyle(excludeExtra)}><Wallet size={13} /> Extraordinarios</button>
              </div>
            </div>
          </>
        )}

        {/* Conditional cascading filters */}
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
              {categories.map(c => <button key={c.id} onClick={() => toggleCat(c.id)} style={{ ...pillS(filterCats.includes(c.id)), display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ color: getIconColor(c.icon) }}><CategoryIcon name={c.icon} size={13} /></span> {c.name}</button>)}
            </div>
            {availableSubs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => { setFilterSubs([]); setFilterCons([]) }} style={pillS(!filterSubs.length)}>Todas subs</button>
                {availableSubs.map(s => <button key={s.id} onClick={() => toggleSub(s.id)} style={pillS(filterSubs.includes(s.id))}>{s.name}</button>)}
              </div>
            )}
            {availableCons.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button onClick={() => setFilterCons([])} style={pillS(!filterCons.length)}>Todos conceptos</button>
                {availableCons.map(c => <button key={c.id} onClick={() => toggleCon(c.id)} style={pillS(filterCons.includes(c.id))}>{c.name}</button>)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: isMobile ? 'none' : 1, overflow: isMobile ? 'visible' : 'auto', padding: '20px 24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16, display: 'flex', gap: 0 }}>
            {/* Left */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>Total Gastos</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense)', letterSpacing: '-0.02em', marginBottom: 6 }}>{H(fmt(kpis.totalExp, currency))}</div>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.6 }}>
                {kpis.yaTotalExp > 0 && <div>vs año ant: <span style={{ color: vColor(kpis.totalExp - kpis.yaTotalExp, true), fontWeight: 600 }}>{fPct(vPct(kpis.totalExp, kpis.yaTotalExp))}</span> <span style={{ color: vColor(kpis.totalExp - kpis.yaTotalExp, true) }}>({H(`${(kpis.totalExp - kpis.yaTotalExp) >= 0 ? '+' : ''}${fmtC(kpis.totalExp - kpis.yaTotalExp, currency)}`)})</span></div>}
                {kpis.prevTotalExp > 0 && <div>vs per. ant: <span style={{ color: vColor(kpis.totalExp - kpis.prevTotalExp, true), fontWeight: 600 }}>{fPct(vPct(kpis.totalExp, kpis.prevTotalExp))}</span> <span style={{ color: vColor(kpis.totalExp - kpis.prevTotalExp, true) }}>({H(`${(kpis.totalExp - kpis.prevTotalExp) >= 0 ? '+' : ''}${fmtC(kpis.totalExp - kpis.prevTotalExp, currency)}`)})</span></div>}
              </div>
            </div>
            {/* Divider */}
            <div style={{ width: 1, background: 'var(--border-subtle)', margin: '0 16px', flexShrink: 0 }} />
            {/* Right: prom/mes */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', minWidth: 80 }}>
              <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Prom/mes</div>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense)', opacity: 0.55, letterSpacing: '-0.02em', marginBottom: 6 }}>{H(fmtC(kpis.avgM, currency))}</div>
              <div style={{ fontSize: 10, lineHeight: 1.7, textAlign: 'right' }}>
                {kpis.yaTotalExp > 0 && <div style={{ color: 'var(--text-dim)', opacity: 0.55 }}>vs año ant: <span style={{ color: vColor(kpis.totalExp - kpis.yaTotalExp, true) }}>{H(`${(kpis.totalExp - kpis.yaTotalExp) >= 0 ? '+' : ''}${fmtC(Math.round((kpis.totalExp - kpis.yaTotalExp) / (kpis.totalM || 1)), currency)}`)}</span></div>}
                {kpis.prevTotalExp > 0 && <div style={{ color: 'var(--text-dim)', opacity: 0.55 }}>vs per. ant: <span style={{ color: vColor(kpis.totalExp - kpis.prevTotalExp, true) }}>{H(`${(kpis.totalExp - kpis.prevTotalExp) >= 0 ? '+' : ''}${fmtC(Math.round((kpis.totalExp - kpis.prevTotalExp) / (kpis.totalM || 1)), currency)}`)}</span></div>}
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>% sobre Ingresos</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpis.pctInc > 100 ? 'var(--color-expense)' : 'var(--text-primary)' }}>
              {kpis.pctInc != null ? `${kpis.pctInc.toFixed(1)}%` : '\u2013'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.6 }}>
              {kpis.yaPctInc != null && <div>vs año ant: <span style={{ color: vColor(kpis.pctInc - kpis.yaPctInc, true), fontWeight: 600 }}>{fBps(kpis.pctInc, kpis.yaPctInc)}</span>{kpis.totalInc > 0 && <span style={{ color: vColor(kpis.pctInc - kpis.yaPctInc, true) }}> ({H(`${(kpis.pctInc - kpis.yaPctInc) >= 0 ? '+' : ''}${fmtC(Math.round((kpis.pctInc - kpis.yaPctInc) * kpis.totalInc / 100), currency)}`)})</span>}</div>}
              {kpis.prevPctInc != null && <div>vs per. ant: <span style={{ color: vColor(kpis.pctInc - kpis.prevPctInc, true), fontWeight: 600 }}>{fBps(kpis.pctInc, kpis.prevPctInc)}</span>{kpis.totalInc > 0 && <span style={{ color: vColor(kpis.pctInc - kpis.prevPctInc, true) }}> ({H(`${(kpis.pctInc - kpis.prevPctInc) >= 0 ? '+' : ''}${fmtC(Math.round((kpis.pctInc - kpis.prevPctInc) * kpis.totalInc / 100), currency)}`)})</span>}</div>}
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
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => hideNumbers ? '•••' : fmtC(v, currency)} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={45} domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip currency={currency} hideNumbers={hideNumbers} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(chartColors).map((name, i, arr) => (
                  <Bar key={name} yAxisId="left" dataKey={name} stackId="exp" fill={chartColors[name]}>
                    {i === arr.length - 1 && <LabelList dataKey="_total" content={TotalLabel} position="top" />}
                  </Bar>
                ))}
                <Line yAxisId="right" type="monotone" dataKey="% Ingresos" stroke="rgba(148,163,184,0.6)" strokeWidth={1.5} strokeDasharray="4 3" dot={{ fill: 'rgba(148,163,184,0.7)', r: 2 }} label={{ position: 'top', fill: 'rgba(148,163,184,0.8)', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", formatter: v => `${v}%` }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution + Table */}
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
              {(() => {
                const MAX_DIST = 14
                const displayDist = distData.length <= MAX_DIST + 1
                  ? distData
                  : [
                      ...distData.slice(0, MAX_DIST),
                      {
                        name: 'Otros',
                        value: distData.slice(MAX_DIST).reduce((s, d) => s + d.value, 0),
                        pct: distData.slice(MAX_DIST).reduce((s, d) => s + d.pct, 0),
                        _isOtros: true,
                      }
                    ]
                return displayDist.map((d, i) => (
                  <div key={d._isOtros ? '_otros' : i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 12 }}>
                      <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{d.name}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)', fontWeight: 500, fontSize: 11 }}>{H(fmtSmart(d.value, currency))} <span style={{ color: 'var(--text-dim)' }}>({d.pct.toFixed(0)}%)</span></span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${d.pct}%`, height: '100%', background: d._isOtros ? '#94a3b8' : (chartColors[d.name] || COLORS[i % COLORS.length]), borderRadius: 3, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                ))
              })()}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Detalle</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                  {[{k:'category',l:'Cat'},{k:'subcategory',l:'Sub'},{k:'concept',l:'Con'},{k:'description',l:'Desc'}].map(o => (
                    <button key={o.k} onClick={() => setTableGroup(o.k)} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: tableGroup === o.k ? 'var(--color-accent)' : 'transparent', color: tableGroup === o.k ? '#fff' : 'var(--text-dim)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{o.l}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                  {[{k:'ya',l:'vs YA'},{k:'prev',l:'vs Per.'}].map(o => (
                    <button key={o.k} onClick={() => setCompareMode(o.k)} style={{ padding: '3px 10px', borderRadius: 4, border: 'none', background: compareMode === o.k ? 'var(--color-accent)' : 'transparent', color: compareMode === o.k ? '#fff' : 'var(--text-dim)', fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{o.l}</button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 500, position: 'relative' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-strong)', position: 'sticky', top: 0, zIndex: 2, background: 'var(--bg-card)' }}>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'left', position: 'sticky', left: 0, zIndex: 3, background: 'var(--bg-card)' }}>{tableGroup === 'category' ? 'Categoría' : tableGroup === 'subcategory' ? 'Subcategoría' : tableGroup === 'concept' ? 'Concepto' : 'Descripción'}</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Total<br/><span style={{ fontWeight: 400, fontSize: 9, opacity: 0.7 }}>Prom/mes</span></th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>% Ing.</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>{compareMode === 'ya' ? '% vs YA' : '% vs Per.'}</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>{compareMode === 'ya' ? '$ vs YA' : '$ vs Per.'}<br/><span style={{ fontWeight: 400, fontSize: 9, opacity: 0.7 }}>Prom/mes</span></th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>bps<br/><span style={{ fontWeight: 400, fontSize: 9, opacity: 0.7 }}>Impacto $</span></th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((r, i) => {
                    const diffPct = compareMode === 'ya' ? r.yaDiffPct : r.prevDiffPct
                    const diffAbs = compareMode === 'ya' ? r.yaDiffAbs : r.prevDiffAbs
                    const avgDiffAbs = compareMode === 'ya' ? r.yaAvgDiffAbs : r.prevAvgDiffAbs
                    const bps = compareMode === 'ya' ? r.yaBps : r.prevBps
                    const bpsImpact = compareMode === 'ya' ? r.yaBpsImpact : r.prevBpsImpact
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; const td = e.currentTarget.querySelector('td:first-child'); if (td) td.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; const td = e.currentTarget.querySelector('td:first-child'); if (td) td.style.background = 'var(--bg-card)' }}>
                        <td style={{ padding: '6px 8px', position: 'sticky', left: 0, zIndex: 1, background: 'var(--bg-card)' }}>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{r.name}</div>
                          {r.parent && <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{r.parent}</div>}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense-light)' }}>{H(fmtSmart(r.total, currency))}</div>
                          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-dim)' }}>{H(fmtSmart(r.avg, currency))}</div>
                        </td>
                        <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--text-muted)' }}>{r.pctIncome}%</td>
                        <td style={{ padding: '6px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: vColor(diffAbs, true), fontWeight: 500 }}>
                          {fPct(diffPct)}
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: vColor(diffAbs, true) }}>
                            {diffAbs !== 0 ? H(`${diffAbs >= 0 ? '+' : ''}${fmtSmart(diffAbs, currency)}`) : '\u2013'}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: vColor(avgDiffAbs, true), opacity: 0.7 }}>
                            {avgDiffAbs !== 0 ? H(`${avgDiffAbs >= 0 ? '+' : ''}${fmtSmart(avgDiffAbs, currency)}`) : '\u2013'}
                          </div>
                        </td>
                        <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                          <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: vColor(bps, true) }}>
                            {bps !== 0 ? `${bps >= 0 ? '+' : ''}${bps}` : '\u2013'}
                          </div>
                          <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: vColor(bpsImpact, true), opacity: 0.7 }}>
                            {bpsImpact !== 0 ? H(`${bpsImpact >= 0 ? '+' : ''}${fmtSmart(bpsImpact, currency)}`) : '\u2013'}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
