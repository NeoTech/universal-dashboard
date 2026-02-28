import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface InsiderData {
  transactions: unknown[];
  note: string;
}

interface Props { refreshInterval?: number; }

export function InsiderTransactionsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<InsiderData>('alphavantage-insider-transactions', { transactions: [], note: '' });

  const hasPremiumNote = () => store().note !== '' && store().transactions.length === 0;

  function extractRow(tx: unknown, i: number): { symbol: string; type: string; amount: string } {
    if (tx && typeof tx === 'object') {
      const obj = tx as Record<string, unknown>;
      return {
        symbol: String(obj['symbol'] ?? obj['SYMBOL'] ?? `Item ${i + 1}`),
        type: String(obj['type'] ?? obj['TYPE'] ?? 'N/A'),
        amount: String(obj['amount'] ?? obj['AMOUNT'] ?? obj['value'] ?? 'N/A'),
      };
    }
    return { symbol: `Item ${i + 1}`, type: 'N/A', amount: 'N/A' };
  }

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile insider-transactions-tile" skeletonLines={4}>
      <Show when={hasPremiumNote()}>
          <div class="premium-notice" style={{ padding: '16px', 'text-align': 'center' }}>
            <div style={{ 'font-size': '2rem', 'margin-bottom': '8px' }}>🔒</div>
            <p style={{ 'font-weight': 600, 'margin-bottom': '4px' }}>Premium Endpoint</p>
            <p style={{ 'font-size': '0.75rem', color: 'var(--color-text-secondary)' }}>{store().note}</p>
            <p style={{ 'font-size': '0.75rem', color: 'var(--color-text-secondary)', 'margin-top': '8px' }}>
              Upgrade to Alpha Vantage Premium to enable insider activity data.
            </p>
          </div>
        </Show>
        <Show when={!hasPremiumNote() && store().transactions.length > 0}>
          <table class="tile-table" style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.82rem' }}>
            <thead>
              <tr>
                <th style={{ 'text-align': 'left', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Symbol</th>
                <th style={{ 'text-align': 'left', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Type</th>
                <th style={{ 'text-align': 'right', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              <For each={store().transactions}>
                {(tx, i) => {
                  const row = extractRow(tx, i());
                  return (
                    <tr>
                      <td style={{ padding: '4px 6px', 'font-weight': 600 }}>{row.symbol}</td>
                      <td style={{ padding: '4px 6px', color: 'var(--color-text-secondary)' }}>{row.type}</td>
                      <td style={{ padding: '4px 6px', 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>{row.amount}</td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
        </Show>
        <Show when={!hasPremiumNote() && store().transactions.length === 0}>
          <p class="tile-empty" style={{ padding: '16px', 'text-align': 'center', color: 'var(--color-text-secondary)' }}>
            No insider transaction data available.
          </p>
        </Show>
    </BaseTile>
  );
}
