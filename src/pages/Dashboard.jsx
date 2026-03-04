import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CurrencyToggle from '../components/CurrencyToggle'
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ComposedChart, Bar, Line
} from 'recharts'
import { Loader2 } from 'lucide-react'

const PERIODS = [
  { key: 'all', label: 'All' },
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
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value)
}

function fmtCompact(value, currency) {
  if (value === null || value === undefined || isNaN(value)) return '–'
  const opts = { minimumFractionDigits: 1, maximumFractionDigits: 1, notation: 'compact' }
  if (currency === 'USD') return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...opts }).format(value)
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', ...opts }).format(value)
}

function CustomTooltip({ active, payload, label, currency }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, boxShadow: 'var(--shadow-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-primary)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color || p.stroke }} />
          <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
          <span style={{ fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", color: 'var(--text-primary)' }}>{fmt(p.value, currency)}</span>
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
      const { data } = await supabase.from('transactions').select('*, categories(name)').order('date', { ascending: true }).limit(10000)
      setTransactions(data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const { kpis, chartData } = useMemo(() => {
    let filtered = [...transactions]
    if (excludeViajes) filtered = filtered.filter(t => t.categories?.name !== 'Viajes')
    if (excludeExtra) filtered = filtered.filter(t => t.income_subtype !== 'extraordinario')

    const now = new Date()
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0)
    let startDate

    if (period === 'all') {
      const times = filtered.map(t => new Date(t.date + 'T00:00:00').getTime()).filter(x => !isNaN(x))
      if (times.length) {
        const minD = new Date(Math.min(...times))
        startDate = new Date(minD.getFullYear(), minD.getMonth(), 1)
      } else {
        startDate = new Date(now.getFullYear(), 0, 1)
      }
    } else if (period === 'ytd') {
      startDate = new Date(now.getFullYear(), 0, 1)
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
        income: { value: curIncome, diff: curIncome - prevIncome, pct: variation(curIncome, prevIncome), yaDiff: curIncome - yaIncome, yaPct: variation(curIncome, yaIncome), avg: curIncome / numMonths },
        expense: { value: curExpense, diff: curExpense - prevExpense, pct: variation(curExpense, prevExpense), yaDiff: curExpense - yaExpense, yaPct: variation(curExpense, yaExpense), avg: curExpense / numMonths },
        savings: { value: curSavings, diff: curSavings - prevSavings, pct: variation(curSavings, prevSavings), yaDiff: curSavings - yaSavings, yaPct: variation(curSavings, yaSavings), avg: curSavings / numMonths },
      },
      chartData: buckets,
    }
  }, [transactions, currency, period, excludeViajes, excludeExtra])

  const kpiCards = [
    { label: 'Ingresos', ...kpis.income, color: 'var(--color-income)', upIsGood: true },
    { label: 'Gastos', ...kpis.expense, color: 'var(--color-expense)', upIsGood: false },
    { label: 'Ahorro', ...kpis.savings, color: 'var(--color-savings, #3b82f6)', upIsGood: true },
  ]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /><span>Cargando...</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div className="page-header" style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>Dashboard</h1>
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
            return (
              <div key={kpi.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 8 }}>{kpi.label}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", color: kpi.color, letterSpacing: '-0.02em' }}>
                    {fmt(kpi.value, currency)}
                  </div>
                  <div style={{ fontSize: 11, color: kpi.color, opacity: 0.55, fontFamily: "'JetBrains Mono', monospace" }}>
                    prom/mes {fmtCompact(kpi.avg, currency)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  {kpi.yaPct !== null && <div>vs año ant: <span style={{ color: vc(kpi.yaDiff, kpi.upIsGood), fontWeight: 600 }}>{kpi.yaPct >= 0 ? '+' : ''}{kpi.yaPct.toFixed(1)}%</span> <span style={{ color: vc(kpi.yaDiff, kpi.upIsGood) }}>({kpi.yaDiff >= 0 ? '+' : ''}{fmtCompact(kpi.yaDiff, currency)})</span></div>}
                  {kpi.pct !== null && <div>vs per. ant: <span style={{ color: vc(kpi.diff, kpi.upIsGood), fontWeight: 600 }}>{kpi.pct >= 0 ? '+' : ''}{kpi.pct.toFixed(1)}%</span> <span style={{ color: vc(kpi.diff, kpi.upIsGood) }}>({kpi.diff >= 0 ? '+' : ''}{fmtCompact(kpi.diff, currency)})</span></div>}
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
