import { fmtForm as fmt } from '../lib/format'

// RecentTransactions — últimas transacciones con click para repetir
export default function RecentTransactions({ transactions, onRepeat }) {
  if (!transactions.length) return (
    <div className="rs">
      <div className="rt">Últimos registros</div>
      <div style={{ padding: '16px 12px', color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>
        Los últimos movimientos aparecerán acá.
      </div>
    </div>
  )

  return (
    <div className="rs">
      <div className="rt">Últimos registros</div>
      {transactions.map(tx => (
        <div key={tx.id} className="ri" onClick={() => onRepeat(tx)} title="Repetir transacción">
          <div className="rl">
            <span className="rx">{tx.categories?.icon || '💰'}</span>
            <div className="rn">
              <div className="rc2">
                {tx.concepts?.name || tx.income_concept || ''}
                {tx.destination && <span style={{ color: 'var(--text-muted)' }}> · {tx.destination}</span>}
                {tx.description && tx.description !== (tx.concepts?.name || tx.income_concept) && (
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> · {tx.description}</span>
                )}
              </div>
              <div className="rd">
                {tx.categories?.name || 'Ingresos'} · {tx.person} · {tx.date}
                {tx.installments > 1 && ` · ${tx.installment_number}/${tx.installments}`}
                {tx.income_subtype === 'extraordinario' && ' · ⭐'}
                {tx.is_recurring && ' · 🔄'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div className={`ra ${tx.type}`}>
              {tx.type === 'expense' ? '−' : '+'}{fmt(tx.amount, tx.currency)}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-muted)', opacity: 0.6 }}>↩</span>
          </div>
        </div>
      ))}
    </div>
  )
}
