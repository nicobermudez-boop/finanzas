import { useState, useEffect, useRef, useCallback } from 'react'
import { Plus, Trash2, Check, NotebookPen, Loader2, Undo2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SkeletonList } from '../components/Skeleton'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import useIsMobile from '../hooks/useIsMobile'

const styles = {
  container: (isMobile) => ({
    padding: isMobile ? '16px 16px 80px' : '32px',
    background: 'var(--bg-primary)',
    minHeight: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
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
    position: 'sticky',
    top: 0,
    background: 'var(--bg-primary)',
    zIndex: 10,
    padding: '4px 0 12px',
    marginTop: -4,
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  addBtn: (disabled) => ({
    width: 44,
    height: 44,
    borderRadius: '50%',
    border: 'none',
    background: disabled ? 'var(--bg-hover)' : 'var(--color-accent)',
    color: disabled ? 'var(--text-muted)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    transform: disabled ? 'scale(0.95)' : 'scale(1)',
    boxShadow: disabled ? 'none' : '0 4px 12px rgba(var(--color-accent-rgb), 0.3)',
  }),
  statsBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 4px',
  },
  statsText: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  clearBtn: {
    fontSize: 12,
    color: 'var(--color-expense)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    padding: '4px 8px',
    borderRadius: 6,
    transition: 'all 0.15s',
    fontWeight: 600,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  cardWrapper: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 'var(--radius-md)',
    userSelect: 'none',
  },
  gestureBg: (type) => ({
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: type === 'delete' ? 'flex-end' : 'flex-start',
    padding: '0 24px',
    background: type === 'delete' ? 'var(--color-expense)' : 'var(--color-income)',
    color: '#fff',
    zIndex: 1,
  }),
  noteCard: (completed, isMobile, isSwiping) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 16px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    position: 'relative',
    zIndex: 2,
    transition: isSwiping ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    opacity: completed ? 0.6 : 1,
    cursor: isMobile ? 'grab' : 'pointer',
    boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
  }),
  toggleBtn: (completed) => ({
    width: 24,
    height: 24,
    borderRadius: '50%',
    border: `2px solid ${completed ? 'var(--color-accent)' : 'var(--border)'}`,
    background: completed ? 'var(--color-accent)' : 'var(--bg-primary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    padding: 0,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: completed ? '0 2px 8px rgba(var(--color-accent-rgb), 0.4)' : 'inset 0 1px 3px rgba(0,0,0,0.05)',
  }),
  noteText: (completed) => ({
    flex: 1,
    fontSize: 14,
    color: completed ? 'var(--text-muted)' : 'var(--text-primary)',
    textDecoration: completed ? 'line-through' : 'none',
    lineHeight: 1.4,
    wordBreak: 'break-word',
    fontWeight: completed ? 400 : 500,
    transition: 'all 0.2s',
  }),
  deleteBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 6,
    borderRadius: 6,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
    transition: 'all 0.15s',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 0',
    gap: 16,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: '20px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 16px rgba(0,0,0,0.05)',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: 0,
  },
  emptySubtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    margin: 0,
    lineHeight: 1.6,
  },
  toast: {
    position: 'fixed',
    bottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--text-primary)',
    color: 'var(--bg-primary)',
    padding: '12px 20px',
    borderRadius: 'var(--radius-xl)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    zIndex: 100,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    animation: 'toastIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards',
  },
  undoBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: 'none',
    color: 'inherit',
    padding: '4px 10px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  }
}

