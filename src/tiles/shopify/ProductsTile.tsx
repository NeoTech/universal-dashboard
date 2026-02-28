import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { ShopifyProduct } from '../../data/shopify';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function statusBadge(status: ShopifyProduct['status']): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

export function ProductsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ products: ShopifyProduct[] }>('shopify-products', { products: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().products, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile shopify-products-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Vendor</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().products.length === 0}>
              <tr><td colspan="5" class="cell-empty">No products</td></tr>
            </Show>
            <For each={pageItems()}>
              {(product) => (
                <tr>
                  <td>{product.title}</td>
                  <td>{product.vendor}</td>
                  <td>{product.variants[0]?.price ?? '—'}</td>
                  <td>{product.variants.reduce((sum, v) => sum + (v.inventory_quantity ?? 0), 0)}</td>
                  <td><Badge variant={statusBadge(product.status)}>{product.status}</Badge></td>
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
