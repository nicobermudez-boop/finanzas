import { ArrowLeftRight } from 'lucide-react'

export default function CurrencyToggle({ currency, onChange }) {
  return (
    <button
      onClick={() => onChange(currency === 'ARS' ? 'USD' : 'ARS')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-tertiary)',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        fontFamily: "'JetBrains Mono', monospace",
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        letterSpacing: '0.05em',
      }}
    >
      {currency}
      <ArrowLeftRight size={12} color="var(--text-muted)" />
    </button>
  )
}
