import { useLocation, useNavigate } from 'react-router-dom'
import { BarChart2, ClipboardList, PlusCircle, BookOpen, Settings } from 'lucide-react'

const tabs = [
  {
    label: 'Analytics',
    icon: BarChart2,
    defaultPath: '/analytics',
    groups: ['/analytics', '/dashboard', '/evolucion', '/gastos'],
  },
  {
    label: 'Historial',
    icon: ClipboardList,
    defaultPath: '/transacciones',
    groups: ['/transacciones', '/historial', '/detallado'],
  },
  {
    label: null,
    icon: PlusCircle,
    defaultPath: '/carga',
    groups: ['/carga'],
    center: true,
  },
  {
    label: 'Pendientes',
    icon: BookOpen,
    defaultPath: '/pendientes',
    groups: ['/pendientes'],
  },
  {
    label: 'Ajustes',
    icon: Settings,
    defaultPath: '/configuracion',
    groups: ['/configuracion'],
  },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  const isActive = (tab) =>
    tab.groups.some((g) => location.pathname.startsWith(g))

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 64,
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      zIndex: 50,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map((tab) => {
        const active = isActive(tab)
        const Icon = tab.icon

        if (tab.center) {
          return (
            <button
              key={tab.defaultPath}
              onClick={() => navigate(tab.defaultPath)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'var(--color-accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 0,
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)',
              }}>
                <Icon size={24} color="#fff" />
              </div>
            </button>
          )
        }

        return (
          <button
            key={tab.defaultPath}
            onClick={() => navigate(tab.defaultPath)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              height: '100%',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: active ? 'var(--color-accent)' : 'var(--text-muted)',
              padding: 0,
              transition: 'color 0.15s ease',
            }}
          >
            <Icon size={20} />
            <span style={{
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: active ? 600 : 400,
              letterSpacing: '-0.01em',
            }}>
              {tab.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
