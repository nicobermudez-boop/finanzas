import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Search } from 'lucide-react'

const tabs = [
  { path: '/analytics/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/analytics/evolucion', label: 'Evolución', icon: TrendingUp },
  { path: '/analytics/gastos', label: 'Gastos', icon: Search },
]

export default function AnalyticsHub() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
      }}>
        {tabs.map((tab) => {
          const active = location.pathname === tab.path
          const Icon = tab.icon
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 20px',
                border: 'none',
                borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--text-secondary)',
                fontFamily: 'inherit',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                marginBottom: -1,
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Outlet />
      </div>
    </div>
  )
}
