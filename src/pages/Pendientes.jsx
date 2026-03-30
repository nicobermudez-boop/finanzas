import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, NotebookPen } from 'lucide-react'
import { SkeletonList } from '../components/Skeleton'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

const styles = {
  container: (isMobile) => ({
    padding: isMobile ? '16px' : '32px',
    background: 'var(--bg-primary)',
    minHeight: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  }),
  inner: {
    width: '100%',
    maxWidth: 600,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  inputRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  addBtn: (disabled) => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? 'var(--bg-hover)' : 'var(--color-accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  }),
  statsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 2px',
  },
  statsText: {
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  clearBtn: {
    fontSize: 12,
    color: 'var(--color-expense)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '2px 4px',
    borderRadius: 4,
    opacity: 0.85,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  noteCard: (completed) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    transition: 'opacity 0.15s',
    opacity: completed ? 0.65 : 1,
  }),
  toggleBtn: (completed) => ({
    width: 20,
    height: 20,
    borderRadius: '50%',
    border: completed ? 'none' : '1.5px solid var(--border)',
    background: completed ? 'var(--color-accent)' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transition: 'background 0.15s, border-color 0.15s',
  }),
  noteText: (completed) => ({
    flex: 1,
    fontSize: 14,
    color: completed ? 'var(--text-muted)' : 'var(--text-primary)',
    textDecoration: completed ? 'line-through' : 'none',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  }),
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    borderRadius: 4,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 0',
    gap: 12,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 'var(--radius-xl)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.5,
  },
  errorText: {
    fontSize: 13,
    color: 'var(--color-expense)',
    textAlign: 'center',
  },
}

export default function Pendientes() {
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  useEffect(() => {
    if (user) loadNotes()
  }, [user])

  async function loadNotes() {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('pending_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) {
      setError('No se pudieron cargar los pendientes.')
    } else {
      setNotes(data)
    }
    setLoading(false)
  }

  async function handleAdd() {
    const text = input.trim()
    if (!text || adding) return
    setAdding(true)
    const optimistic = { id: `opt-${Date.now()}`, text, completed: false, created_at: new Date().toISOString(), user_id: user.id }
    setNotes(prev => [optimistic, ...prev])
    setInput('')
    const { data, error } = await supabase
      .from('pending_notes')
      .insert({ user_id: user.id, text })
      .select()
      .single()
    if (error) {
      setNotes(prev => prev.filter(n => n.id !== optimistic.id))
      setInput(text)
    } else {
      setNotes(prev => prev.map(n => n.id === optimistic.id ? data : n))
    }
    setAdding(false)
  }

  async function handleToggle(note) {
    const newCompleted = !note.completed
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, completed: newCompleted } : n))
    const { error } = await supabase
      .from('pending_notes')
      .update({ completed: newCompleted })
      .eq('id', note.id)
      .eq('user_id', user.id)
    if (error) {
      setNotes(prev => prev.map(n => n.id === note.id ? { ...n, completed: note.completed } : n))
    }
  }

  async function handleDelete(id) {
    setDeletingId(id)
    setNotes(prev => prev.filter(n => n.id !== id))
    const { error } = await supabase
      .from('pending_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)
    if (error) {
      await loadNotes()
    }
    setDeletingId(null)
  }

  async function handleClearCompleted() {
    const completed = notes.filter(n => n.completed)
    if (!completed.length) return
    setNotes(prev => prev.filter(n => !n.completed))
    const { error } = await supabase
      .from('pending_notes')
      .delete()
      .eq('user_id', user.id)
      .eq('completed', true)
    if (error) {
      await loadNotes()
    }
  }

  const pendingCount = notes.filter(n => !n.completed).length
  const completedCount = notes.filter(n => n.completed).length
  const sortedNotes = [
    ...notes.filter(n => !n.completed),
    ...notes.filter(n => n.completed),
  ]

  return (
    <div style={styles.container(isMobile)}>
      <div style={styles.inner}>
        {!isMobile && (
          <div style={styles.header}>
            <h1 style={styles.title}>Pendientes</h1>
            <p style={styles.subtitle}>Anotá gastos para registrar más tarde</p>
          </div>
        )}

        {/* Input */}
        <div style={styles.inputRow}>
          <input
            style={styles.input}
            placeholder="Anotar gasto pendiente..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            disabled={adding}
            autoComplete="off"
          />
          <button
            style={styles.addBtn(!input.trim() || adding)}
            onClick={handleAdd}
            disabled={!input.trim() || adding}
            aria-label="Agregar"
          >
            {adding ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={16} />}
          </button>
        </div>

        {/* Stats bar */}
        {notes.length > 0 && (
          <div style={styles.statsBar}>
            <span style={styles.statsText}>
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}{completedCount > 0 ? ` · ${completedCount} completado${completedCount !== 1 ? 's' : ''}` : ''}
            </span>
            {completedCount > 0 && (
              <button style={styles.clearBtn} onClick={handleClearCompleted}>
                Limpiar completados
              </button>
            )}
          </div>
        )}

        {/* States */}
        {loading ? (
          <SkeletonList />
        ) : error ? (
          <div style={styles.center}>
            <p style={styles.errorText}>{error}</p>
            <button
              onClick={loadNotes}
              style={{ fontSize: 13, color: 'var(--color-accent)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Reintentar
            </button>
          </div>
        ) : notes.length === 0 ? (
          <div style={styles.center}>
            <div style={styles.emptyIcon}>
              <NotebookPen size={24} color="var(--text-muted)" />
            </div>
            <p style={styles.emptyTitle}>Sin pendientes</p>
            <p style={styles.emptySubtitle}>
              Anotá acá lo que necesitás<br />registrar más tarde.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {sortedNotes.map(note => (
              <div key={note.id} style={styles.noteCard(note.completed)}>
                <button
                  style={styles.toggleBtn(note.completed)}
                  onClick={() => handleToggle(note)}
                  aria-label={note.completed ? 'Marcar como pendiente' : 'Marcar como completado'}
                >
                  {note.completed && <Check size={11} color="#fff" strokeWidth={3} />}
                </button>
                <span style={styles.noteText(note.completed)}>{note.text}</span>
                <button
                  style={styles.deleteBtn}
                  onClick={() => handleDelete(note.id)}
                  disabled={deletingId === note.id}
                  aria-label="Eliminar"
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  {deletingId === note.id
                    ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Trash2 size={14} />
                  }
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
