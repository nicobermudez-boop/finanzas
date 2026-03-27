import { BookOpen } from 'lucide-react'

export default function Pendientes() {
  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '32px 24px',
      background: 'var(--bg-primary)',
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: 'var(--radius-xl)',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <BookOpen size={28} color="var(--text-muted)" />
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: 17, color: 'var(--text-primary)', marginBottom: 6 }}>
          Próximamente
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          Acá vas a poder anotar gastos pendientes<br />y recordatorios de pago.
        </div>
      </div>
    </div>
  )
}
