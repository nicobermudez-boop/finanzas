import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Upload, CheckCircle } from 'lucide-react'

export default function ImportTab({ user }) {
  const [step, setStep] = useState('upload') // upload | preview | importing | done
  const [rawRows, setRawRows] = useState([])
  const [validations, setValidations] = useState([])
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [concepts, setConcepts] = useState([])
  const [persons, setPersons] = useState([])
  const [exchangeRates, setExchangeRates] = useState({})
  const [, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [fileName, setFileName] = useState('')

  const EXPECTED_HEADERS = ['Fecha', 'Tipo', 'Monto', 'Moneda', 'Categoria', 'Subcategoria', 'Concepto', 'Descripcion', 'Medio de Pago', 'Cuotas', 'Cuota N', 'Persona', 'Destino', 'Recurrente', 'Monto USD', 'Cotizacion']

  const loadLookups = async () => {
    const [catR, subR, conR, perR, ratesR] = await Promise.all([
      supabase.from('categories').select('id, name, type'),
      supabase.from('subcategories').select('id, name, category_id'),
      supabase.from('concepts').select('id, name, subcategory_id'),
      supabase.from('persons').select('id, name'),
      supabase.from('exchange_rates').select('date, rate'),
    ])
    setCategories(catR.data || [])
    setSubcategories(subR.data || [])
    setConcepts(conR.data || [])
    setPersons(perR.data || [])
    const rateMap = {}
    ;(ratesR.data || []).forEach(r => { rateMap[r.date] = parseFloat(r.rate) })
    setExchangeRates(rateMap)
  }

  useEffect(() => { loadLookups() }, [])

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim())
    const result = []
    for (const line of lines) {
      const row = []
      let current = '', inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) { row.push(current.trim()); current = '' }
        else current += ch
      }
      row.push(current.trim())
      result.push(row)
    }
    return result
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const tryParse = (text) => {
      const rows = parseCSV(text)
      if (rows.length < 2) { setValidations([{ row: 0, errors: ['El archivo está vacío o solo tiene headers'] }]); setStep('preview'); return }

      const headers = rows[0]
      const headerErrors = []
      EXPECTED_HEADERS.forEach((h, i) => {
        if (!headers[i] || headers[i].toLowerCase() !== h.toLowerCase()) {
          headerErrors.push(`Columna ${i + 1}: esperaba "${h}", encontró "${headers[i] || '(vacío)'}"`)
        }
      })
      if (headerErrors.length > 0) {
        setValidations([{ row: 0, errors: headerErrors }])
        setRawRows([])
        setStep('preview')
        return
      }

      const dataRows = rows.slice(1)
      setRawRows(dataRows)
      validateRows(dataRows)
      setStep('preview')
    }

    // Try UTF-8 first
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      if (text.includes('\ufffd') || text.includes('�')) {
        const reader2 = new FileReader()
        reader2.onload = (ev2) => tryParse(ev2.target.result)
        reader2.readAsText(file, 'ISO-8859-1')
      } else {
        tryParse(text)
      }
    }
    reader.readAsText(file, 'UTF-8')
  }

  const validateRows = (rows) => {
    const vals = []
    rows.forEach((row, idx) => {
      const errors = []
      const warnings = []
      const [fecha, tipo, monto, moneda, cat, sub, con, desc, medioPago, cuotas, cuotaN, persona, destino, recurrente, montoUsd, cotizacion] = row

      const isGasto = tipo === 'Gasto'
      const isIngreso = tipo === 'Ingreso'

      if (!fecha) errors.push('Fecha vacía')
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errors.push(`Fecha inválida: "${fecha}" (YYYY-MM-DD)`)

      const isFutureDate = fecha && fecha > new Date().toISOString().slice(0, 10)
      if (isFutureDate) warnings.push('Fecha futura — Cotización y Monto USD se completarán después')

      if (!tipo) errors.push('Tipo vacío')
      else if (!['Gasto', 'Ingreso'].includes(tipo)) errors.push(`Tipo inválido: "${tipo}" (Gasto/Ingreso)`)

      if (!monto) errors.push('Monto vacío')
      else if (isNaN(parseFloat(monto))) errors.push(`Monto no numérico: "${monto}"`)

      if (!moneda) errors.push('Moneda vacía')
      else if (!['ARS', 'USD'].includes(moneda)) errors.push(`Moneda inválida: "${moneda}" (ARS/USD)`)

      if (!cat) errors.push('Categoría vacía')
      if (!sub) errors.push('Subcategoría vacía')
      if (!con) errors.push('Concepto vacío')
      if (!persona) errors.push('Persona vacía')
      if (!recurrente) errors.push('Recurrente vacío')
      else if (!['Sí', 'Si', 'No'].includes(recurrente)) errors.push(`Recurrente inválido: "${recurrente}" (Sí/No)`)

      if (isGasto) {
        if (!medioPago) errors.push('Medio de Pago vacío')
        else if (!['Contado', 'Crédito'].includes(medioPago)) errors.push(`Medio de pago inválido: "${medioPago}" (Contado/Crédito)`)
        if (!cuotas) errors.push('Cuotas vacío')
        else if (isNaN(parseInt(cuotas))) errors.push(`Cuotas no numérico: "${cuotas}"`)
        if (!cuotaN) errors.push('Cuota N vacío')
        else if (isNaN(parseInt(cuotaN))) errors.push(`Cuota N no numérico: "${cuotaN}"`)
      } else if (isIngreso) {
        if (medioPago && !['Contado', 'Crédito'].includes(medioPago)) errors.push(`Medio de pago inválido: "${medioPago}" (Contado/Crédito)`)
        if (cuotas && isNaN(parseInt(cuotas))) errors.push(`Cuotas no numérico: "${cuotas}"`)
        if (cuotaN && isNaN(parseInt(cuotaN))) errors.push(`Cuota N no numérico: "${cuotaN}"`)
      }

      if (!montoUsd) { if (!isFutureDate) errors.push('Monto USD vacío') }
      else if (isNaN(parseFloat(montoUsd))) errors.push(`Monto USD no numérico: "${montoUsd}"`)

      if (!cotizacion) { if (!isFutureDate) errors.push('Cotización vacía') }
      else if (isNaN(parseFloat(cotizacion))) errors.push(`Cotización no numérico: "${cotizacion}"`)
      else if (parseFloat(cotizacion) <= 0) errors.push('Cotización debe ser mayor a 0')

      if (!desc) warnings.push('Descripción vacía — se usará el Concepto')

      if (cat && cat.toLowerCase() === 'viajes' && !destino) errors.push('Destino obligatorio para categoría Viajes')

      if (isGasto && cat) {
        const catMatch = categories.find(c => c.name.toLowerCase() === cat.toLowerCase() && c.type === 'expense')
        if (!catMatch) errors.push(`Categoría no encontrada: "${cat}"`)
        else {
          if (sub) {
            const subMatch = subcategories.find(s => s.name.toLowerCase() === sub.toLowerCase() && s.category_id === catMatch.id)
            if (!subMatch) errors.push(`Subcategoría "${sub}" no existe en "${cat}"`)
            else if (con) {
              const conMatch = concepts.find(c => c.name.toLowerCase() === con.toLowerCase() && c.subcategory_id === subMatch.id)
              if (!conMatch) errors.push(`Concepto "${con}" no existe en "${sub}"`)
            }
          }
        }
      }

      if (isIngreso && cat) {
        const catMatch = categories.find(c => c.name.toLowerCase() === cat.toLowerCase() && c.type === 'income')
        if (!catMatch) errors.push(`Categoría de ingreso no encontrada: "${cat}"`)
      }

      if (persona) {
        const personMatch = persons.find(p => p.name.toLowerCase() === persona.toLowerCase())
        if (!personMatch) errors.push(`Persona no encontrada: "${persona}"`)
      }

      const montoNum = parseFloat(monto)
      const usdNum = parseFloat(montoUsd)
      const fxNum = parseFloat(cotizacion)
      const hasNums = !isNaN(montoNum) && !isNaN(usdNum) && !isNaN(fxNum) && fxNum > 0

      if (hasNums && moneda === 'ARS') {
        const expectedUsd = montoNum / fxNum
        const diff = Math.abs(expectedUsd - usdNum)
        if (diff > 1) errors.push(`ARS ${monto} / ${cotizacion} = ${expectedUsd.toFixed(2)} USD, pero Monto USD es ${montoUsd} — dif: ${diff.toFixed(2)} USD`)
      }

      if (hasNums && moneda === 'USD') {
        if (Math.abs(montoNum - usdNum) > 0.01) errors.push(`Moneda USD pero Monto (${monto}) ≠ Monto USD (${montoUsd})`)
      }

      if (fecha && !isNaN(fxNum)) {
        let dbRate = exchangeRates[fecha]
        if (!dbRate) {
          const sorted = Object.keys(exchangeRates).filter(d => d <= fecha).sort().reverse()
          if (sorted.length > 0) dbRate = exchangeRates[sorted[0]]
        }
        if (dbRate && Math.abs(dbRate - fxNum) > 0.01) {
          warnings.push(`Cotización CSV (${fxNum}) difiere de DB (${dbRate}) para fecha ${fecha}`)
        }
      }

      vals.push({ row: idx + 2, errors, warnings, data: row })
    })
    setValidations(vals)
  }

  const errorCount = validations.filter(v => v.errors.length > 0).length
  const warningCount = validations.filter(v => v.warnings?.length > 0 && v.errors.length === 0).length
  const validCount = validations.filter(v => v.errors.length === 0).length

  const doImport = async () => {
    setImporting(true)
    const validRows = validations.filter(v => v.errors.length === 0)
    let inserted = 0, failed = 0

    const catMap = {}; categories.forEach(c => { catMap[`${c.type}_${c.name.toLowerCase()}`] = c.id })
    const subMap = {}; subcategories.forEach(s => { subMap[s.name.toLowerCase() + '_' + s.category_id] = s.id })
    const conMap = {}; concepts.forEach(c => { conMap[c.name.toLowerCase() + '_' + c.subcategory_id] = c.id })
    const perMap = {}; persons.forEach(p => { perMap[p.name.toLowerCase()] = p })

    const chunks = []
    for (let i = 0; i < validRows.length; i += 50) chunks.push(validRows.slice(i, i + 50))

    for (const chunk of chunks) {
      const records = chunk.map(v => {
        const [fecha, tipo, monto, moneda, cat, sub, con, desc, medioPago, cuotas, cuotaN, persona, destino, recurrente, montoUsd, cotizacion] = v.data
        const isExpense = tipo === 'Gasto'
        const catType = isExpense ? 'expense' : 'income'
        const catId = cat ? catMap[`${catType}_${cat.toLowerCase()}`] || null : null
        const subId = sub && catId ? subMap[sub.toLowerCase() + '_' + catId] || null : null
        const conId = con && subId ? conMap[con.toLowerCase() + '_' + subId] || null : null
        const personObj = persona ? perMap[persona.toLowerCase()] : null

        return {
          user_id: user.id,
          type: isExpense ? 'expense' : 'income',
          date: fecha,
          amount: parseFloat(monto),
          currency: moneda,
          category_id: isExpense ? catId : catId,
          subcategory_id: subId || null,
          concept_id: conId || null,
          income_concept: !isExpense ? (cat || null) : null,
          income_subtype: !isExpense ? (['Sí', 'Si'].includes(recurrente) ? 'recurrente' : 'extraordinario') : null,
          description: desc || con || null,
          payment_method: isExpense ? (medioPago || null) : null,
          installments: parseInt(cuotas) || 1,
          installment_number: parseInt(cuotaN) || 1,
          person: persona || null,
          person_id: personObj?.id || null,
          destination: destino || null,
          is_recurring: ['Sí', 'Si'].includes(recurrente),
          exchange_rate: cotizacion ? parseFloat(cotizacion) : null,
          amount_usd: montoUsd ? parseFloat(montoUsd) : null,
        }
      })

      const { error } = await supabase.from('transactions').insert(records)
      if (error) {
        console.error('Batch error:', error)
        for (const rec of records) {
          const { error: singleErr } = await supabase.from('transactions').insert(rec)
          if (singleErr) { console.error('Row error:', singleErr, rec); failed++ }
          else inserted++
        }
      }
      else inserted += chunk.length
    }

    setImportResult({ inserted, failed, total: validRows.length })
    setStep('done')
    setImporting(false)
  }

  const cardS = { background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 20 }
  const btnS = (active) => ({ padding: '10px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: active ? 'var(--color-accent)' : 'var(--bg-tertiary)', color: active ? '#fff' : 'var(--text-dim)', fontSize: 14, fontWeight: 600, cursor: active ? 'pointer' : 'not-allowed', fontFamily: 'inherit' })

  // Upload step
  if (step === 'upload') {
    return (
      <div>
        <div style={cardS}>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Importar transacciones desde CSV</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
            El archivo debe tener el mismo formato que el export de Historial, con estas 16 columnas:<br />
            <code style={{ fontSize: 11, color: 'var(--color-accent)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: 4, display: 'inline-block', marginTop: 6 }}>
              Fecha, Tipo, Monto, Moneda, Categoría, Subcategoría, Concepto, Descripción, Medio de Pago, Cuotas, Cuota N°, Persona, Destino, Recurrente, Monto USD, Cotización
            </code>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 16, lineHeight: 1.6 }}>
            <strong>Valores válidos:</strong><br />
            Fecha: YYYY-MM-DD · Tipo: Gasto/Ingreso · Moneda: ARS/USD · Medio de Pago: Contado/Crédito · Recurrente: Sí/No
          </div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            <Upload size={16} /> Seleccionar archivo CSV
            <input type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>
    )
  }

  // Preview step
  if (step === 'preview') {
    const headerError = validations.length === 1 && validations[0].row === 0
    return (
      <div>
        <div style={cardS}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>Preview: {fileName}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                {headerError ? '' : <>{rawRows.length} filas · <span style={{ color: 'var(--color-income)' }}>{validCount} válidas</span>{warningCount > 0 && <> · <span style={{ color: '#e6a817' }}>{warningCount} con advertencias</span></>}{errorCount > 0 && <> · <span style={{ color: 'var(--color-expense)' }}>{errorCount} con errores</span></>}</>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setStep('upload'); setRawRows([]); setValidations([]) }} style={btnS(true)}>← Volver</button>
              {!headerError && validCount > 0 && (
                <button onClick={doImport} style={btnS(true)}>
                  Importar {validCount} registros{errorCount > 0 ? ` (omitir ${errorCount} con error)` : ''}
                </button>
              )}
            </div>
          </div>

          {headerError && (
            <div style={{ padding: 16, background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-expense)', marginBottom: 8, fontSize: 14 }}>Headers incorrectos</div>
              {validations[0].errors.map((e, i) => <div key={i} style={{ fontSize: 12, color: 'var(--color-expense-light)', marginBottom: 4 }}>{e}</div>)}
            </div>
          )}

          {!headerError && errorCount > 0 && (
            <div style={{ marginBottom: 16, padding: 14, background: 'var(--color-expense-bg)', border: '1px solid var(--color-expense-border)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: 'var(--color-expense)', marginBottom: 8, fontSize: 13 }}>Errores ({errorCount}) — estas filas no se importarán</div>
              <div style={{ maxHeight: 200, overflow: 'auto' }}>
                {validations.filter(v => v.errors.length > 0).map(v => (
                  <div key={v.row} style={{ fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>Fila {v.row}:</span>{' '}
                    {v.errors.map((e, i) => <span key={i} style={{ color: 'var(--color-expense-light)' }}>{e}{i < v.errors.length - 1 ? ' · ' : ''}</span>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!headerError && warningCount > 0 && (
            <div style={{ marginBottom: 16, padding: 14, background: 'rgba(230,168,23,0.08)', border: '1px solid rgba(230,168,23,0.25)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontWeight: 600, color: '#e6a817', marginBottom: 8, fontSize: 13 }}>Advertencias ({warningCount}) — se importarán igualmente</div>
              <div style={{ maxHeight: 150, overflow: 'auto' }}>
                {validations.filter(v => v.warnings?.length > 0 && v.errors.length === 0).map(v => (
                  <div key={v.row} style={{ fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}>Fila {v.row}:</span>{' '}
                    {v.warnings.map((w, i) => <span key={i} style={{ color: '#b8860b' }}>{w}{i < v.warnings.length - 1 ? ' · ' : ''}</span>)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!headerError && (
            <div style={{ overflow: 'auto', maxHeight: 400, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                <thead>
                  <tr style={{ position: 'sticky', top: 0, background: 'var(--bg-tertiary)', zIndex: 1 }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>#</th>
                    {EXPECTED_HEADERS.slice(0, 8).map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)', fontWeight: 600 }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {validations.slice(0, 100).map(v => {
                    const hasErr = v.errors.length > 0
                    return (
                      <tr key={v.row} style={{ background: hasErr ? 'var(--color-expense-bg)' : 'transparent' }}>
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-dim)' }}>{v.row}</td>
                        {(v.data || []).slice(0, 8).map((cell, i) => (
                          <td key={i} style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell}</td>
                        ))}
                        <td style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-subtle)' }}>
                          {hasErr ? <span style={{ color: 'var(--color-expense)' }} title={v.errors.join('\n')}>✕</span> : v.warnings?.length > 0 ? <span style={{ color: '#e6a817' }} title={v.warnings.join('\n')}>⚠</span> : <span style={{ color: 'var(--color-income)' }}>✓</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {validations.length > 100 && <div style={{ padding: 8, textAlign: 'center', fontSize: 11, color: 'var(--text-dim)' }}>Mostrando 100 de {validations.length} filas...</div>}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Done step
  if (step === 'done') {
    return (
      <div>
        <div style={cardS}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={48} style={{ color: 'var(--color-income)', marginBottom: 12 }} />
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Importación completa</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>
              <strong style={{ color: 'var(--color-income)' }}>{importResult?.inserted}</strong> registros importados correctamente
            </div>
            {importResult?.failed > 0 && (
              <div style={{ fontSize: 13, color: 'var(--color-expense)' }}>{importResult.failed} fallaron al insertar</div>
            )}
            <button onClick={() => { setStep('upload'); setRawRows([]); setValidations([]); setImportResult(null) }} style={{ ...btnS(true), marginTop: 20 }}>Importar otro archivo</button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
