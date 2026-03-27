import { useState, useEffect, useMemo } from 'react'
import { fetchAllTransactions } from '../lib/fetchAll'
import CurrencyToggle from '../components/CurrencyToggle'
import { usePrivacy } from '../context/PrivacyContext'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line
} from 'recharts'
import { Loader2 } from 'lucide-react'
import { fmt, fmtCompact } from '../lib/format'
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

function CustomTooltip({ active, payload, label, currency, hideNumbers }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.stroke }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{hideNumbers ? '••••••' : fmt(p.value, currency)}</span>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { hideNumbers } = usePrivacy()
  const H = (s) => hideNumbers ? '••••••' : s
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [currency, setCurrency] = useState('ARS')
  const [period, setPeriod] = useState('ytd')
  const [now0] = useState(() => new Date())
  const defYear = now0.getMonth() === 0 ? now0.getFullYear() - 1 : now0.getFullYear()
  const defMonth = now0.getMonth() === 0 ? 11 : now0.getMonth() - 1
  const [baseYear, setBaseYear] = useState(defYear)
  const [baseMonthIdx, setBaseMonthIdx] = useState(defMonth)
  const [excludeViajes, setExcludeViajes] = useState(false)
  const [excludeExtra, setExcludeExtra] = useState(false)

  async function loadData() {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await fetchAllTransactions(null, { select: '*, categories(name)', orderCol: 'date', orderAsc: true })
      setTransactions(data)
    } catch (e) {
      console.error('Error loading dashboard:', e)
      setLoadError('No se pudo cargar el dashboard. Revisá tu conexión e intentá de nuevo.')
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const { kpis, chartData } = useMemo(() => {
    let filtered = [...transactions]
    if (excludeViajes) filtered = filtered.filter(t => t.categories?.name !== 'Viajes')
    if (excludeExtra) filtered = filtered.filter(t => t.income_subtype !== 'extraordinario')

    const endDate = new Date(baseYear, baseMonthIdx + 1, 0)
    let startDate

    if (period === 'all') {
      const times = filtered.map(t => new Date(t.date + 'T00:00:00').getTime()).filter(x => !isNaN(x))
      if (times.length) {
        const minD = new Date(Math.min(...times))
        startDate = new Date(minD.getFullYear(), minD.getMonth(), 1)
      } else {
        startDate = new Date(baseYear, 0, 1)
      }
    } else if (period === 'ytd') {
      startDate = new Date(baseYear, 0, 1)
    } else {
      const m = { '1m': 1, '3m': 3, '6m': 6, '1y': 12 }[period]
      startDate = new Date(endDate.getFullYear(), endDate.getMonth() - m + 1, 1)
    }

    const totalMonths = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1

    // Previous period
    let prevStart, prevEnd
    if (period === 'ytd' || period === 'all') {
      prevStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), 1)
      prevEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())
    } else {
      prevEnd = new Date(startDate); prevEnd.setDate(prevEnd.getDate() - 1)
      prevStart = new Date(prevEnd.getFullYear(), prevEnd.getMonth() - totalMonths + 1, 1)
    }

    // Year-ago range
    const yaStart = new Date(startDate.getFullYear() - 1, startDate.getMonth(), startDate.getDate())
    const yaEnd = new Date(endDate.getFullYear() - 1, endDate.getMonth(), endDate.getDate())

    const inRange = (t, s, e) => { const d = new Date(t.date + 'T00:00:00'); return d >= s && d <= e }
    const current = filtered.filter(t => inRange(t, startDate, endDate))
    const previous = filtered.filter(t => inRange(t, prevStart, prevEnd))
    const yearAgo = filtered.filter(t => inRange(t, yaStart, yaEnd))

    const sum = (txs, type) => txs.filter(t => t.type === type).reduce((s, t) => s + getAmount(t, currency), 0)
    const curIncome = sum(current, 'income'), curExpense = sum(current, 'expense'), curSavings = curIncome - curExpense
    const prevIncome = sum(previous, 'income'), prevExpense = sum(previous, 'expense'), prevSavings = prevIncome - prevExpense
    const yaIncome = sum(yearAgo, 'income'), yaExpense = sum(yearAgo, 'expense'), yaSavings = yaIncome - yaExpense

    const variation = (cur, prev) => (!prev || prev === 0) ? null : ((cur - prev) / Math.abs(prev)) * 100

    // Grouping: quarters if >12 months
    const useQuarters = totalMonths > 12
    const bucketMap = {}
    current.forEach(t => {
      const d = new Date(t.date + 'T00:00:00')
      let key, label
      if (useQuarters) {
        const q = Math.floor(d.getMonth() / 3) + 1
        key = `${d.getFullYear()}-Q${q}`; label = `Q${q} ${String(d.getFullYear()).slice(2)}`
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        label = MONTHS_SHORT[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2)
      }
      if (!bucketMap[key]) bucketMap[key] = { label, income: 0, expense: 0 }
      const amt = getAmount(t, currency)
      if (t.type === 'income') bucketMap[key].income += amt; else bucketMap[key].expense += amt
    })

    const buckets = []
    const seen = new Set()
    const iter = new Date(startDate)
    while (iter <= endDate) {
      let key, label
      if (useQuarters) {
        const q = Math.floor(iter.getMonth() / 3) + 1
        key = `${iter.getFullYear()}-Q${q}`; label = `Q${q} ${String(iter.getFullYear()).slice(2)}`
        iter.setMonth(iter.getMonth() + 3)
      } else {
        key = `${iter.getFullYear()}-${String(iter.getMonth() + 1).padStart(2, '0')}`
        label = MONTHS_SHORT[iter.getMonth()] + ' ' + String(iter.getFullYear()).slice(2)
        iter.setMonth(iter.getMonth() + 1)
      }
      if (!seen.has(key)) {
        seen.add(key)
        const data = bucketMap[key] || { income: 0, expense: 0 }
        buckets.push({ name: label, Ingresos: Math.round(data.income), Gastos: Math.round(data.expense), Ahorro: Math.round(data.income - data.expense) })
      }
    }

    const numMonths = totalMonths || 1

    return {
      kpis: {
        months: numMonths,
        income: { value: curIncome, diff: curIncome - prevIncome, pct: variation(curIncome, prevIncome), yaDiff: curIncome - yaIncome, yaPct: variation(curIncome, yaIncome), avg: curIncome / numMonths },
        expense: { value: curExpense, diff: curExpense - prevExpense, pct: variation(curExpense, prevExpense), yaDiff: curExpense - yaExpense, yaPct: variation(curExpense, yaExpense), avg: curExpense / numMonths },
        savings: { value: curSavings, diff: curSavings - prevSavings, pct: variation(curSavings, prevSavings), yaDiff: curSavings - yaSavings, yaPct: variation(curSavings, yaSavings), avg: curSavings / numMonths },
      },
      chartData: buckets,
    }
  }, [transactions, currency, period, baseYear, baseMonthIdx, excludeViajes, excludeExtra])

  const kpiCards = [
    { label: 'Ingresos', ...kpis.income, color: 'var(--color-income)', upIsGood: true, months: kpis.months },
    { label: 'Gastos', ...kpis.expense, color: 'var(--color-expense)', upIsGood: false, months: kpis.months },
    { label: 'Ahorro', ...kpis.savings, color: 'var(--color-savings, #3b82f6)', upIsGood: true, months: kpis.months },
  ]

  // Available years from transactions
  const availableYears = useMemo(() => {
    const years = new Set(transactions.map(t => new Date(t.date + 'T00:00:00').getFullYear()).filter(y => !isNaN(y)))
    years.add(defYear)
    return [...years].filter(y => y <= now0.getFullYear()).sort()
  }, [transactions, defYear, now0])

  const maxMonth = baseYear === now0.getFullYear() ? now0.getMonth() : 11 // 0-indexed, includes current month
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

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Cargando...</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Error al cargar</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{loadError}</div>
        <button onClick={loadData} style={{
          padding: '10px 24px', background: 'var(--color-accent)', color: '#fff',
          border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>Reintentar</button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <CurrencyToggle currency={currency} onChange={setCurrency} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            <select value={baseYear} onChange={e => handleYearChange(Number(e.target.value))} style={selectStyle}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={baseMonthIdx} onChange={e => setBaseMonthIdx(Number(e.target.value))} style={selectStyle}>
              {MONTHS_SHORT.map((m, i) => i <= maxMonth || baseYear < now0.getFullYear() ? <option key={i} value={i}>{m}</option> : null)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setExcludeViajes(!excludeViajes)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: '1px solid',
              ...(excludeViajes
                ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
            }}>✈️ Viajes</button>
            <button onClick={() => setExcludeExtra(!excludeExtra)} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              cursor: 'pointer', transition: 'all 0.15s', fontFamily: 'inherit', border: '1px solid',
              ...(excludeExtra
                ? { background: 'var(--color-expense-bg)', borderColor: 'var(--color-expense-border)', color: 'var(--color-expense-light)', textDecoration: 'line-through' }
                : { background: 'var(--color-accent-bg)', borderColor: 'rgba(139,92,246,0.3)', color: 'var(--color-accent)' }),
            }}>💰 Extraordinarios</button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>
        {/* KPI Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 28 }}>
          {kpiCards.map(kpi => {
            const vc = (diff, up) => Math.abs(diff) < 0.01 ? 'var(--text-dim)' : (diff > 0 === up) ? 'var(--color-income)' : 'var(--color-expense)'
            const yaAvgDiff = kpi.yaDiff / (kpi.months || 1)
            const prevAvgDiff = kpi.diff / (kpi.months || 1)
            return (
              <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', display: 'flex', gap: 0 }}>
                {/* Left: total + variations */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>{kpi.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpi.color, letterSpacing: '-0.02em', marginBottom: 8 }}>
                    {H(fmt(kpi.value, currency))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                    {kpi.yaPct !== null && <div>vs YA: <span style={{ color: vc(kpi.yaDiff, kpi.upIsGood), fontWeight: 600 }}>{kpi.yaPct >= 0 ? '+' : ''}{kpi.yaPct.toFixed(1)}%</span> <span style={{ color: vc(kpi.yaDiff, kpi.upIsGood) }}>({H(`${kpi.yaDiff >= 0 ? '+' : ''}${fmtCompact(kpi.yaDiff, currency)}`)})</span></div>}
                    {kpi.pct !== null && <div>vs Per: <span style={{ color: vc(kpi.diff, kpi.upIsGood), fontWeight: 600 }}>{kpi.pct >= 0 ? '+' : ''}{kpi.pct.toFixed(1)}%</span> <span style={{ color: vc(kpi.diff, kpi.upIsGood) }}>({H(`${kpi.diff >= 0 ? '+' : ''}${fmtCompact(kpi.diff, currency)}`)})</span></div>}
                  </div>
                </div>
                {/* Divider */}
                <div style={{ width: 1, background: 'var(--border-subtle)', margin: '0 16px', flexShrink: 0 }} />
                {/* Right: avg/mes */}
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', minWidth: 80 }}>
                  <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-dim)', marginBottom: 4 }}>Prom/mes</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-muted)', marginBottom: 6 }}>
                    {H(fmtCompact(kpi.avg, currency))}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', lineHeight: 1.7, textAlign: 'right' }}>
                    {kpi.yaPct !== null && <div style={{ color: vc(kpi.yaDiff, kpi.upIsGood) }}>YA {H(`${yaAvgDiff >= 0 ? '+' : ''}${fmtCompact(yaAvgDiff, currency)}`)}</div>}
                    {kpi.pct !== null && <div style={{ color: vc(kpi.diff, kpi.upIsGood) }}>Per {H(`${prevAvgDiff >= 0 ? '+' : ''}${fmtCompact(prevAvgDiff, currency)}`)}</div>}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Cashflow Chart - no averages header */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16 }}>Cashflow</div>
          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={{ stroke: 'var(--border-subtle)' }} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => hideNumbers ? '•••' : fmtCompact(v, currency)} width={60} />
                <Tooltip content={<CustomTooltip currency={currency} hideNumbers={hideNumbers} />} />
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
