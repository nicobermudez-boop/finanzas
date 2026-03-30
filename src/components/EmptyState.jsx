// EmptyState — centered message with icon and optional CTA

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      gap: 12,
      textAlign: 'center',
      height: '100%',
      minHeight: 200,
    }}>
      {Icon && (
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 4,
        }}>
          <Icon size={26} color="var(--text-dim)" strokeWidth={1.5} />
        </div>
      )}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            borderRadius: 'var(--radius-md)',
            border: 'none',
            background: 'var(--color-accent)',
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
