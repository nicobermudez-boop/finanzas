import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchAllTransactions } from '../../lib/fetchAll'
import CrudList from './CrudList'

export default function PersonsTab({ user }) {
  const [persons, setPersons] = useState([])
  const [txCounts, setTxCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [crudError, setCrudError] = useState(null)

  const showCrudError = (msg) => { setCrudError(msg); setTimeout(() => setCrudError(null), 3000) }

  const loadAll = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data } = await supabase.from('persons').select('*').order('name')
      setPersons(data || [])
      const txData = await fetchAllTransactions(user.id, { select: 'person_id' })
      const counts = {}
      ;(txData || []).forEach(t => { if (t.person_id) counts[t.person_id] = (counts[t.person_id] || 0) + 1 })
      setTxCounts(counts)
    } catch (e) {
      console.error('Error loading persons:', e)
      setLoadError('No se pudieron cargar las personas. Intentá de nuevo.')
    }
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  const add = async (name) => {
    const { error } = await supabase.from('persons').insert({ name, user_id: user.id })
    if (error) { showCrudError('Error al agregar la persona.'); return }
    loadAll()
  }
  const rename = async (id, name) => {
    const { error } = await supabase.from('persons').update({ name }).eq('id', id)
    if (error) { showCrudError('Error al renombrar la persona.'); return }
    const person = persons.find(p => p.id === id)
    if (person) await supabase.from('transactions').update({ person: name }).eq('person', person.name)
    loadAll()
  }
  const del = async (id, reassignId) => {
    try {
      if (reassignId) {
        const target = persons.find(p => p.id === reassignId)
        await supabase.from('transactions').update({ person_id: reassignId, person: target?.name }).eq('person_id', id)
      }
      await supabase.from('persons').delete().eq('id', id); loadAll()
    } catch { showCrudError('Error al eliminar la persona.') }
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>Cargando...</div>

  if (loadError) return (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>⚠️</div>
      <div style={{ color: 'var(--text-primary)', fontWeight: 600, marginBottom: 6 }}>Error al cargar</div>
      <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>{loadError}</div>
      <button onClick={loadAll} style={{ padding: '8px 20px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Reintentar</button>
    </div>
  )

  const items = persons.map(p => ({ ...p, txCount: txCounts[p.id] || 0 }))

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Personas</div>
      <CrudList items={items} onAdd={add} onRename={rename} onDelete={del} entityName="persona" />
      {crudError && <div className="toast error">✗ {crudError}</div>}
    </div>
  )
}
