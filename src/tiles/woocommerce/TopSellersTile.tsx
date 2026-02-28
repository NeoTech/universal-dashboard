import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

interface Seller { title: string; product_id: number; quantity: number; }

export function TopSellersTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ sellers: Seller[] }>('woocommerce-top-sellers', { sellers: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().sellers, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile woocommerce-top-sellers-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Product</th>
              <th>Units Sold</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().sellers.length === 0}>
              <tr><td colspan="3" class="cell-empty">No data</td></tr>
            </Show>
            <For each={pageItems()}>
              {(seller, index) => (
                <tr>
                  <td>{index() + 1}</td>
                  <td>{seller.title}</td>
                  <td><Badge variant="neutral">{String(seller.quantity)}</Badge></td>
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
