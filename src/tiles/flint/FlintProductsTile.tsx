import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintProduct, FlintCategory } from '../../data/flint';
import { Badge } from '../../ui/Badge';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useFlintResource, sendCommand } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { formatCurrency, stockClass } from './utils';
import { flintStore } from './flintStore';
import { useFlintDensity } from './useFlintDensity';

/** Inline stock update action (no drawer side-effects). */
function useInlineStockEdit(onSuccess?: () => void) {
  const [saving, setSaving] = createSignal(false);
  async function save(id: string, stock: number): Promise<void> {
    setSaving(true);
    try {
      const result = await sendCommand('update-product', id, { stock });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
      onSuccess?.();
    } finally {
      setSaving(false);
    }
  }
  return { save, saving };
}

// ── Status badge helper ───────────────────────────────────────────────────────

function statusVariant(s: string) {
  if (s === 'active')   return 'success' as const;
  if (s === 'draft')    return 'warning' as const;
  return 'neutral' as const;
}

export function FlintProductsTile(_props: Record<string, never>): JSX.Element {
  const { density, ref } = useFlintDensity();
  const { data: products, loading, error } = useFlintResource<FlintProduct[]>('flint-products', []);
  const { data: categories } = useFlintResource<FlintCategory[]>('flint-categories', []);

  const [search, setSearch]     = createSignal('');
  const [filterStatus, setFilterStatus] = createSignal<string>('all');
  const [selected, setSelected] = createSignal<FlintProduct | null>(null);
  const [editMode, setEditMode] = createSignal(false);
  const [editName, setEditName] = createSignal('');
  const [editDesc, setEditDesc] = createSignal('');
  const [editPrice, setEditPrice] = createSignal('');
  const [editStock, setEditStock] = createSignal('');
  const [confirmDelete, setConfirmDelete] = createSignal(false);
  const [showNewProduct, setShowNewProduct] = createSignal(false);

  // Create form
  const inlineStock = useInlineStockEdit();
  const [editingStockId, setEditingStockId] = createSignal<string | null>(null);
  const [editingStockVal, setEditingStockVal] = createSignal('');

  const [newName, setNewName] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');
  const [newPrice, setNewPrice] = createSignal('');
  const [newStock, setNewStock] = createSignal('');
  const [newCat, setNewCat] = createSignal('');

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    return products().filter(p => {
      if (filterStatus() !== 'all' && p.status !== filterStatus()) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 20);

  // ── Actions ──────────────────────────────────────────────────────────────

  const saveEdit = useStripeAction(
    async (id: string, name: string, description: string, price: number, stock: number) => {
      const result = await sendCommand('update-product', id, { name, description, price, stock });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => setEditMode(false) },
  );

  const archiveAction = useStripeAction(
    async (id: string, status: string) => {
      const result = await sendCommand('update-product', id, { status: status === 'active' ? 'archived' : 'active' });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => setSelected(null) },
  );

  const deleteAction = useStripeAction(
    async (id: string) => {
      const result = await sendCommand('delete-product', id);
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setSelected(null); setConfirmDelete(false); } },
  );

  const createAction = useStripeAction(
    async (name: string, description: string, price: number, stock: number, categoryId: string) => {
      const result = await sendCommand('create-product', undefined, { name, description, price, stock, categoryId: categoryId || undefined, status: 'draft' });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setShowNewProduct(false); setNewName(''); setNewDesc(''); setNewPrice(''); setNewStock(''); setNewCat(''); } },
  );

  // ── Cross-tile store listener ──────────────────────────────────────────────

  // Inline archive/restore (no drawer)
  const inlineArchive = useStripeAction(
    async (id: string, currentStatus: string) => {
      const result = await sendCommand('update-product', id, { status: currentStatus === 'active' ? 'archived' : 'active' });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
  );

  // ── Inline stock edit helpers ──────────────────────────────────────────────

  function startStockEdit(id: string, currentStock: number, e: MouseEvent): void {
    e.stopPropagation();
    setEditingStockId(id);
    setEditingStockVal(String(currentStock));
  }

  function commitStockEdit(): void {
    const id = editingStockId();
    if (!id) return;
    const val = parseInt(editingStockVal());
    if (!isNaN(val) && val >= 0) void inlineStock.save(id, val);
    setEditingStockId(null);
  }

  function handleStockKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter') commitStockEdit();
    if (e.key === 'Escape') setEditingStockId(null);
  }

  createEffect(on(() => flintStore.selectedProductId(), (productId) => {
    if (!productId) return;
    const product = products().find(p => p.id === productId);
    if (product) setSelected(product);
    flintStore.clearSelectedProduct();
  }, { defer: true }));

  function openEditMode(p: FlintProduct): void {
    setEditName(p.name);
    setEditDesc(p.description ?? '');
    // LOPC returns decimal dollars — no /100 conversion needed
    setEditPrice(p.price.toFixed(2));
    setEditStock(String(p.stock));
    setEditMode(true);
  }

  return (
    <div class="stripe-tile flint-products-tile" ref={ref} data-density={density()}>
      {/* Toolbar */}
      <div class="tile-toolbar">
        <div class="flint-filter-chips">
          {(['active', 'draft', 'archived', 'all'] as const).map(s => (
            <button
              class={`flint-filter-chip${filterStatus() === s ? ' flint-filter-chip--active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <input
            class="tile-search"
            type="search"
            placeholder="Search products…"
            value={search()}
            onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
          />
          <button class="btn btn--sm btn--primary" onClick={() => setShowNewProduct(true)}>+ New</button>
        </div>
      </div>

      <BaseTile loading={loading()} error={error()}>
        <table class="tile-table tile-table--clickable">
          <thead><tr><th>Status</th><th>Name</th><th>Stock</th><th class="col-price cell-right">Price</th><th style={{ width: '60px' }}></th></tr></thead>
          <tbody>
            <Show when={filtered().length === 0}>
              <tr><td colspan="5" class="cell-empty">No products match the filter</td></tr>
            </Show>
            <For each={pageItems()}>
              {(p) => (
                <tr onClick={() => setSelected(p)}>
                  <td><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                  <td class="cell-truncate">{p.name}</td>
                  <td onClick={(e) => startStockEdit(p.id, p.stock, e)} class={`flint-stock--${stockClass(p.stock)}`}>
                    <Show when={editingStockId() === p.id} fallback={<span class="flint-editable-cell">{p.stock}</span>}>
                      <input
                        type="number"
                        class="flint-inline-input"
                        min="0"
                        value={editingStockVal()}
                        onInput={(e) => setEditingStockVal(e.currentTarget.value)}
                        onBlur={() => commitStockEdit()}
                        onKeyDown={(e) => handleStockKeyDown(e)}
                        autofocus
                      />
                    </Show>
                  </td>
                  <td class="col-price cell-right">{formatCurrency(p.price, 'USD')}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button
                      class="flint-inline-action"
                      disabled={inlineArchive.loading()}
                      onClick={() => void inlineArchive.execute(p.id, p.status)}
                      title={p.status === 'active' ? 'Archive' : 'Restore'}
                    >
                      {p.status === 'active' ? 'Arch' : 'Rest'}
                    </button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </BaseTile>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />

      {/* Detail drawer */}
      <StripeDrawer
        isOpen={selected() !== null}
        title={selected()?.name ?? 'Product'}
        onClose={() => { setSelected(null); setEditMode(false); }}
      >
        <Show when={selected()}>
          {(p) => (
            <>
              <Show
                when={editMode()}
                fallback={
                  <dl class="drawer-dl">
                    <dt>Status</dt> <dd><Badge variant={statusVariant(p().status)}>{p().status}</Badge></dd>
                    <dt>Price</dt>  <dd>{formatCurrency(p().price)}</dd>
                    <dt>Stock</dt>  <dd class={`flint-stock--${stockClass(p().stock)}`}>{p().stock}</dd>
                    <Show when={p().description}>
                      <dt>Description</dt><dd>{p().description}</dd>
                    </Show>
                    <Show when={p().categoryName}>
                      <dt>Category</dt><dd>{p().categoryName}</dd>
                    </Show>
                  </dl>
                }
              >
                <div class="flint-inline-form">
                  <label class="flint-auth-form__label">Name<input class="flint-auth-form__input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} /></label>
                  <label class="flint-auth-form__label">Description<input class="flint-auth-form__input" value={editDesc()} onInput={(e) => setEditDesc(e.currentTarget.value)} /></label>
                  <label class="flint-auth-form__label">Price (USD)<input class="flint-auth-form__input" type="number" step="0.01" value={editPrice()} onInput={(e) => setEditPrice(e.currentTarget.value)} /></label>
                  <label class="flint-auth-form__label">Stock<input class="flint-auth-form__input" type="number" value={editStock()} onInput={(e) => setEditStock(e.currentTarget.value)} /></label>
                  <div class="drawer-actions">
                    <button class="btn btn--primary" disabled={saveEdit.loading()} onClick={() => void saveEdit.execute(p().id, editName(), editDesc(), parseFloat(editPrice()), parseInt(editStock()))}>
                      {saveEdit.loading() ? 'Saving…' : 'Save'}
                    </button>
                    <button class="btn btn--neutral" onClick={() => setEditMode(false)}>Cancel</button>
                  </div>
                </div>
              </Show>

              <Show when={!editMode()}>
                <div class="drawer-actions">
                  <button class="btn btn--neutral" onClick={() => openEditMode(p())}>Edit</button>
                  <button class="btn btn--neutral" disabled={archiveAction.loading()} onClick={() => void archiveAction.execute(p().id, p().status)}>
                    {p().status === 'active' ? 'Archive' : 'Restore'}
                  </button>
                  <button class="btn btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
                </div>
              </Show>

              {/* Variants */}
              <Show when={(p().variants?.length ?? 0) > 0}>
                <h3 class="drawer-section__title" style="margin-top:12px">Variants</h3>
                <table class="tile-table tile-table--sm">
                  <thead><tr><th>Variant</th><th>Stock</th><th class="cell-right">Price</th></tr></thead>
                  <tbody>
                    <For each={p().variants ?? []}>
                      {(v) => (
                        <tr>
                          <td>{v.name}</td>
                          <td class={`flint-stock--${stockClass(v.stock)}`}>{v.stock}</td>
                          <td class="cell-right">{formatCurrency(v.price)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>
            </>
          )}
        </Show>
      </StripeDrawer>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={confirmDelete()}
        message={`Delete "${selected()?.name}"? This cannot be undone.`}
        confirmLabel="Delete Product"
        danger
        onConfirm={() => selected() && void deleteAction.execute(selected()!.id)}
        onCancel={() => setConfirmDelete(false)}
      />

      {/* New product form overlay */}
      <Show when={showNewProduct()}>
        <div class="flint-create-overlay">
          <h3 class="flint-auth-form__title">New Product</h3>
          <div class="flint-inline-form">
            <Show when={createAction.error()}>
              <p class="drawer-error">{createAction.error()}</p>
            </Show>
            <label class="flint-auth-form__label">Name<input class="flint-auth-form__input" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} /></label>
            <label class="flint-auth-form__label">Description<input class="flint-auth-form__input" value={newDesc()} onInput={(e) => setNewDesc(e.currentTarget.value)} /></label>
            <label class="flint-auth-form__label">Price (USD)<input class="flint-auth-form__input" type="number" step="0.01" value={newPrice()} onInput={(e) => setNewPrice(e.currentTarget.value)} /></label>
            <label class="flint-auth-form__label">Stock<input class="flint-auth-form__input" type="number" value={newStock()} onInput={(e) => setNewStock(e.currentTarget.value)} /></label>
            <label class="flint-auth-form__label">
              Category
              <select class="flint-auth-form__input" value={newCat()} onChange={(e) => setNewCat(e.currentTarget.value)}>
                <option value="">No category</option>
                <For each={categories()}>
                  {(c) => <option value={c.id}>{c.name}</option>}
                </For>
              </select>
            </label>
            <div class="drawer-actions">
              <button class="btn btn--primary" disabled={createAction.loading() || !newName()} onClick={() => void createAction.execute(newName(), newDesc(), parseFloat(newPrice() || '0'), parseInt(newStock() || '0'), newCat())}>
                {createAction.loading() ? 'Creating…' : 'Create Product'}
              </button>
              <button class="btn btn--neutral" onClick={() => setShowNewProduct(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}
