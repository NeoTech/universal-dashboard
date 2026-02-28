import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { PlaidTransaction } from '../../data/plaid';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function channelVariant(channel: string): BadgeVariant {
  switch (channel) {
    case 'online': return 'neutral';
    case 'in store': return 'success';
    default: return 'neutral';
  }
}

export function TransactionsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ transactions: PlaidTransaction[] }>('plaid-transactions', { transactions: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().transactions, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile plaid-transactions-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Merchant</th>
              <th>Amount</th>
              <th>Category</th>
              <th>Channel</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().transactions.length === 0}>
              <tr><td colspan="5" class="cell-empty">No transactions</td></tr>
            </Show>
            <For each={pageItems()}>
              {(tx) => {
                const currency = tx.iso_currency_code ?? 'USD';
                const amountColor = tx.amount > 0 ? 'var(--color-danger)' : 'var(--color-success)';
                const category = tx.category?.[0] ?? '';
                return (
                  <tr>
                    <td>{tx.date}</td>
                    <td>{tx.merchant_name ?? tx.name}</td>
                    <td style={{ color: amountColor }}>{currency} {Math.abs(tx.amount).toFixed(2)}</td>
                    <td>{category}</td>
                    <td><Badge variant={channelVariant(tx.payment_channel)}>{tx.payment_channel}</Badge></td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
    </BaseTile>
  );
}
