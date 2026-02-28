import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface InvTx {
  investment_transaction_id: string;
  account_id: string;
  security_id?: string;
  date: string;
  name: string;
  quantity: number;
  amount: number;
  fees?: number;
  type: string;
  subtype: string;
  ticker_symbol: string;
}

interface InvestmentTransactionsData {
  transactions: InvTx[];
}

const DEFAULT: InvestmentTransactionsData = { transactions: [] };

export function InvestmentTransactionsTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<InvestmentTransactionsData>('plaid-investment-transactions', DEFAULT);
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().transactions, 10);

  const badgeStyle = (subtype: string) => {
    const variant = subtype === 'buy' ? '#22c55e' : subtype === 'sell' ? '#ef4444' : subtype === 'dividend' ? '#94a3b8' : '#f59e0b';
    return { background: variant, color: '#fff', padding: '1px 6px', 'border-radius': '4px', 'font-size': '10px', 'font-weight': '600' };
  };

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <BaseTile loading={loading()} error={error()} style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ 'overflow-y': 'auto', flex: '1' }}>
        <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px' }}>
          <thead>
            <tr style={{ 'border-bottom': '1px solid var(--border-color)' }}>
              <th style={{ 'text-align': 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Date</th>
              <th style={{ 'text-align': 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Security</th>
              <th style={{ 'text-align': 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Type</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Qty</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {store().transactions.length === 0 && (
              <tr>
                <td colspan={5} style={{ 'text-align': 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No investment transactions
                </td>
              </tr>
            )}
            <For each={pageItems()}>
              {(tx) => (
              <tr style={{ 'border-bottom': '1px solid var(--border-color)' }}>
                <td style={{ padding: '4px 6px', color: 'var(--text-secondary)', 'white-space': 'nowrap' }}>{tx.date}</td>
                <td style={{ padding: '4px 6px', 'max-width': '140px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                  {tx.ticker_symbol ? <span style={{ 'font-weight': '600' }}>{tx.ticker_symbol}</span> : tx.name}
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <span style={badgeStyle(tx.subtype)}>{tx.subtype}</span>
                </td>
                <td style={{ padding: '4px 6px', 'text-align': 'right' }}>{tx.quantity.toFixed(4)}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right', 'font-weight': '600' }}>{fmt(tx.amount)}</td>
              </tr>
            )}
            </For>
          </tbody>
        </table>
      </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
    </BaseTile>
  );
}
