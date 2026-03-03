import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { createTransaction, getRecentTransactions } from '../lib/transactions'
import { getLatestRate } from '../lib/exchangeRate'
import { useAuth } from '../context/AuthContext'

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

const fmt = (n, c = 'ARS') => {
  if (!n && n !== 0) return ''
  const a = Math.abs(Number(n))
  return c === 'USD'
    ? `US$ ${a.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$ ${a.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export default function Carga() {
  const { user } = useAuth()
  // Data from Supabase
  const [categories, setCategories] = useState([])
  const [members, setMembers] = useState([])
  const [mepRate, setMepRate] = useState(null)
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)
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
  const [isRec, setIsRec] = useState(false)
  const [rFreq, setRFreq] = useState('monthly')
  const [rPer, setRPer] = useState(12)
  const [toast, setToast] = useState(null)

  const aRef = useRef(null)

  // Load initial data
  useEffect(() => {
    loadData()
  }, [user])

  async function loadData() {
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
      if (personsList.length > 0) setPerson(personsList[0].id)

      // Load MEP rate
      const rate = await getLatestRate()
      setMepRate(rate)

      // Load recent transactions
      const txs = await getRecentTransactions(user.id)
      setRecent(txs || [])
    } catch (e) {
      console.error('Error loading data:', e)
    }
    setLoading(false)
  }

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

  // Income concept default subtype
  useEffect(() => {
    if (incCon) {
      const ic = INCOME_CONCEPTS.find(c => c.name === incCon)
      if (ic) setIncSub(ic.defaultSubtype)
    }
  }, [incCon])

  const reset = useCallback(() => {
    setAmount(''); setCatId(null); setSubId(null); setConId(null)
    setPay('Contado'); setInst(1); setDest('')
    setIncCon(null); setIncSub('recurrente')
    setDesc(''); setIsRec(false); setRFreq('monthly'); setRPer(12)
    setDate(new Date().toISOString().slice(0, 10))
  }, [])

  const valid = useMemo(() => {
    if (!amount || Number(amount) <= 0) return false
    return type === 'expense' ? conId !== null : incCon !== null
  }, [amount, type, conId, incCon])

  const handleSubmit = async () => {
    if (!valid || saving) return
    setSaving(true)

    try {
      // Find the income concept's category/subcategory/concept IDs
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

      await createTransaction({
        type,
        date,
        amount: Number(amount),
        currency: cur,
        categoryId: type === 'expense' ? catId : incomeCategoryId,
        subcategoryId: type === 'expense' ? subId : incomeSubcategoryId,
        conceptId: type === 'expense' ? conId : incomeConceptId,
        incomeConcept: type === 'income' ? incCon : null,
        incomeSubtype: type === 'income' ? incSub : null,
        description: desc || null,
        paymentMethod: type === 'expense' ? pay : null,
        installments: type === 'expense' && pay === 'Crédito' ? inst : 1,
        person: members.find(m => m.id === person)?.name || null,
        personId: person,
        destination: isV ? dest : null,
        isRecurring: isRec,
        recurrenceFrequency: isRec ? rFreq : null,
        recurrencePeriods: isRec ? rPer : null,
      }, user.id)

      // Refresh recent
      const txs = await getRecentTransactions(user.id)
      setRecent(txs || [])

      // Refresh MEP
      const rate = await getLatestRate()
      if (rate) setMepRate(rate)

      setToast({ type, msg: `${type === 'expense' ? 'Gasto' : 'Ingreso'} registrado: ${fmt(Number(amount), cur)}` })
      setTimeout(() => setToast(null), 2500)
      reset()
      setTimeout(() => aRef.current?.focus(), 100)
    } catch (e) {
      console.error('Error saving:', e)
      setToast({ type: 'expense', msg: `Error: ${e.message}` })
      setTimeout(() => setToast(null), 3000)
    }

    setSaving(false)
  }

  const selCat = (id) => { setCatId(id); setSubId(null); setConId(null) }

  if (loading) {
    return (
      <div className="app">
        <div className="loading-screen">
          <div className="loading-text">Cargando...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* HEADER */}
      <div className="hdr">
        <div className="ht">
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em' }}>Carga</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {mepRate && <div className="mep">MEP <b>{mepRate.toLocaleString('es-AR')}</b></div>}
          </div>
        </div>
        <div className="ttgl">
          <button className={`tb ${type === 'expense' ? 'ae' : ''}`}
            onClick={() => { setType('expense'); reset() }}>▼ Gasto</button>
          <button className={`tb ${type === 'income' ? 'ai' : ''}`}
            onClick={() => { setType('income'); reset() }}>▲ Ingreso</button>
        </div>
      </div>

      <div className="fb">
        {/* AMOUNT */}
        <div className="sec">
          <div className="sl">Importe</div>
          <div className="arow">
            <div className="aw">
              <span className="ap">{cur === 'ARS' ? '$' : 'U$'}</span>
              <input ref={aRef} className="ai" type="text" inputMode="decimal" placeholder="0"
                value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} autoFocus />
            </div>
            <div className="ct">
              <button className={`cb ${cur === 'ARS' ? 'on' : ''}`} onClick={() => setCur('ARS')}>ARS</button>
              <button className={`cb ${cur === 'USD' ? 'on' : ''}`} onClick={() => setCur('USD')}>USD</button>
            </div>
          </div>
        </div>

        {/* DATE + PERSON */}
        <div className="sec">
          <div className="row">
            <div><div className="sl">Fecha</div>
              <input className="inp" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
            <div><div className="sl">Quién</div>
              <div className="pp">
                {members.map(p => <button key={p.id} className={`pb ${person === p.id ? 's' : ''}`}
                  onClick={() => setPerson(p.id)}>{p.name}</button>)}
              </div></div>
          </div>
        </div>

        {/* EXPENSE */}
        {type === 'expense' && <>
          <div className="sec"><div className="sl">Categoría</div>
            <div className="cg">
              {expenseCats.map(c => (
                <button key={c.id} className={`cc ${catId === c.id ? 's' : ''}`} onClick={() => selCat(c.id)}>
                  <div className="ci">{c.icon || '📦'}</div><div className="cn">{c.name}</div>
                </button>))}
            </div></div>

          {isV && <div className="sec"><div className="sl">Destino del viaje</div>
            <div className="dw"><span style={{ fontSize: 16 }}>📍</span>
              <input className="di" type="text" placeholder="Ej: Disney, Europa, Mar del Plata..."
                value={dest} onChange={e => setDest(e.target.value)} /></div></div>}

          {!isV && subs.length > 1 && <div className="sec"><div className="sl">Subcategoría</div>
            <div className="pills">{subs.map(s => (
              <button key={s.id} className={`p ${subId === s.id ? 's' : ''}`}
                onClick={() => { setSubId(s.id); setConId(null) }}>{s.name}</button>))}</div></div>}

          {cons.length > 0 && <div className="sec"><div className="sl">Concepto</div>
            <div className="pills">{cons.map(c => (
              <button key={c.id} className={`p ${conId === c.id ? 's' : ''}`}
                onClick={() => setConId(c.id)}>{c.name}</button>))}</div></div>}

          {conId && <div className="sec"><div className="sl">Medio de pago</div>
            <div className="pills">
              {PAY_METHODS.map(pm => (
                <button key={pm.value} className={`p ${pay === pm.value ? 's' : ''}`}
                  onClick={() => { setPay(pm.value); if (pm.value !== 'Crédito') setInst(1) }}>
                  {pm.icon} {pm.label}</button>))}
            </div>
            {pay === 'Crédito' && <>
              <div className="ir">
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
                  onClick={() => setIncCon(ic.name)}>
                  <div className="ici">{ic.icon}</div>
                  <div className="icn">{ic.name}</div>
                </button>))}
            </div></div>

          {incCon && <div className="sec"><div className="sl">Tipo</div>
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
            value={desc} onChange={e => setDesc(e.target.value)} /></div>

        {/* RECURRING */}
        <div className="sec">
          <div className={`tr ${isRec ? 'on' : ''}`} onClick={() => setIsRec(!isRec)}>
            <span className="tl">🔄 {type === 'expense' ? 'Gasto' : 'Ingreso'} recurrente</span>
            <div className={`sw ${isRec ? 'on' : ''}`} />
          </div>
          {isRec && <div className="rc">
            <select className="sf" value={rFreq} onChange={e => setRFreq(e.target.value)}>
              {FREQS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
            <span style={{ fontSize: 12, color: 'var(--txm)' }}>×</span>
            <input className="ii" type="number" min="2" max="60" value={rPer}
              onChange={e => setRPer(Math.max(2, parseInt(e.target.value) || 2))} />
            <span style={{ fontSize: 12, color: 'var(--txm)' }}>períodos</span>
          </div>}
        </div>
      </div>

      {/* SUBMIT */}
      <div className="sa">
        <button className={`sb ${type}`} disabled={!valid || saving} onClick={handleSubmit}>
          {saving ? 'Guardando...' : type === 'expense' ? 'Registrar Gasto' : 'Registrar Ingreso'}
          {!saving && amount && valid && ` · ${fmt(Number(amount), cur)}`}
        </button>
      </div>

      {/* RECENT */}
      {recent.length > 0 && <div className="rs"><div className="rt">Últimos registros</div>
        {recent.map(tx => (
          <div key={tx.id} className="ri">
            <div className="rl">
              <span className="rx">{tx.categories?.icon || '💰'}</span>
              <div className="rn">
                <div className="rc2">
                  {tx.concepts?.name || tx.income_concept || ''}
                  {tx.destination && <span style={{ color: 'var(--txd)' }}> · {tx.destination}</span>}
                </div>
                <div className="rd">
                  {tx.categories?.name || 'Ingresos'} · {tx.person} · {tx.date}
                  {tx.installments > 1 && ` · ${tx.installment_number}/${tx.installments}`}
                  {tx.income_subtype === 'extraordinario' && ' · ⭐'}
                  {tx.is_recurring && ' · 🔄'}
                </div>
              </div>
            </div>
            <div className={`ra ${tx.type}`}>
              {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount, tx.currency)}
            </div>
          </div>))}
      </div>}

      {toast && <div className={`toast ${toast.type}`}>✓ {toast.msg}</div>}
    </div>
  )
}
