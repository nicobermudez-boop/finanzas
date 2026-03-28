import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { TrendingUp, Tag, Users, Upload, User } from 'lucide-react'
import RatesTab from './RatesTab'
import CategoriesTab from './CategoriesTab'
import PersonsTab from './PersonsTab'
import ImportTab from './ImportTab'
import AccountTab from './AccountTab'

const TABS = [
  { key: 'categories', label: 'Categorías', icon: Tag },
  { key: 'persons', label: 'Personas', icon: Users },
  { key: 'rates', label: 'Cotizaciones', icon: TrendingUp },
  { key: 'import', label: 'Importar', icon: Upload },
  { key: 'account', label: 'Cuenta', icon: User },
]

export default function Configuracion() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('categories')

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        flexShrink: 0,
        overflowX: 'auto',
      }}>
        {TABS.map(t => {
          const active = activeTab === t.key
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '12px 20px',
                border: 'none',
                borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
                background: 'transparent',
                color: active ? 'var(--color-accent)' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: active ? 600 : 400,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
                marginBottom: -1,
              }}
            >
              <Icon size={16} />
              {t.label}
            </button>
          )
        })}
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {activeTab === 'rates' && <RatesTab />}
        {activeTab === 'categories' && <CategoriesTab user={user} />}
        {activeTab === 'persons' && <PersonsTab user={user} />}
        {activeTab === 'import' && <ImportTab user={user} />}
        {activeTab === 'account' && <AccountTab user={user} />}
      </div>
    </div>
  )
}
