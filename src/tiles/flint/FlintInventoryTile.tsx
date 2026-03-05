import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintInventoryRow } from '../../data/flint';
import { useFlintResource } from './flintRealtimeStore';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { formatCurrency, stockClass } from './utils';
import { flintStore } from './flintStore';

export function FlintInventoryTile(_props: Record<string, never>): JSX.Element {
  const { data: inventory, loading, error } = useFlintResource<FlintInventoryRow[]>('flint-inventory', []);

  const [lowStockOnly, setLowStockOnly] = createSignal(false);
  const [search, setSearch]             = createSignal('');

  // ── Cross-tile store listener ──────────────────────────────────────────────

  createEffect(on(() => flintStore.inventoryFilter(), (filter) => {
    if (!filter) return;
    if (filter.lowStockOnly) setLowStockOnly(true);
    flintStore.clearInventoryFilter();
  }, { defer: true }));

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return inventory().filter(row => {
      if (lowStockOnly() && !row.isLowStock) return false;
      if (q && !row.productName.toLowerCase().includes(q) &&
               !(row.variantName ?? '').toLowerCase().includes(q) &&
               !(row.sku ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 25);

  function openProduct(productId: string): void {
    flintStore.openProduct(productId);
  }

  return (
    <div class="stripe-tile flint-inventory-tile">
      <div class="tile-toolbar">
        <label class="filter-chip">
          <input
            type="checkbox"
            checked={lowStockOnly()}
            onChange={(e) => setLowStockOnly(e.currentTarget.checked)}
          />
          Low stock only
        </label>
        <input
          class="tile-search"
          type="search"
          placeholder="Search inventory…"
          value={search()}
          onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
        />
      </div>

      <BaseTile loading={loading()} error={error()}>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Variant</th>
              <th>SKU</th>
              <th>Stock</th>
              <th class="cell-right">Price</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <Show when={filtered().length === 0}>
              <tr><td colspan="6" class="cell-empty">No rows match the filter</td></tr>
            </Show>
            <For each={pageItems()}>
              {(row) => (
                <tr>
                  <td class="cell-truncate">{row.productName}</td>
                  <td class="cell-muted">{row.variantName ?? '—'}</td>
                  <td class="cell-muted">{row.sku ?? '—'}</td>
                  <td class={`flint-stock--${stockClass(row.stock)}`}>
                    {row.stock}
                    <Show when={row.isLowStock}>
                      <span title="Low stock"> !</span>
                    </Show>
                  </td>
                  <td class="cell-right">{formatCurrency(row.price, row.currency)}</td>
                  <td>
                    <button
                      class="btn btn--xs btn--neutral"
                      title="View product"
                      onClick={() => openProduct(row.productId)}
                    >
                      ↗
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </BaseTile>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
    </div>
  );
}
