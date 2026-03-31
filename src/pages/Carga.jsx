import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { createTransaction, previewTransaction, getRecentTransactions } from '../lib/transactions'
import { getLatestRate } from '../lib/exchangeRate'
import { useAuth } from '../context/AuthContext'
import SelectionPills from '../components/SelectionPills'
import CategoryGrid from '../components/CategoryGrid'
import RecentTransactions from '../components/RecentTransactions'
import { fmtForm as fmt, fmtInput } from '../lib/format'
import useIsMobile from '../hooks/useIsMobile'
import { SkeletonForm } from '../components/Skeleton'

const INCOME_CONCEPTS = [
  { name: 'Sueldo', icon: '💰', defaultSubtype: 'recurrente' },
  { name: 'Bono', icon: '🎯', defaultSubtype: 'extraordinario' },
  { name: 'Rentas', icon: '🏠', defaultSubtype: 'recurrente' },
  { name: 'Otros', icon: '📋', defaultSubtype: 'extraordinario' }
]

const PAY_METHODS = [
  { value: 'Contado', label: 'Contado', icon: '💵' },
  { value: 'Crédito', label: 'Crédito', icon: '💳' }
]

const FREQS = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quincenal' },
  { value: 'yearly', label: 'Anual' }
]

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
function fmtDateShort(d) {
  const [, m, day] = d.split('-')
  return `${day} ${MONTH_NAMES[parseInt(m, 10) - 1]}`
}
function fmtDateLong(d) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function PreviewModal({ preview, currency, catName, personName, confirming, onConfirm, onClose }) {
  const { type, items, duplicate } = preview
  const total = items.reduce((s, i) => s + i.amount, 0)
  const firstDate = items[0]?.date
  const lastDate = items[items.length - 1]?.date

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: 'fadeIn 0.2s ease',
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        width: '100%', maxWidth: 520, background: 'var(--bg-card)',
        borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        padding: '20px 20px 32px', boxShadow: '0 -8px 40px rgba(0,0,0,0.3)',
        animation: 'slideUp 0.25s ease',
        maxHeight: '80vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
            Confirmar {type === 'installments' ? 'cuotas' : type === 'recurring' ? 'recurrencia' : 'transacción'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: '0 4px' }}>×</button>
        </div>

        {duplicate && (
          <div style={{
            background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)',
            borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 14,
            fontSize: 12, color: '#b45309', lineHeight: 1.5,
          }}>
            ⚠️ Ya existe una transacción similar el {fmtDateLong(duplicate.date)} por {fmt(duplicate.amount, duplicate.currency)}. Podés confirmar igual.
          </div>
        )}

        {/* Summary line */}
        <div style={{
          background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
          padding: '12px 14px', marginBottom: 14,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            {catName && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{catName}</div>}
            {personName && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{personName}</div>}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 16, color: 'var(--color-accent)' }}>
            {fmt(total, currency)}
          </div>
        </div>

        {/* Item list */}
        {(type === 'installments' || type === 'recurring') && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8, paddingLeft: 2 }}>
              {type === 'installments'
                ? `${items.length} cuotas · ${fmtDateShort(firstDate)} → ${fmtDateShort(lastDate)}`
                : `${items.length} períodos · ${fmtDateShort(firstDate)} → ${fmtDateShort(lastDate)}`}
            </div>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              {items.map(item => (
                <div key={item.number} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '7px 10px', borderRadius: 'var(--radius-sm)',
                  background: item.number % 2 === 0 ? 'transparent' : 'var(--bg-tertiary)',
                  fontSize: 12,
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {type === 'installments' ? `Cuota ${item.number}/${items.length}` : `#${item.number}`}
                    {' · '}{fmtDateShort(item.date)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmt(item.amount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {type === 'simple' && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
            Fecha: {fmtDateLong(firstDate)}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={confirming} style={{
            flex: 1, padding: '12px', border: '1.5px solid var(--border-default)',
            background: 'var(--bg-secondary)', color: 'var(--text-secondary)',
            borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
            cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: confirming ? 0.5 : 1, transition: 'all 0.15s',
          }}>Volver</button>
          <button onClick={onConfirm} disabled={confirming} style={{
            flex: 2, padding: '12px', border: 'none',
            background: 'var(--color-accent)', color: '#fff',
            borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700,
            cursor: confirming ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            opacity: confirming ? 0.7 : 1, transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {confirming ? <><span className="sb-spin sb-spin-white" />Guardando...</> : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Carga() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  // Data from Supabase
  const [categories, setCategories] = useState([])
  const [members, setMembers] = useState([])
  const [mepRate, setMepRate] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [cur, setCur] = useState('ARS')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [person, setPerson] = useState('')
  const [catId, setCatId] = useState(null)
  const [subId, setSubId] = useState(null)
  const [conId, setConId] = useState(null)
  const [pay, setPay] = useState('Contado')
  const [inst, setInst] = useState(1)
  const [dest, setDest] = useState('')
  const [incCon, setIncCon] = useState(null)
  const [incSub, setIncSub] = useState('recurrente')
  const [desc, setDesc] = useState('')
  const [topDescs, setTopDescs] = useState([])
  const [isRec, setIsRec] = useState(false)
  const [rFreq, setRFreq] = useState('monthly')
  const [rPer, setRPer] = useState(12)
  const [toast, setToast] = useState(null)
  const [toastExit, setToastExit] = useState(false)
  const [saved, setSaved] = useState(false)

  // Preview modal state
  const [preview, setPreview] = useState(null) // { type, items, duplicate }
  const [confirming, setConfirming] = useState(false)

  const aRef = useRef(null)

  // Load initial data
  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Load categories with subcategories and concepts
      const { data: cats } = await supabase
        .from('categories')
        .select(`
          id, name, type, icon, sort_order, archived,
          subcategories(id, name, sort_order, archived,
            concepts(id, name, sort_order, archived)
          )
        `)
        .eq('user_id', user.id)
        .order('sort_order')

      // Sort nested data alphabetically and filter archived
      const sorted = (cats || []).filter(c => !c.archived).map(c => ({
        ...c,
        subcategories: (c.subcategories || [])
          .filter(s => !s.archived)
          .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
          .map(s => ({
            ...s,
            concepts: (s.concepts || []).filter(cn => !cn.archived).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
          }))
      })).sort((a, b) => {
        if (a.type !== b.type) return a.type === 'expense' ? -1 : 1
        return (a.name || '').localeCompare(b.name || '', 'es')
      })

      setCategories(sorted)

      // Load persons
      const { data: persData } = await supabase
        .from('persons')
        .select('*')
        .eq('archived', false)
        .order('name')

      const personsList = persData || []
      setMembers(personsList)

      // Load MEP rate
      const rate = await getLatestRate()
      setMepRate(rate)

      // Load recent transactions
      const txs = await getRecentTransactions(user.id)
      setRecent(txs || [])
    } catch (e) {
      console.error('Error loading data:', e)
      setLoadError('No se pudo cargar la información. Revisá tu conexión e intentá de nuevo.')
    }
    setLoading(false)
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // Derived
  const expenseCats = useMemo(() => categories.filter(c => c.type === 'expense'), [categories])
  const incomeCat = useMemo(() => categories.find(c => c.type === 'income'), [categories])
  const cat = useMemo(() => expenseCats.find(c => c.id === catId), [expenseCats, catId])
  const subs = useMemo(() => cat?.subcategories || [], [cat])
  const sub = useMemo(() => subs.find(s => s.id === subId), [subs, subId])
  const cons = useMemo(() => sub?.concepts || [], [sub])
  const isV = cat?.name === 'Viajes'
  const iAmt = useMemo(() => (!amount || inst <= 1) ? null : Number(amount) / inst, [amount, inst])

  // Auto-select single subcategory (or auto-select for Viajes)
  useEffect(() => { if (subs.length === 1 || isV) setSubId(subs[0]?.id || null) }, [subs, isV])

  // Pre-fill destination with last used value when Viajes is selected
  useEffect(() => {
    if (!isV || !user) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('transactions')
        .select('destination')
        .eq('user_id', user.id)
        .not('destination', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
      if (!cancelled && data?.[0]?.destination) setDest(prev => prev || data[0].destination)
    })()
    return () => { cancelled = true }
  }, [isV, user])

  // Fetch top 5 descriptions for current cat+sub+concept combo
  useEffect(() => {
    if (!conId) { setTopDescs([]); return }
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('transactions')
        .select('description')
        .eq('concept_id', conId)
        .eq('user_id', user.id)
        .not('description', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!cancelled && data) {
        const counts = {}
        data.forEach(t => { if (t.description) counts[t.description] = (counts[t.description] || 0) + 1 })
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([d]) => d)
        setTopDescs(sorted)
      }
    })()
    return () => { cancelled = true }
  }, [conId, user.id])

  // Income concept default subtype
  useEffect(() => {
    if (incCon) {
      const ic = INCOME_CONCEPTS.find(c => c.name === incCon)
      if (ic) setIncSub(ic.defaultSubtype)
    }
  }, [incCon])

  const handleRepeat = useCallback((tx) => {
    setType(tx.type)
    setAmount(tx.amount.toString())
    setCur(tx.currency)
    setDate(new Date().toISOString().slice(0, 10))
    setPerson(tx.person_id)

    if (tx.type === 'expense') {
      setCatId(tx.category_id)
      setSubId(tx.subcategory_id)
      setConId(tx.concept_id)
      setPay(tx.payment_method || 'Contado')
      setInst(tx.installments || 1)
      setDest(tx.destination || '')
      setIncCon(null)
      setIncSub('recurrente')
    } else {
      setCatId(null); setSubId(null); setConId(null)
      setPay('Contado'); setInst(1); setDest('')
      setIncCon(tx.income_concept)
      setIncSub(tx.income_subtype || 'recurrente')
    }

    setDesc(tx.description || '')
    setIsRec(false)
    setRFreq('monthly')
    setRPer(12)

    window.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => aRef.current?.focus(), 350)
  }, [])

  const reset = useCallback(() => {
    setAmount(''); setCatId(null); setSubId(null); setConId(null)
    setPay('Contado'); setInst(1); setDest('')
    setIncCon(null); setIncSub('recurrente')
    setDesc(''); setIsRec(false); setRFreq('monthly'); setRPer(12)
    setDate(new Date().toISOString().slice(0, 10))
    setPerson('')
    setTimeout(() => aRef.current?.focus(), 50)
  }, [])

  const valid = useMemo(() => {
    if (!amount || Number(amount) <= 0) return false
    if (!person) return false
    if (isRec && (isNaN(rPer) || rPer < 2 || rPer > 60)) return false
    return type === 'expense' ? conId !== null : incCon !== null
  }, [amount, type, conId, incCon, person, isRec, rPer])

  // Build the tx payload used both for preview and actual save
  const buildTxPayload = useCallback(() => {
    let incomeCategoryId = null, incomeSubcategoryId = null, incomeConceptId = null
    if (type === 'income' && incomeCat) {
      incomeCategoryId = incomeCat.id
      const incSub2 = incomeCat.subcategories?.[0]
      if (incSub2) {
        incomeSubcategoryId = incSub2.id
        const incCon2 = incSub2.concepts?.find(c => c.name === incCon)
        if (incCon2) incomeConceptId = incCon2.id
      }
    }
    return {
      type,
      date,
      amount: Number(amount),
      currency: cur,
      categoryId: type === 'expense' ? catId : incomeCategoryId,
      subcategoryId: type === 'expense' ? subId : incomeSubcategoryId,
      conceptId: type === 'expense' ? conId : incomeConceptId,
      incomeConcept: type === 'income' ? incCon : null,
      incomeSubtype: type === 'income' ? incSub : null,
      description: desc || cons.find(c => c.id === conId)?.name || incCon || null,
      paymentMethod: type === 'expense' ? pay : null,
      installments: type === 'expense' && pay === 'Crédito' ? inst : 1,
      person: members.find(m => m.id === person)?.name || null,
      personId: person,
      destination: isV ? dest : null,
      isRecurring: isRec,
      recurrenceFrequency: isRec ? rFreq : null,
      recurrencePeriods: isRec ? rPer : null,
    }
  }, [type, date, amount, cur, catId, subId, conId, incCon, incSub, desc, cons, pay, inst, person, members, isV, dest, isRec, rFreq, rPer, incomeCat])

  const showToast = useCallback((toastObj, duration = 2500) => {
    setToastExit(false)
    setToast(toastObj)
    setTimeout(() => setToastExit(true), duration - 400)
    setTimeout(() => { setToast(null); setToastExit(false) }, duration)
  }, [])

  // Step 1: open preview modal
  const handleSubmit = useCallback(async () => {
    if (!valid || saving) return
    setSaving(true)
    try {
      const tx = buildTxPayload()
      const previewData = previewTransaction(tx)

      // Check for duplicates (expense with concept_id only)
      let duplicate = null
      if (type === 'expense' && conId) {
        const { data: dups } = await supabase
          .from('transactions')
          .select('id, date, amount, currency, concepts(name)')
          .eq('user_id', user.id)
          .eq('date', date)
          .eq('concept_id', conId)
        if (dups?.length) {
          const match = dups.find(d => Math.abs(d.amount - Number(amount)) / Number(amount) <= 0.05)
          if (match) duplicate = match
        }
      }

      setPreview({ ...previewData, duplicate, tx })
    } catch (e) {
      console.error('Error building preview:', e)
    }
    setSaving(false)
  }, [valid, saving, buildTxPayload, type, conId, user.id, date, amount])

  // Step 2: confirm and save
  const handleConfirm = useCallback(async () => {
    if (!preview || confirming) return
    setConfirming(true)
    try {
      await createTransaction(preview.tx, user.id)

      const [txs, rate] = await Promise.all([
        getRecentTransactions(user.id),
        getLatestRate(),
      ])
      setRecent(txs || [])
      if (rate) setMepRate(rate)

      setPreview(null)
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      showToast({ type, msg: `${type === 'expense' ? 'Gasto' : 'Ingreso'} registrado: ${fmt(Number(amount), cur)}` })
      reset()
      setTimeout(() => aRef.current?.focus(), 100)
    } catch (e) {
      console.error('Error saving:', e)
      setPreview(null)
      showToast({ type: 'error', msg: `Error: ${e.message}` }, 3000)
    }
    setConfirming(false)
  }, [preview, confirming, user.id, type, amount, cur, showToast, reset])

  const selCat = (id) => { setCatId(id); setSubId(null); setConId(null); setTimeout(() => aRef.current?.focus(), 50) }

  if (loading) return <SkeletonForm />

  if (loadError) {
    return (
      <div className="app">
        <div style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 8 }}>Error al cargar</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{loadError}</div>
          <button onClick={() => { setLoadError(null); loadData() }} style={{
            padding: '10px 24px', background: 'var(--color-accent)', color: '#fff',
            border: 'none', borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Reintentar</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app" style={isMobile ? { height: 'auto', overflowY: 'visible' } : undefined}>
      {/* HEADER */}
      <div className="hdr" style={isMobile ? { position: 'relative', top: 'auto' } : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          {mepRate && <div className="mep">MEP <b>${Math.round(mepRate).toLocaleString('es-AR')}</b></div>}
          {(amount || catId || incCon || person) && (
            <button className="clr-btn-hdr" onClick={reset} type="button" title="Limpiar formulario">↺</button>
          )}
        </div>
        <div className="ttgl" style={{ marginBottom: 12 }}>
          <button className={`tb ${type === 'expense' ? 'ae' : ''}`}
            onClick={() => { setType('expense'); reset() }}>▼ Gasto</button>
          <button className={`tb ${type === 'income' ? 'ai-on' : ''}`}
            onClick={() => { setType('income'); reset() }}>▲ Ingreso</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <div className="sl">Importe</div>
            <div className="aw" style={{ height: 42 }}>
              <span className="ap" style={{ fontSize: 14, left: 10 }}>{cur === 'ARS' ? '$' : 'U$'}</span>
              <input ref={aRef} className="ai" style={{ fontSize: 18, padding: '10px 8px 10px 28px' }} type="text" inputMode="decimal" placeholder="0"
                value={fmtInput(amount, cur)}
                onChange={e => {
                  const val = e.target.value.replace(/[\u2009\u202F]/g, '')
                  if (cur === 'USD') {
                    let raw = val.replace(/[^\d.,]/g, '').replace(',', '.')
                    const parts = raw.split('.')
                    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
                    if (parts[1]?.length > 2) raw = parts[0] + '.' + parts[1].slice(0, 2)
                    setAmount(raw)
                  } else {
                    setAmount(val.replace(/[^0-9]/g, ''))
                  }
                }}
                autoFocus enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} />
            </div>
          </div>
          <div className="ct" style={{ flexShrink: 0, height: 42 }}>
            <button className={`cb ${cur === 'ARS' ? 'on' : ''}`} onClick={() => { setCur('ARS'); setAmount(a => a.split('.')[0]) }}>ARS</button>
            <button className={`cb ${cur === 'USD' ? 'on' : ''}`} onClick={() => setCur('USD')}>USD</button>
          </div>
          <div style={{ flex: 1 }}>
            <div className="sl">Fecha</div>
            <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', fontSize: 13, padding: '10px 8px', boxSizing: 'border-box', height: 42 }} />
          </div>
        </div>
      </div>

      <div className="fb" style={{ paddingTop: 16 }}>

        {/* EXPENSE */}
        {type === 'expense' && <>
          <div className="sec"><div className="sl">Categoría</div>
            <CategoryGrid
              categories={expenseCats}
              selectedId={catId}
              selectedCat={cat}
              onSelect={selCat}
              onClear={() => { setCatId(null); setSubId(null); setConId(null) }}
            /></div>

          {isV && <div className="sec sec-in"><div className="sl">Destino del viaje</div>
            <div className="dw"><span style={{ fontSize: 16 }}>📍</span>
              <input className="di" type="text" placeholder="Ej: Disney, Europa, Mar del Plata..."
                value={dest} onChange={e => setDest(e.target.value)} /></div></div>}

          {!isV && subs.length > 1 && <div className="sec sec-in"><div className="sl">Subcategoría</div>
            <SelectionPills
              items={subs.map(s => ({ id: s.id, label: s.name }))}
              selected={subId}
              onSelect={(id) => { setSubId(id); setConId(null) }}
              onClear={() => { setSubId(null); setConId(null) }}
            /></div>}

          {cons.length > 0 && <div className="sec sec-in"><div className="sl">Concepto</div>
            <SelectionPills
              items={cons.map(c => ({ id: c.id, label: c.name }))}
              selected={conId}
              onSelect={setConId}
              onClear={() => setConId(null)}
            /></div>}

          {conId && <div className="sec sec-in"><div className="sl">Medio de pago</div>
            <SelectionPills
              items={PAY_METHODS.map(pm => ({ id: pm.value, label: `${pm.icon} ${pm.label}` }))}
              selected={pay}
              onSelect={(value) => { setPay(value); if (value !== 'Crédito') setInst(1) }}
              alwaysShow
            />
            {pay === 'Crédito' && <>
              <div className="ir sec-in">
                <span className="il">Cuotas</span>
                {[1, 3, 6, 12, 18, 24].map(n => <button key={n} className={`ip ${inst === n ? 's' : ''}`}
                  onClick={() => setInst(n)}>{n}</button>)}
                <input className="ii" type="number" min="1" max="48" value={inst}
                  onChange={e => setInst(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {iAmt && inst > 1 && <div className="ic">{inst}x {fmt(iAmt, cur)} = {fmt(Number(amount), cur)} total</div>}
            </>}
          </div>}
        </>}

        {/* INCOME */}
        {type === 'income' && <>
          <div className="sec"><div className="sl">Concepto</div>
            <div className="icg">
              {INCOME_CONCEPTS.map(ic => (
                <button key={ic.name} className={`icc ${incCon === ic.name ? 's' : ''}`}
                  onClick={() => { setIncCon(ic.name); setTimeout(() => aRef.current?.focus(), 50) }}>
                  <div className="ici">{ic.icon}</div>
                  <div className="icn">{ic.name}</div>
                </button>))}
            </div></div>

          {incCon && <div className="sec sec-in"><div className="sl">Tipo</div>
            <div className="ist">
              <button className={`isb ${incSub === 'recurrente' ? 's' : ''}`}
                onClick={() => setIncSub('recurrente')}>🔄 Recurrente</button>
              <button className={`isb ${incSub === 'extraordinario' ? 's' : ''}`}
                onClick={() => setIncSub('extraordinario')}>⭐ Extraordinario</button>
            </div></div>}
        </>}

        {/* DESCRIPTION */}
        <div className="sec"><div className="sl">Descripción (opcional)</div>
          <input className="inp" type="text"
            placeholder={isV ? 'Ej: Hotel Marriott, Nafta ruta...' : 'Ej: Café Martinez, Cuota gym...'}
            value={desc} onChange={e => setDesc(e.target.value)}
            enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }} />
          {topDescs.length > 0 && !desc && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
              {topDescs.map(d => (
                <button key={d} onClick={() => setDesc(d)} style={{
                  padding: '4px 10px', borderRadius: 12, border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: 11,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}>{d}</button>
              ))}
            </div>
          )}</div>

        {/* QUIÉN */}
        <div className="sec"><div className="sl">Quién</div>
          <div className="pp">
            {members.map(p => <button key={p.id} className={`pb ${person === p.id ? 's' : ''}`}
              onClick={() => setPerson(p.id)}>{p.name}</button>)}
          </div></div>

        {/* RECURRING */}
        <div className="sec">
          <div className={`tr ${isRec ? 'on' : ''}`} onClick={() => setIsRec(!isRec)}>
            <span className="tl">🔄 {type === 'expense' ? 'Gasto' : 'Ingreso'} recurrente</span>
            <div className={`sw ${isRec ? 'on' : ''}`} />
          </div>
          {isRec && <div className="rc sec-in">
            <select className="sf" value={rFreq} onChange={e => setRFreq(e.target.value)}>
              {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>×</span>
            <input className="ii" type="number" min="2" max="60" value={rPer}
              onChange={e => setRPer(Math.max(2, parseInt(e.target.value) || 2))} />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>períodos</span>
          </div>}
        </div>
      </div>

      {/* SUBMIT */}
      <div className="sa">
        <button className={`sb ${type}`} disabled={!valid || saving} onClick={handleSubmit}>
          {saving
            ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span className="sb-spin" />Verificando...
              </span>
            : saved
            ? <span>✓ Registrado</span>
            : <>
                {type === 'expense' ? 'Registrar Gasto' : 'Registrar Ingreso'}
                {amount && valid && ` · ${fmt(Number(amount), cur)}`}
              </>}
        </button>
      </div>

      {/* RECENT */}
      <RecentTransactions transactions={recent} onRepeat={handleRepeat} />

      {toast && (
        <div className={`toast ${toast.type}${toastExit ? ' toast-exit' : ''}`}>
          {toast.type === 'error' ? '✗' : '✓'} {toast.msg}
        </div>
      )}

      {/* PREVIEW MODAL */}
      {preview && <PreviewModal
        preview={preview}
        currency={cur}
        catName={cat?.name || incCon}
        personName={members.find(m => m.id === person)?.name}
        confirming={confirming}
        onConfirm={handleConfirm}
        onClose={() => setPreview(null)}
      />}
    </div>
  )
}
