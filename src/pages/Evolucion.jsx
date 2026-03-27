import { useState, useEffect, useMemo } from 'react'
import { fetchAllTransactions } from '../lib/fetchAll'
import CurrencyToggle from '../components/CurrencyToggle'
import { usePrivacy } from '../context/PrivacyContext'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { fmtCompact as fmt, fmtLabel } from '../lib/format'

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

const VIEWS = [
  { key: 'gastos', label: 'Gastos', color: '#ef4444', colorLight: '#fca5a5' },
  { key: 'ingresos', label: 'Ingresos', color: '#22c55e', colorLight: '#86efac' },
  { key: 'ahorro', label: 'Ahorro', color: '#3b82f6', colorLight: '#93c5fd' },
]

function CustomTooltip({ active, payload, label, currency, hideNumbers }) {
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
            {hideNumbers ? '••••••' : fmt(p.value, currency)}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Evolucion() {
  const { hideNumbers } = usePrivacy()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [currency, setCurrency] = useState('ARS')
  const [view, setView] = useState('gastos')
  const [excludeViajes, setExcludeViajes] = useState(false)
  const [excludeExtra, setExcludeExtra] = useState(false)

  const [nowYear] = useState(() => new Date().getFullYear())
  const [baseYear, setBaseYear] = useState(nowYear)
  const compYear = baseYear - 1

  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date + 'T00:00:00').getFullYear()).filter(y => !isNaN(y)))
    years.add(nowYear)
    return [...years].filter(y => y <= nowYear).sort((a, b) => b - a)
  }, [transactions, nowYear])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      const fromDate = `${nowYear - 5}-01-01`
      const data = await fetchAllTransactions(null, { select: '*, categories(name)', gte: [['date', fromDate]], orderCol: 'date', orderAsc: true })
      setTransactions(data)
      setLoading(false)
    }
    fetchData()
  }, [nowYear])

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
    for (const year of [compYear, baseYear]) {
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
      const curKey = `${baseYear}-${m}`
      const prevKey = `${compYear}-${m}`
      const cur = monthly[curKey] || { income: 0, expense: 0 }
      const prev = monthly[prevKey] || { income: 0, expense: 0 }

      const getValue = (d) => {
        if (view === 'gastos') return d.expense
        if (view === 'ingresos') return d.income
        return d.income - d.expense // ahorro
      }

      return {
        name: label,
        [baseYear]: Math.round(getValue(cur)),
        [compYear]: Math.round(getValue(prev)),
      }
    })

    // Build cumulative data
    const curMonthIdx = new Date().getMonth()
    let cumCur = 0, cumPrev = 0
    const cData = mData.map((d, i) => {
      cumPrev += d[compYear]
      const future = baseYear === nowYear && i > curMonthIdx - 1
      if (!future) cumCur += d[baseYear]
      return {
        name: d.name,
        [baseYear]: future ? null : Math.round(cumCur),
        [compYear]: Math.round(cumPrev),
      }
    })

    return { monthlyData: mData, cumulativeData: cData }
  }, [transactions, currency, view, excludeViajes, excludeExtra, baseYear, compYear, nowYear])

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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select value={baseYear} onChange={e => setBaseYear(Number(e.target.value))} style={{
              padding: '6px 28px 6px 10px', background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)', fontSize: 13, fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 600, cursor: 'pointer', outline: 'none', appearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
            }}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <CurrencyToggle currency={currency} onChange={setCurrency} />
          </div>
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
                  tickFormatter={v => hideNumbers ? '•••' : fmt(v, currency)}
                  width={65}
                  domain={[0, dataMax => Math.round(dataMax * 1.15)]}
                />
                <Tooltip content={<CustomTooltip currency={currency} hideNumbers={hideNumbers} />} />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text-muted)' }} />
                <Bar
                  dataKey={compYear.toString()}
                  name={compYear.toString()}
                  fill={activeView.colorLight}
                  opacity={0.35}
                  radius={[3, 3, 0, 0]}
                  label={{ position: 'top', fill: 'var(--text-dim)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", formatter: v => hideNumbers ? '' : (v ? fmtLabel(v, currency) : '') }}
                />
                <Bar
                  dataKey={baseYear.toString()}
                  name={baseYear.toString()}
                  fill={activeView.color}
                  radius={[3, 3, 0, 0]}
                  label={{ position: 'top', fill: 'var(--text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", formatter: v => hideNumbers ? '' : (v ? fmtLabel(v, currency) : '') }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative line chart */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>
            {activeView.label} — Acumulado {baseYear}
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
                  tickFormatter={v => hideNumbers ? '•••' : fmt(v, currency)}
                  width={65}
                  domain={[0, dataMax => Math.round(dataMax * 1.12)]}
                />
                <Tooltip content={<CustomTooltip currency={currency} hideNumbers={hideNumbers} />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  type="monotone"
                  dataKey={compYear.toString()}
                  stroke={activeView.colorLight}
                  strokeWidth={2}
                  strokeOpacity={0.4}
                  strokeDasharray="6 3"
                  dot={false}
                  label={{ position: 'bottom', fill: 'var(--text-dim)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", formatter: v => hideNumbers ? '' : (v ? fmtLabel(v, currency) : '') }}
                />
                <Line
                  type="monotone"
                  dataKey={baseYear.toString()}
                  name={baseYear.toString()}
                  stroke={activeView.color}
                  strokeWidth={2.5}
                  dot={{ fill: activeView.color, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  label={{ position: 'top', fill: 'var(--text-muted)', fontSize: 9, fontFamily: "'JetBrains Mono', monospace", formatter: v => hideNumbers ? '' : (v ? fmtLabel(v, currency) : '') }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}
