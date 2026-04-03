import { memo, useState } from 'react'
import { Pencil, ArrowRightLeft, Trash2, ChevronRight, Plus } from 'lucide-react'
import CategoryIcon from '../../components/CategoryIcon'
import { ICON_LIST, getIconColor } from '../../lib/categoryIcons'

function CrudList({ items, onAdd, onRename, onMove, onDelete, entityName, onNavigate, moveTargets, moveLabel, onChangeIcon }) {
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [moveId, setMoveId] = useState(null)
  const [moveTo, setMoveTo] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [reassignTo, setReassignTo] = useState('')
  const [pickerOpenId, setPickerOpenId] = useState(null)

  const handleAdd = () => { if (!newName.trim()) return; onAdd(newName.trim()); setNewName(''); setAdding(false) }
  const handleRename = () => { if (!editName.trim() || !editId) return; onRename(editId, editName.trim()); setEditId(null) }
  const handleMove = () => { if (!moveId || !moveTo) return; onMove(moveId, moveTo); setMoveId(null); setMoveTo('') }
  const handleDelete = (item) => {
    if (item.txCount > 0) { setDeleteConfirm(item); setReassignTo('') }
    else { setDeleteConfirm(item); setReassignTo('__none__') }
  }
  const confirmDelete = () => {
    if (!deleteConfirm) return
    onDelete(deleteConfirm.id, reassignTo === '__none__' ? null : reassignTo)
    setDeleteConfirm(null); setReassignTo('')
  }

  const inputS = { padding: '7px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', fontFamily: 'inherit', flex: 1, minWidth: 0 }
  const btnSm = (color = 'var(--text-dim)') => ({ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color, display: 'flex', alignItems: 'center' })

  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 'var(--radius-sm)', borderBottom: '1px solid var(--border-subtle)', position: 'relative' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          {editId === item.id ? (
            <>
              {onChangeIcon && (
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setPickerOpenId(pickerOpenId === item.id ? null : item.id)}
                    style={{ ...btnSm('var(--text-secondary)'), padding: '4px 6px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)' }}
                    title="Cambiar ícono">
                    <CategoryIcon name={item.icon} size={15} />
                  </button>
                  {pickerOpenId === item.id && (
                    <div style={{ position: 'absolute', top: '110%', left: 0, zIndex: 200, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', display: 'grid', gridTemplateColumns: 'repeat(6, 32px)', gap: 4 }}>
                      {ICON_LIST.map(iconName => (
                        <button key={iconName} onClick={() => { onChangeIcon(item.id, iconName); setPickerOpenId(null) }}
                          title={iconName}
                          style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: item.icon === iconName ? 'var(--color-accent)' : 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: item.icon === iconName ? '#fff' : 'var(--text-secondary)' }}>
                          <CategoryIcon name={iconName} size={14} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <input value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setEditId(null); setPickerOpenId(null) } }} style={inputS} autoFocus />
              <button onClick={handleRename} style={{ ...btnSm('var(--color-income)'), fontSize: 13, fontWeight: 700 }}>✓</button>
              <button onClick={() => { setEditId(null); setPickerOpenId(null) }} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
            </>
          ) : moveId === item.id ? (
            <>
              <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>Mover <strong>{item.name}</strong> a:</div>
              <select value={moveTo} onChange={e => setMoveTo(e.target.value)} style={{ ...inputS, flex: 'none', minWidth: 150 }}>
                <option value="">{moveLabel || 'Seleccionar...'}</option>
                {(moveTargets || []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <button onClick={handleMove} disabled={!moveTo} style={{ ...btnSm(moveTo ? 'var(--color-income)' : 'var(--text-dim)'), fontSize: 13, fontWeight: 700 }}>✓</button>
              <button onClick={() => { setMoveId(null); setMoveTo('') }} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0, cursor: onNavigate ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => onNavigate && onNavigate(item.id)}>
                {item.icon && <span style={{ color: getIconColor(item.icon), display: 'flex', alignItems: 'center', flexShrink: 0 }}><CategoryIcon name={item.icon} size={15} /></span>}
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{item.name}</div>
                  {item.parentName && <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{item.parentName}</div>}
                </div>
              </div>
              {item.txCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: "'JetBrains Mono', monospace" }}>{item.txCount} tx</span>}
              <button onClick={() => { setEditId(item.id); setEditName(item.name) }} style={btnSm()} title="Renombrar"><Pencil size={13} /></button>
              {onMove && <button onClick={() => setMoveId(item.id)} style={btnSm()} title="Mover"><ArrowRightLeft size={13} /></button>}
              <button onClick={() => handleDelete(item)} style={btnSm('var(--color-expense-light)')} title="Eliminar"><Trash2 size={13} /></button>
              {onNavigate && <ChevronRight size={14} style={{ color: 'var(--text-dim)', cursor: 'pointer' }} onClick={() => onNavigate(item.id)} />}
            </>
          )}
        </div>
      ))}

      {/* Add new */}
      {adding ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8, padding: '4px 8px' }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setNewName('') } }} placeholder={`Nuevo ${entityName}...`} style={inputS} autoFocus />
          <button onClick={handleAdd} style={{ ...btnSm('var(--color-income)'), fontSize: 13, fontWeight: 700 }}>✓</button>
          <button onClick={() => { setAdding(false); setNewName('') }} style={{ ...btnSm(), fontSize: 13 }}>✕</button>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, padding: '8px 10px', background: 'none', border: '1px dashed var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}>
          <Plus size={13} /> Agregar {entityName}
        </button>
      )}

      {/* Delete/Reassign modal */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: 24, maxWidth: 420, width: '100%', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, color: 'var(--text-primary)' }}>
              {deleteConfirm.txCount > 0 ? 'Reasignar y eliminar' : 'Confirmar eliminación'}
            </div>
            {deleteConfirm.txCount > 0 ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                  <strong>&quot;{deleteConfirm.name}&quot;</strong> tiene <strong>{deleteConfirm.txCount}</strong> transacciones. Elegí a dónde reasignarlas:
                </div>
                <select value={reassignTo} onChange={e => setReassignTo(e.target.value)} style={{ ...inputS, width: '100%', marginBottom: 16, flex: 'none' }}>
                  <option value="">Seleccionar destino...</option>
                  {items.filter(i => i.id !== deleteConfirm.id).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
                ¿Estás seguro de eliminar <strong>&quot;{deleteConfirm.name}&quot;</strong>? Esta acción no se puede deshacer.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setDeleteConfirm(null); setReassignTo('') }} style={{ padding: '8px 16px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
              <button onClick={confirmDelete} disabled={deleteConfirm.txCount > 0 && !reassignTo} style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                background: (deleteConfirm.txCount === 0 || reassignTo) ? 'var(--color-expense)' : 'var(--bg-tertiary)',
                color: (deleteConfirm.txCount === 0 || reassignTo) ? '#fff' : 'var(--text-dim)',
                cursor: (deleteConfirm.txCount === 0 || reassignTo) ? 'pointer' : 'not-allowed',
              }}>{deleteConfirm.txCount > 0 ? 'Reasignar y eliminar' : 'Eliminar'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(CrudList)
