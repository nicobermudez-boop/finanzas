import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { RefreshCw, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { SkeletonConfig } from '../../components/Skeleton'

export default function RatesTab() {
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const [result, setResult] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [latestRate, setLatestRate] = useState(null)
  const [latestRateDate, setLatestRateDate] = useState(null)
  const [ratesCount, setRatesCount] = useState(0)

  async function loadStats() {
    setLoading(true)
    const today = new Date().toISOString().slice(0, 10)
    const [{ count: pending }, { data: rateData }, { count: rc }] = await Promise.all([
      supabase.from('transactions').select('*', { count: 'exact', head: true }).lte('date', today).is('exchange_rate', null),
      supabase.from('exchange_rates').select('rate, date').order('date', { ascending: false }).limit(1).single(),
      supabase.from('exchange_rates').select('*', { count: 'exact', head: true }),
    ])
    setPendingCount(pending || 0)
    if (rateData) { setLatestRate(rateData.rate); setLatestRateDate(rateData.date) }
    setRatesCount(rc || 0)
    setLoading(false)
  }

  useEffect(() => { loadStats() }, [])

  async function runUpdate() {
    setUpdating(true); setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('https://uujhejfkbdjgerbbqwtv.supabase.co/functions/v1/update-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (data.success) { setResult({ type: 'success', data }); await loadStats() }
      else setResult({ type: 'error', msg: data.error || 'Error desconocido' })
    } catch (e) { setResult({ type: 'error', msg: e.message }) }
    setUpdating(false)
  }

  const fmtDate = (d) => { if (!d) return '–'; const [y, m, day] = d.split('-'); return `${day}/${m}/${y}` }
  const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }
  const statS = { fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '-0.02em' }
  const labelS = { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }

  if (loading) return <SkeletonConfig />

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <div style={cardS}><div style={labelS}>Última cotización</div><div style={{ ...statS, color: 'var(--color-income)' }}>{latestRate ? `$${latestRate.toLocaleString('es-AR')}` : '–'}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{latestRateDate ? fmtDate(latestRateDate) : 'Sin datos'}</div></div>
        <div style={cardS}><div style={labelS}>Registros pendientes</div><div style={{ ...statS, color: pendingCount > 0 ? 'var(--color-expense)' : 'var(--text-dim)' }}>{pendingCount}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>{pendingCount > 0 ? 'Sin cotización asignada' : 'Todo actualizado'}</div></div>
        <div style={cardS}><div style={labelS}>Cotizaciones guardadas</div><div style={{ ...statS, color: 'var(--color-savings)' }}>{ratesCount}</div><div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>Días con cotización en DB</div></div>
      </div>
      <div style={{ ...cardS, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div><div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Actualizar cotizaciones</div><div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>Consulta la API del dólar MEP, guarda la cotización de hoy y actualiza registros pendientes.</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <button onClick={runUpdate} disabled={updating} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: updating ? 'not-allowed' : 'pointer', opacity: updating ? 0.6 : 1, fontFamily: 'inherit' }}>
            {updating ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={16} />}{updating ? 'Actualizando...' : 'Actualizar ahora'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-dim)' }}><Clock size={13} /><span>Automático: todos los días a las 20:00 ARG</span></div>
        </div>
        {result && (
          <div style={{ padding: '12px 16px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'flex-start', gap: 10, ...(result.type === 'success' ? { background: 'var(--color-income-bg)', border: '1px solid var(--color-income-border)' } : { background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)' }) }}>
            {result.type === 'success' ? <CheckCircle size={16} style={{ color: 'var(--color-income)', flexShrink: 0, marginTop: 2 }} /> : <AlertCircle size={16} style={{ color: 'var(--color-expense)', flexShrink: 0, marginTop: 2 }} />}
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              {result.type === 'success' ? (<><div style={{ fontWeight: 600, color: 'var(--color-income)' }}>Actualización exitosa</div><div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>Cotización: <strong style={{ fontFamily: "'JetBrains Mono', monospace" }}>${result.data.today_rate?.toLocaleString('es-AR')}</strong> · Actualizados: <strong>{result.data.transactions_updated}</strong>/{result.data.pending_found}</div></>) : (<><div style={{ fontWeight: 600, color: 'var(--color-expense)' }}>Error</div><div style={{ color: 'var(--text-secondary)' }}>{result.msg}</div></>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
