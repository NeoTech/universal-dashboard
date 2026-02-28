import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Mortgage {
  account_id: string;
  origination_principal_amount: number;
  outstanding_principal_balance: number;
  last_payment_amount: number;
  last_payment_date: string;
  current_late_fee: number;
  maturity_date: string;
  interest_rate_percentage: number;
  interest_rate_type: string;
  next_payment_due_date: string;
  next_monthly_payment: number;
  city: string;
  state: string;
}

interface MortgageData {
  mortgages: Mortgage[];
}

const DEFAULT: MortgageData = { mortgages: [] };

export function MortgageTrackerTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<MortgageData>('plaid-mortgage-tracker', DEFAULT);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <BaseTile loading={loading()} error={error()} style={{ gap: '16px', height: '100%', overflow: 'auto', padding: '4px' }}>
      {store().mortgages.length === 0 && (
        <div style={{ 'text-align': 'center', color: 'var(--text-secondary)', 'font-size': '13px', padding: '20px' }}>No mortgage data</div>
      )}
      {store().mortgages.map(m => (
        <div style={{ background: 'var(--tile-bg, #1e2432)', 'border-radius': '8px', padding: '12px' }}>
          {(m.city || m.state) && (
            <div style={{ 'font-weight': '600', 'font-size': '13px', 'margin-bottom': '8px' }}>
              🏠 {[m.city, m.state].filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ 'font-size': '24px', 'font-weight': '700', 'margin-bottom': '8px', color: '#f59e0b' }}>
            {fmt(m.outstanding_principal_balance)}
          </div>
          <div style={{ display: 'grid', 'grid-template-columns': 'repeat(2, 1fr)', gap: '6px', 'font-size': '11px' }}>
            <div><span style={{ color: 'var(--text-secondary)' }}>Rate: </span>{m.interest_rate_percentage}% {m.interest_rate_type}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Monthly: </span>{fmt(m.next_monthly_payment)}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Payoff: </span>{m.maturity_date || '—'}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Due: </span>{m.next_payment_due_date || '—'}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Last Payment: </span>{fmt(m.last_payment_amount)}</div>
            <div><span style={{ color: 'var(--text-secondary)' }}>Principal: </span>{fmt(m.origination_principal_amount)}</div>
          </div>
        </div>
      ))}
    </BaseTile>
  );
}
