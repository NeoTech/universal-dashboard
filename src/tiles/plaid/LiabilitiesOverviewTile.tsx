import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface LiabilitiesData {
  totalOwed: number;
  byType: { credit: number; mortgage: number; student: number };
  accounts: { account_id: string; name: string; balance: number }[];
}

const DEFAULT: LiabilitiesData = { totalOwed: 0, byType: { credit: 0, mortgage: 0, student: 0 }, accounts: [] };

export function LiabilitiesOverviewTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<LiabilitiesData>('plaid-liabilities-overview', DEFAULT);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <BaseTile loading={loading()} error={error()} style={{ gap: '12px', height: '100%', overflow: 'auto', padding: '4px' }}>
      <div style={{ 'text-align': 'center' }}>
        <div style={{ 'font-size': '11px', color: 'var(--text-secondary)', 'text-transform': 'uppercase', 'letter-spacing': '0.05em' }}>Total Owed</div>
        <div style={{ 'font-size': '28px', 'font-weight': '700', color: '#ef4444' }}>{fmt(store().totalOwed)}</div>
      </div>
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(3, 1fr)', gap: '8px' }}>
        {[
          { label: 'Credit Cards', value: store().byType.credit },
          { label: 'Mortgage', value: store().byType.mortgage },
          { label: 'Student Loans', value: store().byType.student },
        ].map(item => (
          <div style={{ background: 'var(--tile-bg, #1e2432)', 'border-radius': '8px', padding: '10px', 'text-align': 'center' }}>
            <div style={{ 'font-size': '10px', color: 'var(--text-secondary)', 'margin-bottom': '4px' }}>{item.label}</div>
            <div style={{ 'font-size': '15px', 'font-weight': '600' }}>{fmt(item.value)}</div>
          </div>
        ))}
      </div>
      <div>
        {store().accounts.map(a => (
          <div style={{ display: 'flex', 'justify-content': 'space-between', padding: '6px 0', 'border-bottom': '1px solid var(--border-color)', 'font-size': '12px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{a.name}</span>
            <span style={{ 'font-weight': '600' }}>{fmt(a.balance)}</span>
          </div>
        ))}
        {store().accounts.length === 0 && (
          <div style={{ 'text-align': 'center', color: 'var(--text-secondary)', 'font-size': '12px', padding: '12px' }}>No liability accounts</div>
        )}
      </div>
    </BaseTile>
  );
}
