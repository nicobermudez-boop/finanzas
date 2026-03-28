import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, TrendingUp, Search } from 'lucide-react'
import { useMobileHeader } from '../context/MobileHeaderContext'

const tabs = [
  { path: '/analytics/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/analytics/evolucion', label: 'Evolución', icon: TrendingUp },
  { path: '/analytics/gastos', label: 'Gastos', icon: Search },
]

export default function AnalyticsHub() {
  const navigate = useNavigate()
  const location = useLocation()
  const { hidden } = useMobileHeader()

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        position: 'sticky',
        top: 44,
        zIndex: 55,
        transform: hidden ? 'translateY(-44px)' : 'translateY(0)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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
      <div>
        <Outlet />
      </div>
    </div>
  )
}
