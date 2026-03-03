import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, ComposedChart, Line
} from 'recharts'
import { Loader2 } from 'lucide-react'

const PERIODS = [
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
    const rate = parseFloat(t.exchange_rate)
    return rate ? (parseFloat(t.amount) || 0) / rate : 0
  } else {
    if (t.currency === 'ARS') return parseFloat(t.amount) || 0
    const rate = parseFloat(t.exchange_rate)
    return rate ? (parseFloat(t.amount) || 0) * rate : 0
  }
}

function fmt(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function fmtCompact(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, notation: 'compact' }).format(value)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, notation: 'compact' }).format(value)
}

function getPeriodRange(period) {
  const now = new Date()
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
  let startDate
  if (period === 'ytd') {
    startDate = new Date(now.getFullYear(), 0, 1)
  } else {
    const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[period]
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - months + 1, 1)
  }
  return { startDate, endDate }
}

function getPrevPeriodRange(period) {
  const { startDate, endDate } = getPeriodRange(period)
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1
  if (period === 'ytd') {
    return {
      startDate: new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1),
      endDate: new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate()),
    }
  }
  const prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - monthsDiff + 1, 1)
  return { startDate: prevStart, endDate: prevEnd }
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)', maxWidth: 300 }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.fill, flexShrink: 0 }} />
          <span style={{ color: 'var(--text-secondary)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmt(p.value, currency)}</span>
        </div>
      ))}
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
  const [pieGroup, setPieGroup] = useState('category')
  const [tableGroup, setTableGroup] = useState('concept')
  const [filterCat, setFilterCat] = useState(null)
  const [filterSub, setFilterSub] = useState(null)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const [txRes, catRes, subRes, conRes] = await Promise.all([
        supabase.from('transactions').select('*, categories(name, icon)').order('date', { ascending: true }),
        supabase.from('categories').select('*').eq('type', 'expense'),
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
  }, [])

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c])), [categories])
  const subMap = useMemo(() => Object.fromEntries(subcategories.map(s => [s.id, s])), [subcategories])
  const conMap = useMemo(() => Object.fromEntries(concepts.map(c => [c.id, c])), [concepts])

  const { kpis, barData, pieData, tableData, catColors } = useMemo(() => {
    const { startDate, endDate } = getPeriodRange(period)
    const prev = getPrevPeriodRange(period)
    const prevPeriod = getPrevPeriodRange(period) // same period shifted back

    const inRange = (t, s, e) => { const d = new Date(t.date + 'T00:00:00'); return d >= s && d <= e }
    const expenses = transactions.filter(t => t.type === 'expense')
    let incomes = transactions.filter(t => t.type === 'income')
    if (excludeExtra) incomes = incomes.filter(t => t.income_subtype !== 'extraordinario')

    let curExpenses = expenses.filter(t => inRange(t, startDate, endDate))
    let prevExpenses = expenses.filter(t => inRange(t, prev.startDate, prev.endDate))
    const curIncomes = incomes.filter(t => inRange(t, startDate, endDate))

    // Apply category filters
    if (filterCat) {
      curExpenses = curExpenses.filter(t => t.category_id === filterCat)
      prevExpenses = prevExpenses.filter(t => t.category_id === filterCat)
    }
    if (filterSub) {
      curExpenses = curExpenses.filter(t => t.subcategory_id === filterSub)
      prevExpenses = prevExpenses.filter(t => t.subcategory_id === filterSub)
    }

    const totalExpense = curExpenses.reduce((s, t) => s + getAmount(t, currency), 0)
    const prevTotalExpense = prevExpenses.reduce((s, t) => s + getAmount(t, currency), 0)

    // Same period year ago
    const yaStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1)
    const yaEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
    let yaExpenses = expenses.filter(t => inRange(t, yaStart, yaEnd))
    if (filterCat) yaExpenses = yaExpenses.filter(t => t.category_id === filterCat)
    if (filterSub) yaExpenses = yaExpenses.filter(t => t.subcategory_id === filterSub)
    const yaTotalExpense = yaExpenses.reduce((s, t) => s + getAmount(t, currency), 0)

    const totalIncome = curIncomes.reduce((s, t) => s + getAmount(t, currency), 0)

    // Months in range
    const months = []
    const d = new Date(startDate)
    while (d <= endDate) {
      months.push({ year: d.getFullYear(), month: d.getMonth() })
      d.setMonth(d.getMonth() + 1)
    }
    const numMonths = months.length || 1

    // Assign colors to categories
    const uniqueCats = [...new Set(curExpenses.map(t => t.category_id).filter(Boolean))]
    const cColors = {}
    uniqueCats.forEach((id, i) => { cColors[id] = COLORS[i % COLORS.length] })

    // Bar chart data (stacked by category)
    const bData = months.map(({ year, month }) => {
      const label = MONTHS_SHORT[month] + ' ' + String(year).slice(2)
      const entry = { name: label }
      let monthTotal = 0

      uniqueCats.forEach(catId => {
        const amt = curExpenses
          .filter(t => {
            const td = new Date(t.date + 'T00:00:00')
            return td.getFullYear() === year && td.getMonth() === month && t.category_id === catId
          })
          .reduce((s, t) => s + getAmount(t, currency), 0)
        entry[catMap[catId]?.name || catId] = Math.round(amt)
        monthTotal += amt
      })

      // % over income
      const monthIncome = curIncomes
        .filter(t => { const td = new Date(t.date + 'T00:00:00'); return td.getFullYear() === year && td.getMonth() === month })
        .reduce((s, t) => s + getAmount(t, currency), 0)
      entry['% Ingresos'] = monthIncome > 0 ? Math.round((monthTotal / monthIncome) * 100) : 0

      return entry
    })

    // Pie chart data
    const pieGroupMap = {}
    curExpenses.forEach(t => {
      let key, name
      if (pieGroup === 'category') {
        key = t.category_id
        name = catMap[t.category_id]?.name || '–'
      } else if (pieGroup === 'subcategory') {
        key = t.subcategory_id
        name = subMap[t.subcategory_id]?.name || '–'
      } else {
        key = t.concept_id
        name = conMap[t.concept_id]?.name || '–'
      }
      if (!pieGroupMap[key]) pieGroupMap[key] = { name, value: 0 }
      pieGroupMap[key].value += getAmount(t, currency)
    })
    const pData = Object.values(pieGroupMap)
      .map(d => ({ ...d, value: Math.round(d.value) }))
      .sort((a, b) => b.value - a.value)

    // Table data
    const tGroupMap = {}
    curExpenses.forEach(t => {
      let key, name, parent
      if (tableGroup === 'concept') {
        key = t.concept_id
        name = conMap[t.concept_id]?.name || '–'
        parent = subMap[t.subcategory_id]?.name || '–'
      } else {
        key = t.description || '(sin descripción)'
        name = t.description || '(sin descripción)'
        parent = conMap[t.concept_id]?.name || '–'
      }
      if (!tGroupMap[key]) tGroupMap[key] = { name, parent, total: 0 }
      tGroupMap[key].total += getAmount(t, currency)
    })
    const tData = Object.values(tGroupMap)
      .map(d => ({
        ...d,
        total: Math.round(d.total),
        pctIncome: totalIncome > 0 ? ((d.total / totalIncome) * 100).toFixed(1) : '–',
        avg: Math.round(d.total / numMonths),
      }))
      .sort((a, b) => b.total - a.total)

    return {
      kpis: {
        totalExpense, prevTotalExpense, yaTotalExpense, totalIncome,
        avgMonthly: totalExpense / numMonths,
        pctIncome: totalIncome > 0 ? (totalExpense / totalIncome * 100) : null,
        vsYaPct: yaTotalExpense > 0 ? ((totalExpense - yaTotalExpense) / yaTotalExpense * 100) : null,
        vsPrevPct: prevTotalExpense > 0 ? ((totalExpense - prevTotalExpense) / prevTotalExpense * 100) : null,
      },
      barData: bData,
      pieData: pData,
      tableData: tData,
      catColors: cColors,
    }
  }, [transactions, currency, period, excludeExtra, filterCat, filterSub, pieGroup, tableGroup, catMap, subMap, conMap, categories])

  // Get subcategories for selected category filter
  const filteredSubs = useMemo(() =>
    filterCat ? subcategories.filter(s => s.category_id === filterCat) : [],
    [filterCat, subcategories]
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Cargando...</span>
      </div>
    )
  }

  const pillStyle = (active) => ({
    padding: '4px 12px', borderRadius: 16, border: '1px solid',
    borderColor: active ? 'var(--color-accent)' : 'var(--border-subtle)',
    background: active ? 'var(--color-accent-bg)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--text-muted)',
    fontSize: 12, fontWeight: active ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all 0.15s', whiteSpace: 'nowrap',
  })

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>🔍 Gastos</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: period === p.key ? 'var(--color-accent)' : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: period === p.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>{p.label}</button>
            ))}
          </div>

          <button onClick={() => setExcludeExtra(!excludeExtra)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', border: '1px solid',
            ...(excludeExtra
              ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
              : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
          }}>
            💰 Extraordinarios
          </button>
        </div>

        {/* Category filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
          <button onClick={() => { setFilterCat(null); setFilterSub(null) }} style={pillStyle(!filterCat)}>Todas</button>
          {categories.map(c => (
            <button key={c.id} onClick={() => { setFilterCat(c.id === filterCat ? null : c.id); setFilterSub(null) }} style={pillStyle(filterCat === c.id)}>
              {c.icon} {c.name}
            </button>
          ))}
        </div>
        {filteredSubs.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <button onClick={() => setFilterSub(null)} style={pillStyle(!filterSub)}>Todas sub</button>
            {filteredSubs.map(s => (
              <button key={s.id} onClick={() => setFilterSub(s.id === filterSub ? null : s.id)} style={pillStyle(filterSub === s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>Total Gastos</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense)' }}>{fmt(kpis.totalExpense, currency)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4 }}>
              {kpis.vsYaPct !== null && <span>vs año ant: <span style={{ color: kpis.vsYaPct > 0 ? 'var(--color-expense-light)' : 'var(--color-income)', fontWeight: 600 }}>{kpis.vsYaPct > 0 ? '+' : ''}{kpis.vsYaPct.toFixed(1)}%</span></span>}
              {kpis.vsPrevPct !== null && <span> · vs per. ant: <span style={{ color: kpis.vsPrevPct > 0 ? 'var(--color-expense-light)' : 'var(--color-income)', fontWeight: 600 }}>{kpis.vsPrevPct > 0 ? '+' : ''}{kpis.vsPrevPct.toFixed(1)}%</span></span>}
            </div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>Promedio Mensual</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmt(kpis.avgMonthly, currency)}</div>
          </div>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>% sobre Ingresos</div>
            <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpis.pctIncome > 100 ? 'var(--color-expense)' : 'var(--text-primary)' }}>
              {kpis.pctIncome !== null ? `${kpis.pctIncome.toFixed(1)}%` : '–'}
            </div>
          </div>
        </div>

        {/* Stacked bar chart */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Evolución mensual de gastos</div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <ComposedChart data={barData} barCategoryGap="15%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v, currency)} width={60} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} width={45} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {Object.keys(catColors).map(catId => (
                  <Bar key={catId} yAxisId="left" dataKey={catMap[catId]?.name || catId} stackId="expenses" fill={catColors[catId]} />
                ))}
                <Line yAxisId="right" type="monotone" dataKey="% Ingresos" stroke="#a855f7" strokeWidth={2} dot={{ fill: '#a855f7', r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie + Table row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 1fr) minmax(300px, 2fr)', gap: 16 }}>
          {/* Pie chart */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Distribución</div>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                {[{k:'category',l:'Cat'},{k:'subcategory',l:'Sub'},{k:'concept',l:'Con'}].map(o => (
                  <button key={o.k} onClick={() => setPieGroup(o.k)} style={{
                    padding: '3px 8px', borderRadius: 4, border: 'none',
                    background: pieGroup === o.k ? 'var(--color-accent)' : 'transparent',
                    color: pieGroup === o.k ? '#fff' : 'var(--text-dim)',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div style={{ width: '100%', height: 250 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2} label={({ name, percent }) => percent > 0.05 ? `${(percent*100).toFixed(0)}%` : ''} labelLine={false} style={{ fontSize: 10 }}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => fmt(value, currency)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginTop: 8 }}>
              {pieData.slice(0, 10).map((d, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Detalle</div>
              <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', padding: 2 }}>
                {[{k:'concept',l:'Concepto'},{k:'description',l:'Descripción'}].map(o => (
                  <button key={o.k} onClick={() => setTableGroup(o.k)} style={{
                    padding: '3px 10px', borderRadius: 4, border: 'none',
                    background: tableGroup === o.k ? 'var(--color-accent)' : 'transparent',
                    color: tableGroup === o.k ? '#fff' : 'var(--text-dim)',
                    fontSize: 10, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                  }}>{o.l}</button>
                ))}
              </div>
            </div>
            <div style={{ overflow: 'auto', maxHeight: 360 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-strong)' }}>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'left' }}>
                      {tableGroup === 'concept' ? 'Sub / Concepto' : 'Concepto / Descripción'}
                    </th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Total</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>% Ing.</th>
                    <th style={{ padding: '6px 8px', fontSize: 10, fontWeight: 600, color: 'var(--text-dim)', textTransform: 'uppercase', textAlign: 'right' }}>Prom/m</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{row.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{row.parent}</div>
                      </td>
                      <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--color-expense-light)' }}>{fmt(row.total, currency)}</td>
                      <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--text-muted)' }}>{row.pctIncome}%</td>
                      <td style={{ padding: '6px 8px', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', color: 'var(--text-muted)' }}>{fmt(row.avg, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
