import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart
} from 'recharts'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'

const PERIODS = [
  { key: 'ytd', label: 'YTD' },
  { key: '1m', label: '1m' },
  { key: '3m', label: '3m' },
  { key: '6m', label: '6m' },
  { key: '1y', label: '1y' },
]

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

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
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  }
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function fmtCompact(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0, notation: 'compact' }).format(value)
  }
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0, notation: 'compact' }).format(value)
}

// Get period date range (always ending at last completed month)
function getPeriodRange(period) {
  const now = new Date()
  const lastCompletedMonth = now.getMonth() === 0
    ? new Date(now.getFullYear() - 1, 11, 1)
    : new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const endDate = new Date(now.getFullYear(), now.getMonth(), 0) // last day of prev month

  let startDate
  if (period === 'ytd') {
    startDate = new Date(now.getFullYear(), 0, 1)
    // End is last day of last completed month
  } else {
    const months = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[period]
    startDate = new Date(endDate.getFullYear(), endDate.getMonth() - months + 1, 1)
  }

  return { startDate, endDate }
}

function getPrevPeriodRange(period) {
  const { startDate, endDate } = getPeriodRange(period)
  const durationMs = endDate.getTime() - startDate.getTime()
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1

  const prevEnd = new Date(startDate)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - monthsDiff + 1, 1)

  // For YTD, same months last year
  if (period === 'ytd') {
    return {
      startDate: new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1),
      endDate: new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate()),
    }
  }

  return { startDate: prevStart, endDate: prevEnd }
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.stroke }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {fmt(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('ARS')
  const [period, setPeriod] = useState('ytd')
  const [excludeViajes, setExcludeViajes] = useState(false)
  const [excludeExtra, setExcludeExtra] = useState(false)

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .order('date', { ascending: true })
      setTransactions(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const { kpis, chartData } = useMemo(() => {
    const { startDate, endDate } = getPeriodRange(period)
    const prev = getPrevPeriodRange(period)

    let filtered = [...transactions]
    if (excludeViajes) filtered = filtered.filter(t => t.categories?.name !== 'Viajes')
    if (excludeExtra) filtered = filtered.filter(t => t.income_subtype !== 'extraordinario')

    const inRange = (t, start, end) => {
      const d = new Date(t.date + 'T00:00:00')
      return d >= start && d <= end
    }

    const current = filtered.filter(t => inRange(t, startDate, endDate))
    const previous = filtered.filter(t => inRange(t, prev.startDate, prev.endDate))

    const sum = (txs, type) => txs.filter(t => t.type === type).reduce((s, t) => s + getAmount(t, currency), 0)

    const curIncome = sum(current, 'income')
    const curExpense = sum(current, 'expense')
    const curSavings = curIncome - curExpense
    const prevIncome = sum(previous, 'income')
    const prevExpense = sum(previous, 'expense')
    const prevSavings = prevIncome - prevExpense

    const variation = (cur, prev) => {
      if (!prev || prev === 0) return null
      return ((cur - prev) / Math.abs(prev)) * 100
    }

    // Monthly chart data
    const monthlyMap = {}
    current.forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyMap[key]) monthlyMap[key] = { income: 0, expense: 0 }
      const amt = getAmount(t, currency)
      if (t.type === 'income') monthlyMap[key].income += amt
      else monthlyMap[key].expense += amt
    })

    // Generate all months in range
    const months = []
    const d = new Date(startDate)
    while (d <= endDate) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = MONTHS_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)
      const data = monthlyMap[key] || { income: 0, expense: 0 }
      months.push({
        name: label,
        Ingresos: Math.round(data.income),
        Gastos: Math.round(data.expense),
        Ahorro: Math.round(data.income - data.expense),
      })
      d.setMonth(d.getMonth() + 1)
    }

    // Number of months for averages
    const numMonths = months.length || 1

    return {
      kpis: {
        income: { value: curIncome, diff: curIncome - prevIncome, pct: variation(curIncome, prevIncome) },
        expense: { value: curExpense, diff: curExpense - prevExpense, pct: variation(curExpense, prevExpense) },
        savings: { value: curSavings, diff: curSavings - prevSavings, pct: variation(curSavings, prevSavings) },
        avgIncome: curIncome / numMonths,
        avgExpense: curExpense / numMonths,
        avgSavings: curSavings / numMonths,
      },
      chartData: months,
    }
  }, [transactions, currency, period, excludeViajes, excludeExtra])

  const kpiCards = [
    { label: 'Ingresos', ...kpis.income, color: 'var(--color-income)', colorBg: 'var(--color-income-bg)', upIsGood: true },
    { label: 'Gastos', ...kpis.expense, color: 'var(--color-expense)', colorBg: 'var(--color-expense-bg)', upIsGood: false },
    { label: 'Ahorro', ...kpis.savings, color: 'var(--color-savings, #3b82f6)', colorBg: 'rgba(59,130,246,0.08)', upIsGood: true },
  ]

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
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          {/* Period toggle */}
          <div style={{ display: 'flex', gap: 3, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 3, border: '1px solid var(--border-subtle)' }}>
            {PERIODS.map(p => (
              <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                padding: '5px 12px', borderRadius: 'var(--radius-sm)', border: 'none',
                background: period === p.key ? 'var(--color-accent)' : 'transparent',
                color: period === p.key ? '#fff' : 'var(--text-muted)',
                fontSize: 12, fontWeight: period === p.key ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setExcludeViajes(!excludeViajes)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: '1px solid',
              ...(excludeViajes
                ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
            }}>
              ✈️ Viajes
            </button>
            <button onClick={() => setExcludeExtra(!excludeExtra)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: '1px solid',
              ...(excludeExtra
                ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
            }}>
              💰 Extraordinarios
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          {kpiCards.map(kpi => {
            const isUp = kpi.diff > 0
            const isNeutral = !kpi.diff || kpi.diff === 0
            const TrendIcon = isNeutral ? Minus : isUp ? TrendingUp : TrendingDown
            const trendColor = isNeutral ? 'var(--text-dim)' : (isUp === kpi.upIsGood) ? 'var(--color-income)' : 'var(--color-expense)'
            return (
              <div key={kpi.label} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)', padding: 20,
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>
                  {kpi.label}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpi.color, letterSpacing: '-0.02em', marginBottom: 8 }}>
                  {fmt(kpi.value, currency)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                  <TrendIcon size={14} style={{ color: trendColor }} />
                  <span style={{ color: trendColor, fontWeight: 600 }}>
                    {kpi.pct !== null ? `${kpi.pct >= 0 ? '+' : ''}${kpi.pct.toFixed(1)}%` : '–'}
                  </span>
                  <span style={{ color: 'var(--text-dim)' }}>
                    ({kpi.diff >= 0 ? '+' : ''}{fmtCompact(kpi.diff, currency)}) vs año ant.
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Cashflow Chart */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)', padding: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Cashflow</div>
            {/* Averages */}
            <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-muted)' }}>
              <div>
                <span>Prom. Ingresos: </span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-income)' }}>
                  {fmtCompact(kpis.avgIncome, currency)}
                </span>
              </div>
              <div>
                <span>Prom. Gastos: </span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--color-expense)' }}>
                  {fmtCompact(kpis.avgExpense, currency)}
                </span>
              </div>
              <div>
                <span>Prom. Ahorro: </span>
                <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: '#3b82f6' }}>
                  {fmtCompact(kpis.avgSavings, currency)}
                </span>
              </div>
            </div>
          </div>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => fmtCompact(v, currency)} width={60} />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Ingresos" fill="#22c55e" opacity={0.8} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Gastos" fill="#ef4444" opacity={0.8} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="Ahorro" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6', r: 3 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
