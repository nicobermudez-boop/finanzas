// CategoryGrid — expense category selector grid
// Shows the selected category (with ✕ to deselect) or the full grid to pick from.
import CategoryIcon from './CategoryIcon'
import { getIconColor } from '../lib/categoryIcons'

function iconStyle(iconName) {
  const color = getIconColor(iconName)
  return {
    color,
    background: color + '22', // ~13% opacity tint
    borderRadius: '50%',
    width: 40,
    height: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }
}

export default function CategoryGrid({ categories, selectedId, selectedCat, onSelect, onClear }) {
  return (
    <div className="cg">
      {selectedId ? (
        <button className="cc s" onClick={() => onSelect(selectedId)} style={{ position: 'relative' }}>
          <div className="ci"><div style={iconStyle(selectedCat?.icon)}><CategoryIcon name={selectedCat?.icon} size={19} /></div></div>
          <div className="cn">{selectedCat?.name}</div>
          <span
            onClick={e => { e.stopPropagation(); onClear() }}
            style={{ position: 'absolute', top: 4, right: 6, fontSize: 12, color: 'var(--text-dim)', cursor: 'pointer', lineHeight: 1 }}>
            ✕
          </span>
        </button>
      ) : categories.map(c => (
        <button key={c.id} className="cc" onClick={() => onSelect(c.id)}>
          <div className="ci"><div style={iconStyle(c.icon)}><CategoryIcon name={c.icon} size={19} /></div></div>
          <div className="cn">{c.name}</div>
        </button>
      ))}
    </div>
  )
}
