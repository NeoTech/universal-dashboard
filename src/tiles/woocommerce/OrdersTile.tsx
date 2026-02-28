import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { WooCommerceOrder } from '../../data/woocommerce';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function orderStatusBadge(status: WooCommerceOrder['status']): BadgeVariant {
  if (status === 'completed') return 'success';
  if (status === 'processing') return 'warning';
  if (status === 'cancelled' || status === 'failed' || status === 'trash') return 'danger';
  if (status === 'refunded') return 'neutral';
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
  const { data: store, loading, error } = useSseChannel<{ orders: WooCommerceOrder[] }>('woocommerce-orders', { orders: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().orders, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile woocommerce-orders-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().orders.length === 0}>
              <tr><td colspan="5" class="cell-empty">No orders</td></tr>
            </Show>
            <For each={pageItems()}>
              {(order) => (
                <tr>
                  <td>#{order.id}</td>
                  <td>{order.billing.first_name} {order.billing.last_name}</td>
                  <td>{order.currency} {parseFloat(order.total).toFixed(2)}</td>
                  <td><Badge variant={orderStatusBadge(order.status)}>{order.status}</Badge></td>
                  <td>{timeAgo(order.date_created)}</td>
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
