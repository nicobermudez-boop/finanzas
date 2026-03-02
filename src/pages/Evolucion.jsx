import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Loader2 } from 'lucide-react'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const VIEWS = [
  { key: 'gastos', label: 'Gastos', color: '#ef4444', colorLight: '#fca5a5' },
  { key: 'ingresos', label: 'Ingresos', color: '#22c55e', colorLight: '#86efac' },
  { key: 'ahorro', label: 'Ahorro', color: '#3b82f6', colorLight: '#93c5fd' },
]

function fmt(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  if (currency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 0, maximumFractionDigits: 0,
      notation: 'compact',
    }).format(value)
  }
  return new Intl.NumberFormat('es-AR', {
    style: 'currency', currency: 'ARS',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
    notation: 'compact',
  }).format(value)
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      padding: '10px 14px',
      fontSize: 13,
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>
            {fmt(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Evolucion() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('ARS')
  const [view, setView] = useState('gastos')
  const [excludeViajes, setExcludeViajes] = useState(false)
  const [excludeExtra, setExcludeExtra] = useState(false)

  const currentYear = new Date().getFullYear()
  const prevYear = currentYear - 1

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const fromDate = `${prevYear}-01-01`
      const { data } = await supabase
        .from('transactions')
        .select('*, categories(name)')
        .gte('date', fromDate)
        .order('date', { ascending: true })

      setTransactions(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  // Process data into monthly aggregates
  const { monthlyData, cumulativeData } = useMemo(() => {
    let filtered = [...transactions]

    // Apply filters
    if (excludeViajes) {
      filtered = filtered.filter(t => t.categories?.name !== 'Viajes')
    }
    if (excludeExtra) {
      filtered = filtered.filter(t => t.income_subtype !== 'extraordinario')
    }

    // Aggregate by year-month
    const monthly = {}
    // Init all months for both years
    for (const year of [prevYear, currentYear]) {
      for (let m = 0; m < 12; m++) {
        const key = `${year}-${String(m + 1).padStart(2, '0')}`
        monthly[key] = { income: 0, expense: 0 }
      }
    }

    filtered.forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthly[key]) return

      let amount = 0
      if (currency === 'USD') {
        if (t.amount_usd) amount = parseFloat(t.amount_usd)
        else if (t.currency === 'USD') amount = parseFloat(t.amount) || 0
        else {
          const rate = parseFloat(t.exchange_rate)
          amount = rate ? (parseFloat(t.amount) || 0) / rate : 0
        }
      } else {
        if (t.currency === 'ARS') amount = parseFloat(t.amount) || 0
        else {
          const rate = parseFloat(t.exchange_rate)
          amount = rate ? (parseFloat(t.amount) || 0) * rate : 0
        }
      }

      if (t.type === 'income') {
        monthly[key].income += amount
      } else {
        monthly[key].expense += amount
      }
    })

    // Build chart data (12 months, each with current + prev year)
    const mData = MONTHS.map((label, i) => {
      const m = String(i + 1).padStart(2, '0')
      const curKey = `${currentYear}-${m}`
      const prevKey = `${prevYear}-${m}`
      const cur = monthly[curKey] || { income: 0, expense: 0 }
      const prev = monthly[prevKey] || { income: 0, expense: 0 }

      const getValue = (d) => {
        if (view === 'gastos') return d.expense
        if (view === 'ingresos') return d.income
        return d.income - d.expense // ahorro
      }

      return {
        name: label,
        [currentYear]: Math.round(getValue(cur)),
        [prevYear]: Math.round(getValue(prev)),
      }
    })

    // Build cumulative data
    let cumCur = 0, cumPrev = 0
    const cData = mData.map(d => {
      cumCur += d[currentYear]
      cumPrev += d[prevYear]
      return {
        name: d.name,
        [currentYear]: Math.round(cumCur),
        [prevYear]: Math.round(cumPrev),
      }
    })

    return { monthlyData: mData, cumulativeData: cData }
  }, [transactions, currency, view, excludeViajes, excludeExtra, currentYear, prevYear])

  const activeView = VIEWS.find(v => v.key === view)

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
      <div className="page-header" style={{
        padding: '20px 24px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Evolución</h1>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
        </div>

        {/* View toggle + filter chips */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          {/* View buttons */}
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            padding: 3,
            border: '1px solid var(--border-subtle)',
          }}>
            {VIEWS.map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: view === v.key ? v.color : 'transparent',
                  color: view === v.key ? '#fff' : 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: view === v.key ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit',
                }}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => setExcludeViajes(!excludeViajes)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 20,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s ease', fontFamily: 'inherit',
                border: '1px solid',
                ...(excludeViajes
                  ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                  : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139, 92, 246, 0.3)', color: 'var(--color-accent)' }
                ),
              }}
            >
              ✈️ Viajes {excludeViajes && <span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>}
            </button>
            <button
              onClick={() => setExcludeExtra(!excludeExtra)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 14px', borderRadius: 20,
                fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 0.15s ease', fontFamily: 'inherit',
                border: '1px solid',
                ...(excludeExtra
                  ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                  : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139, 92, 246, 0.3)', color: 'var(--color-accent)' }
                ),
              }}
            >
              💰 Extraordinarios {excludeExtra && <span style={{ fontSize: 11, opacity: 0.7 }}>✕</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* Monthly bar chart */}
        <div style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {activeView.label} — Mensual
          </h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => fmt(v, currency)}
                  width={65}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend
                  wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }}
                />
                <Bar
                  dataKey={prevYear.toString()}
                  name={prevYear.toString()}
                  fill={activeView.colorLight}
                  opacity={0.35}
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey={currentYear.toString()}
                  name={currentYear.toString()}
                  fill={activeView.color}
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative line chart */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {activeView.label} — Acumulado {currentYear}
          </h2>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={cumulativeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={{ stroke: 'var(--border-subtle)' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => fmt(v, currency)}
                  width={65}
                />
                <Tooltip content={<CustomTooltip currency={currency} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey={prevYear.toString()}
                  name={prevYear.toString()}
                  stroke={activeView.colorLight}
                  strokeWidth={2}
                  strokeOpacity={0.4}
                  strokeDasharray="6 3"
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey={currentYear.toString()}
                  name={currentYear.toString()}
                  stroke={activeView.color}
                  strokeWidth={2.5}
                  dot={{ fill: activeView.color, r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