function SwipeableNote({ note, isMobile, onToggle, onDelete, onRegister, deletingId }) {
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef(0)
  const threshold = 100

  const handleTouchStart = (e) => {
    if (!isMobile) return
    startX.current = e.touches[0].clientX
    setIsSwiping(true)
  }

  const handleTouchMove = (e) => {
    if (!isSwiping) return
    const currentX = e.touches[0].clientX
    const diff = currentX - startX.current
    // Add resistance
    setOffset(diff)
  }

  const handleTouchEnd = () => {
    setIsSwiping(false)
    if (offset > threshold) {
      onRegister(note)
    } else if (offset < -threshold) {
      onDelete(note)
    }
    setOffset(0)
  }

  return (
    <div style={styles.cardWrapper}>
      {offset < 0 && (
        <div style={styles.gestureBg('delete')}>
          <Trash2 size={20} />
        </div>
      )}
      {offset > 0 && (
        <div style={styles.gestureBg('register')}>
          <Plus size={20} />
        </div>
      )}
      <div
        style={{
          ...styles.noteCard(note.completed, isMobile, isSwiping),
          transform: `translateX(${offset}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => !isMobile && onRegister(note)}
      >
        <button
          style={styles.toggleBtn(note.completed)}
          onClick={(e) => { e.stopPropagation(); onToggle(note) }}
          aria-label={note.completed ? 'Marcar como pendiente' : 'Marcar como completado'}
        >
          {note.completed && <Check size={12} color="#fff" strokeWidth={4} />}
        </button>
        <span style={styles.noteText(note.completed)}>{note.text}</span>
        {!isMobile && (
          <button
            style={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(note) }}
            disabled={deletingId === note.id}
            aria-label="Eliminar"
            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-expense)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            {deletingId === note.id
              ? <Loader2 size={16} className="sb-spin" />
              : <Trash2 size={16} />
            }
          </button>
        )}
      </div>
    </div>
  )
}

export default function Pendientes() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [input, setInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [undoNote, setUndoNote] = useState(null)
  const undoTimeoutRef = useRef(null)

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

  const handleDelete = useCallback(async (note) => {
    if (undoTimeoutRef.current && undoNote) {
      clearTimeout(undoTimeoutRef.current)
      // Execute previous pending delete immediately
      supabase.from('pending_notes').delete().eq('id', undoNote.id).eq('user_id', user.id)
    }

    setUndoNote(note)
    setNotes(prev => prev.filter(n => n.id !== note.id))

    undoTimeoutRef.current = setTimeout(async () => {
      await supabase.from('pending_notes').delete().eq('id', note.id).eq('user_id', user.id)
      setUndoNote(null)
      undoTimeoutRef.current = null
    }, 5000)
  }, [user.id, undoNote])


  const handleUndo = () => {
    if (undoTimeoutRef.current && undoNote) {
      clearTimeout(undoTimeoutRef.current)
      undoTimeoutRef.current = null
      setNotes(prev => [undoNote, ...prev].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)))
      setUndoNote(null)
    }
  }

  const handleRegister = useCallback(async (note) => {
    // 1. Mark as completed
    await supabase.from('pending_notes').update({ completed: true }).eq('id', note.id).eq('user_id', user.id)
    // 2. Preload in Carga
    localStorage.setItem('carga-desc', JSON.stringify(note.text))

    // 3. Navigate
    navigate('/carga')
  }, [navigate, user.id])

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
            {adding ? <Loader2 size={18} className="sb-spin" /> : <Plus size={18} />}
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
              <NotebookPen size={32} color="var(--text-muted)" />
            </div>
            <p style={styles.emptyTitle}>Sin pendientes</p>
            <p style={styles.emptySubtitle}>
              Anotá acá lo que necesitás<br />registrar más tarde.
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {sortedNotes.map(note => (
              <SwipeableNote
                key={note.id}
                note={note}
                isMobile={isMobile}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRegister={handleRegister}
                deletingId={deletingId}
              />
            ))}
          </div>
        )}
      </div>

      {undoNote && (
        <div style={styles.toast}>
          <span>1 fila eliminada</span>
          <button style={styles.undoBtn} onClick={handleUndo}>
            <Undo2 size={14} /> DESHACER
          </button>
        </div>
      )}

      <style>{`
        @keyframes sb-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .sb-spin { animation: sb-spin 1s linear infinite; }
        @keyframes toastIn {
          from { transform: translate(-50%, 100px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
