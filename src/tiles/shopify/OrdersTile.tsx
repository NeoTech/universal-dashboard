import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { ShopifyOrder } from '../../data/shopify';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function financialBadge(status: ShopifyOrder['financial_status']): BadgeVariant {
  if (status === 'paid') return 'success';
  if (status === 'refunded' || status === 'voided') return 'neutral';
  if (status === 'pending' || status === 'authorized') return 'warning';
  return 'neutral';
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function OrdersTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ orders: ShopifyOrder[] }>('shopify-orders', { orders: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().orders, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile shopify-orders-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Fulfillment</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().orders.length === 0}>
              <tr><td colspan="6" class="cell-empty">No orders</td></tr>
            </Show>
            <For each={pageItems()}>
              {(order) => (
                <tr>
                  <td>{order.name}</td>
                  <td>{order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : order.email ?? '—'}</td>
                  <td>{order.currency} {parseFloat(order.total_price).toFixed(2)}</td>
                  <td><Badge variant={financialBadge(order.financial_status)}>{order.financial_status}</Badge></td>
                  <td>{order.fulfillment_status ?? 'unfulfilled'}</td>
                  <td>{timeAgo(order.created_at)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
