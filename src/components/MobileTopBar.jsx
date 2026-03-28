import { useLocation } from 'react-router-dom'
import { Sun, Moon, SunMoon, Eye, EyeOff } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { usePrivacy } from '../context/PrivacyContext'

const themeConfig = {
  auto:  { icon: SunMoon, next: 'light' },
  light: { icon: Sun,     next: 'dark'  },
  dark:  { icon: Moon,    next: 'auto'  },
}

function getTitle(pathname) {
  if (pathname.startsWith('/analytics'))     return 'Analytics'
  if (pathname.startsWith('/transacciones')) return 'Historial'
  if (pathname.startsWith('/carga'))         return 'Carga'
  if (pathname.startsWith('/configuracion')) return 'Ajustes'
  if (pathname.startsWith('/pendientes'))    return 'Pendientes'
  return 'Finanzas'
}

const btnStyle = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-secondary)',
  padding: 6,
  borderRadius: 8,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 32,
  height: 32,
  transition: 'color 0.15s ease',
}

export default function MobileTopBar({ hidden }) {
  const { pathname } = useLocation()
  const { mode, cycleTheme } = useTheme()
  const { hideNumbers, toggleHideNumbers } = usePrivacy()

  const ThemeIcon = themeConfig[mode].icon
  const PrivacyIcon = hideNumbers ? EyeOff : Eye

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 60,
      height: 44,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 12px 0 16px',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-subtle)',
      transform: hidden ? 'translateY(-100%)' : 'translateY(0)',
      transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      flexShrink: 0,
    }}>
      {/* Left: logo + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src="/icons/icon-192x192.png"
          alt="Finanzas"
          style={{ width: 24, height: 24, borderRadius: 6 }}
        />
        <span style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text-primary)',
          letterSpacing: '-0.3px',
        }}>
          {getTitle(pathname)}
        </span>
      </div>

      {/* Right: privacy + theme toggles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button onClick={toggleHideNumbers} style={btnStyle} aria-label="Ocultar cifras">
          <PrivacyIcon size={18} />
        </button>
        <button onClick={cycleTheme} style={btnStyle} aria-label="Cambiar tema">
          <ThemeIcon size={18} />
        </button>
      </div>
    </div>
  )
}
