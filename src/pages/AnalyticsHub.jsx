import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const tabs = [
  { path: '/analytics/dashboard', label: 'Dashboard' },
  { path: '/analytics/evolucion', label: 'Evolución' },
  { path: '/analytics/gastos', label: 'Gastos' },
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
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              style={{
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
