import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface CreditCard {
  account_id: string;
  name: string;
  current: number;
  limit: number;
  utilization: number;
  last_statement_balance: number;
  last_payment_date: string;
  last_payment_amount: number;
  minimum_payment_amount: number;
  next_payment_due_date: string;
  is_overdue: boolean;
}

interface CreditCardData {
  cards: CreditCard[];
}

const DEFAULT: CreditCardData = { cards: [] };

export function CreditCardDetailsTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<CreditCardData>('plaid-credit-card-details', DEFAULT);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  const barColor = (util: number) =>
    util > 80 ? '#ef4444' : util > 50 ? '#f59e0b' : '#22c55e';

  return (
    <BaseTile loading={loading()} error={error()} style={{ gap: '16px', height: '100%', overflow: 'auto', padding: '4px' }}>
      {store().cards.length === 0 && (
        <div style={{ 'text-align': 'center', color: 'var(--text-secondary)', 'font-size': '13px', padding: '20px' }}>No credit cards</div>
      )}
      {store().cards.map(card => (
        <div style={{ background: 'var(--tile-bg, #1e2432)', 'border-radius': '8px', padding: '12px' }}>
          <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', 'margin-bottom': '8px' }}>
            <span style={{ 'font-weight': '600', 'font-size': '13px' }}>{card.name}</span>
            {card.is_overdue && (
              <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', 'border-radius': '4px', 'font-size': '10px', 'font-weight': '700' }}>OVERDUE</span>
            )}
          </div>
          <div style={{ 'margin-bottom': '8px' }}>
            <div style={{ display: 'flex', 'justify-content': 'space-between', 'font-size': '11px', color: 'var(--text-secondary)', 'margin-bottom': '3px' }}>
              <span>{fmt(card.current)} / {fmt(card.limit)}</span>
              <span>{card.utilization}% used</span>
            </div>
            <div style={{ background: 'var(--border-color, #2a3040)', 'border-radius': '4px', height: '6px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(card.utilization, 100)}%`, background: barColor(card.utilization), height: '100%', 'border-radius': '4px', transition: 'width 0.3s' }} />
            </div>
          </div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(2, 1fr)', gap: '4px', 'font-size': '11px' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Last Statement: </span>{fmt(card.last_statement_balance)}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Last Payment: </span>{fmt(card.last_payment_amount)}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Min Due: </span>{fmt(card.minimum_payment_amount)}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Due Date: </span>{card.next_payment_due_date || '—'}</div>
          </div>
        </div>
      ))}
    </BaseTile>
  );
}
