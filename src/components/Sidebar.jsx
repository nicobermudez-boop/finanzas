import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useIsMobile from '../hooks/useIsMobile'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { usePrivacy } from '../context/PrivacyContext'
import {
  TrendingUp,
  PlusCircle,
  Table2,
  LogOut,
  ChevronLeft,
  Sun,
  Moon,
  Monitor,
  ClipboardList,
  Settings,
  LayoutDashboard,
  Search,
  Eye,
  EyeOff,
} from 'lucide-react'

const navSections = [
  {
    items: [
      { path: '/carga', label: 'Carga', icon: PlusCircle },
    ]
  },
  {
    label: 'Analytics',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/evolucion', label: 'Evolución', icon: TrendingUp },
      { path: '/gastos', label: 'Gastos', icon: Search },
      { path: '/detallado', label: 'Detallado', icon: Table2 },
    ]
  },
  {
    label: 'Ajustes',
    items: [
      { path: '/historial', label: 'Historial', icon: ClipboardList },
      { path: '/configuracion', label: 'Config', icon: Settings },
    ]
  },
]

const themeConfig = {
  auto: { icon: Monitor, label: 'Auto', next: 'light' },
  light: { icon: Sun, label: 'Claro', next: 'dark' },
  dark: { icon: Moon, label: 'Oscuro', next: 'auto' },
}

const styles = {
  sidebar: (collapsed) => ({
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: collapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 50,
    overflow: 'hidden',
  }),
  logo: {
    padding: '20px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    borderBottom: '1px solid var(--border-subtle)',
    minHeight: 64,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--color-accent), #6366f1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
    flexShrink: 0,
  },
  nav: {
    flex: 1,
    padding: '12px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    overflowY: 'auto',
  },
  navItem: (active, collapsed) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: collapsed ? '11px 0' : '11px 14px',
    justifyContent: collapsed ? 'center' : 'flex-start',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    background: active ? 'var(--bg-active)' : 'transparent',
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    transition: 'all 0.15s ease',
    border: 'none',
    width: '100%',
    fontSize: 14,
    fontFamily: 'inherit',
    fontWeight: active ? 500 : 400,
    textDecoration: 'none',
    position: 'relative',
  }),
  navIcon: { width: 20, height: 20, flexShrink: 0 },
  footer: {
    padding: '12px 10px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  footerBtn: (collapsed) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: collapsed ? 'center' : 'flex-start',
    gap: 12,
    padding: collapsed ? '11px 0' : '11px 14px',
    width: '100%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    fontSize: 13,
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  }),
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const isMobile = useIsMobile()
  const location = useLocation()
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { mode, cycleTheme } = useTheme()
  const { hideNumbers, toggleHideNumbers } = usePrivacy()

  if (isMobile) return null

  const isCollapsed = collapsed

  const handleNav = (path) => {
    navigate(path)
  }

  const ThemeIcon = themeConfig[mode].icon

  const sidebarContent = (
    <div style={styles.sidebar(isCollapsed)}>
      <div style={styles.logo}>
        <div style={styles.logoIcon}>💰</div>
        {!isCollapsed && (
          <div style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}>
            <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: '-0.02em' }}>
              Finanzas
            </div>
          </div>
        )}
      </div>

      <nav style={styles.nav}>
        {navSections.map((section, si) => (
          <div key={si}>
            {section.label && !isCollapsed && (
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.1em', color: 'var(--text-dim)',
                padding: '16px 14px 6px', userSelect: 'none',
              }}>
                {section.label}
              </div>
            )}
            {section.label && isCollapsed && (
              <div style={{
                height: 1, background: 'var(--border-subtle)',
                margin: '8px 10px',
              }} />
            )}
            {section.items.map(item => {
              const active = location.pathname === item.path
              const Icon = item.icon
              return (
                <button
                  key={item.path}
                  onClick={() => handleNav(item.path)}
                  style={styles.navItem(active, isCollapsed)}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'var(--bg-hover)'
                      e.currentTarget.style.color = 'var(--text-primary)'
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = 'var(--text-secondary)'
                    }
                  }}
                  title={isCollapsed ? item.label : ''}
                >
                  <Icon style={styles.navIcon} />
                  {!isCollapsed && <span>{item.label}</span>}
                  {active && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%',
                      transform: 'translateY(-50%)', width: 3, height: 20,
                      borderRadius: '0 3px 3px 0', background: 'var(--color-accent)',
                    }} />
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={styles.footer}>
        <button
          onClick={toggleHideNumbers}
          style={styles.footerBtn(isCollapsed)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title={isCollapsed ? (hideNumbers ? 'Mostrar cifras' : 'Ocultar cifras') : ''}
        >
          {hideNumbers ? <EyeOff size={18} /> : <Eye size={18} />}
          {!isCollapsed && <span>{hideNumbers ? 'Mostrar cifras' : 'Ocultar cifras'}</span>}
        </button>

        <button
          onClick={cycleTheme}
          style={styles.footerBtn(isCollapsed)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          title={isCollapsed ? `Tema: ${themeConfig[mode].label}` : ''}
        >
          <ThemeIcon size={18} />
          {!isCollapsed && <span>{themeConfig[mode].label}</span>}
        </button>

        <button
          onClick={signOut}
          style={styles.footerBtn(isCollapsed)}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--color-expense-light)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Cerrar sesión</span>}
        </button>

        {!isMobile && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            style={styles.footerBtn(collapsed)}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <ChevronLeft size={18} style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s ease' }} />
            {!collapsed && <span>Colapsar</span>}
          </button>
        )}
      </div>
    </div>
  )

  return sidebarContent
}
