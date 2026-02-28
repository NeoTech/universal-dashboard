import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchProduct, fetchProductPrices, updateProduct, createProduct,
  deleteProduct, createPrice, archivePrice, formatAmount, formatDate,
} from '../../data/stripe';
import type { StripeProduct, StripePrice } from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

export function ProductsTile(_props: Props): JSX.Element {
  const { data: products, loading: listLoading, error: listError } = useSseChannel<StripeProduct[]>('stripe-products', []);

  // Detail drawer state
  const [selected, setSelected] = createSignal<StripeProduct | null>(null);
  const [prices, setPrices] = createSignal<StripePrice[]>([]);
  const [detailLoading, setDetailLoading] = createSignal(false);

  // Edit form state
  const [editMode, setEditMode] = createSignal(false);
  const [editName, setEditName] = createSignal('');
  const [editDesc, setEditDesc] = createSignal('');

  // Add price form state
  const [showPriceForm, setShowPriceForm] = createSignal(false);
  const [priceAmount, setPriceAmount] = createSignal('');
  const [priceCurrency, setPriceCurrency] = createSignal('usd');
  const [priceInterval, setPriceInterval] = createSignal('');

  // New product form state
  const [showNewProduct, setShowNewProduct] = createSignal(false);
  const [newName, setNewName] = createSignal('');
  const [newDesc, setNewDesc] = createSignal('');

  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // Filter state — both unchecked means show all
  const [filterActive, setFilterActive] = createSignal(false);
  const [filterArchived, setFilterArchived] = createSignal(false);

  const filtered = () => {
    const all = products();
    const a = filterActive(), ar = filterArchived();
    if (!a && !ar) return all;          // nothing ticked → show all
    if (a && ar) return all;            // both ticked → show all
    if (a) return all.filter((p) => p.active);
    return all.filter((p) => !p.active);
  };
  const { page, setPage, totalPages, pageItems } = usePagination(() => filtered(), 10);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null); setPrices([]); setEditMode(false); setShowPriceForm(false);
    try {
      const [prod, priceList] = await Promise.all([fetchProduct(id), fetchProductPrices(id)]);
      setSelected(prod);
      setPrices(priceList);
      setEditName(prod.name);
      setEditDesc(prod.description ?? '');
    } finally { setDetailLoading(false); }
  }

  const saveEdit = useStripeAction(
    async () => {
      await updateProduct(selected()!.id, { name: editName(), description: editDesc() });
    },
    { onSuccess: () => { setEditMode(false); void openDetail(selected()!.id); } },
  );

  const archiveAction = useStripeAction(
    async () => { await updateProduct(selected()!.id, { active: !selected()!.active }); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const deleteAction = useStripeAction(
    async () => { await deleteProduct(selected()!.id); },
    { onSuccess: () => { setShowDeleteConfirm(false); setSelected(null); } },
  );

  const addPriceAction = useStripeAction(
    async () => {
      await createPrice({
        product: selected()!.id,
        currency: priceCurrency(),
        unit_amount: Math.round(parseFloat(priceAmount()) * 100),
        ...(priceInterval() ? { recurring: { interval: priceInterval() } } : {}),
      });
    },
    { onSuccess: () => { setShowPriceForm(false); setPriceAmount(''); void openDetail(selected()!.id); } },
  );

  const archivePriceAction = useStripeAction(
    async (priceId: string) => { await archivePrice(priceId); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const createProductAction = useStripeAction(
    async () => { await createProduct({ name: newName(), description: newDesc() }); },
    { onSuccess: () => { setShowNewProduct(false); setNewName(''); setNewDesc(''); } },
  );

  const s = () => selected();

  return (
    <div class="stripe-tile products-tile">
      <BaseTile loading={listLoading()} error={listError()} skeletonLines={4}>
        <>
          <div class="tile-toolbar">
            <span class="tile-toolbar__count">{filtered().length} / {products().length} products</span>
            <div class="tile-toolbar__filters">
              <label class="filter-chip">
                <input type="checkbox" checked={filterActive()} onChange={(e) => setFilterActive(e.currentTarget.checked)} />
                Active
              </label>
              <label class="filter-chip">
                <input type="checkbox" checked={filterArchived()} onChange={(e) => setFilterArchived(e.currentTarget.checked)} />
                Archived
              </label>
            </div>
            <button class="btn btn--sm btn--primary" onClick={() => setShowNewProduct(true)}>+ New</button>
          </div>
          <div class="products-grid">
            <For each={pageItems()}>
              {(p) => (
                <div class="product-card product-card--clickable" onClick={() => void openDetail(p.id)}>
                  <span class="product-card__name">{p.name}</span>
                  {p.price && (
                    <span class="product-card__price">
                      {formatAmount(p.price.amount ?? 0, p.price.currency)}
                      {p.price.interval ? <span class="product-card__interval">/{p.price.interval}</span> : null}
                    </span>
                  )}
                  <Badge variant={p.active ? 'success' : 'neutral'}>{p.active ? 'Active' : 'Archived'}</Badge>
                </div>
              )}
            </For>
          </div>
          <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
        </>
      </BaseTile>
      {/* Detail drawer */}
      <StripeDrawer
        isOpen={selected() !== null || detailLoading()}
        title={s() ? s()!.name : 'Loading…'}
        onClose={() => { setSelected(null); setEditMode(false); setShowPriceForm(false); setShowDeleteConfirm(false); }}
      >
        <Show when={detailLoading()}><Skeleton lines={5} /></Show>
        <Show when={s()}>
          <Show when={!editMode()} fallback={
            <div class="drawer-section">
              <h3 class="drawer-section__title">Edit Product</h3>
              <label class="field"><span class="field__label">Name</span>
                <input class="field__input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
              </label>
              <label class="field"><span class="field__label">Description</span>
                <textarea class="field__input" rows={3} onInput={(e) => setEditDesc(e.currentTarget.value)}>{editDesc()}</textarea>
              </label>
              <Show when={saveEdit.error()}><p class="drawer-error">{saveEdit.error()}</p></Show>
              <div class="action-bar">
                <button class="btn btn--primary" onClick={() => void saveEdit.execute()} disabled={saveEdit.loading()}>Save</button>
                <button class="btn btn--neutral" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
          }>
            <div class="drawer-section">
              <div class="detail-row"><span class="detail-label">ID</span><code class="detail-code">{s()!.id}</code></div>
              <div class="detail-row"><span class="detail-label">Status</span><Badge variant={s()!.active ? 'success' : 'neutral'}>{s()!.active ? 'Active' : 'Archived'}</Badge></div>
              <div class="detail-row"><span class="detail-label">Created</span><span>{formatDate(s()!.created)}</span></div>
              <Show when={s()!.description}><div class="detail-row"><span class="detail-label">Description</span><span>{s()!.description}</span></div></Show>
              <div class="action-bar">
                <button class="btn btn--neutral" onClick={() => setEditMode(true)}>Edit</button>
                <button class="btn btn--neutral" onClick={() => void archiveAction.execute()} disabled={archiveAction.loading()}>
                  {s()!.active ? 'Archive' : 'Restore'}
                </button>
                <button class="btn btn--danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
              </div>
              <Show when={archiveAction.error()}><p class="drawer-error">{archiveAction.error()}</p></Show>
              <Show when={deleteAction.error()}><p class="drawer-error">{deleteAction.error()}</p></Show>
            </div>
          </Show>

          {/* Prices section */}
          <div class="drawer-section">
            <div class="drawer-section__header">
              <h3 class="drawer-section__title">Prices</h3>
              <button class="btn btn--sm btn--primary" onClick={() => setShowPriceForm(v => !v)}>
                {showPriceForm() ? 'Cancel' : '+ Add Price'}
              </button>
            </div>
            <Show when={showPriceForm()}>
              <div class="price-form">
                <label class="field"><span class="field__label">Amount</span>
                  <input class="field__input" type="number" min="0.01" step="0.01" value={priceAmount()} onInput={(e) => setPriceAmount(e.currentTarget.value)} placeholder="9.99" />
                </label>
                <label class="field"><span class="field__label">Currency</span>
                  <input class="field__input" value={priceCurrency()} onInput={(e) => setPriceCurrency(e.currentTarget.value)} placeholder="usd" />
                </label>
                <label class="field"><span class="field__label">Recurring interval (blank = one-time)</span>
                  <select class="field__input" value={priceInterval()} onChange={(e) => setPriceInterval(e.currentTarget.value)}>
                    <option value="">One-time</option>
                    <option value="day">Daily</option>
                    <option value="week">Weekly</option>
                    <option value="month">Monthly</option>
                    <option value="year">Yearly</option>
                  </select>
                </label>
                <Show when={addPriceAction.error()}><p class="drawer-error">{addPriceAction.error()}</p></Show>
                <button class="btn btn--primary" onClick={() => void addPriceAction.execute()} disabled={addPriceAction.loading()}>Create Price</button>
              </div>
            </Show>
            <Show when={prices().length === 0} fallback={
              <table class="tile-table tile-table--sm">
                <thead><tr><th>Amount</th><th>Type</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  <For each={prices()}>
                    {(pr) => (
                      <tr>
                        <td>{formatAmount(pr.unitAmount ?? 0, pr.currency)}</td>
                        <td>{pr.recurring ? `${pr.recurring.interval}ly` : 'One-time'}</td>
                        <td><Badge variant={pr.active ? 'success' : 'neutral'}>{pr.active ? 'Active' : 'Archived'}</Badge></td>
                        <td>
                          <Show when={pr.active}>
                            <button class="btn btn--xs btn--neutral"
                              onClick={() => void archivePriceAction.execute(pr.id)}
                              disabled={archivePriceAction.loading()}>Archive</button>
                          </Show>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            }>
              <p class="drawer-empty">No prices yet.</p>
            </Show>
          </div>
        </Show>
      </StripeDrawer>

      {/* New Product modal */}
      <Show when={showNewProduct()}>
        <div class="modal-overlay" onClick={() => setShowNewProduct(false)}>
          <div class="modal" onClick={(e) => e.stopPropagation()}>
            <h2 class="modal__title">New Product</h2>
            <label class="field"><span class="field__label">Name</span>
              <input class="field__input" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} autofocus />
            </label>
            <label class="field"><span class="field__label">Description</span>
              <textarea class="field__input" rows={3} onInput={(e) => setNewDesc(e.currentTarget.value)}>{newDesc()}</textarea>
            </label>
            <Show when={createProductAction.error()}><p class="drawer-error">{createProductAction.error()}</p></Show>
            <div class="action-bar">
              <button class="btn btn--primary" onClick={() => void createProductAction.execute()} disabled={createProductAction.loading()}>Create</button>
              <button class="btn btn--neutral" onClick={() => setShowNewProduct(false)}>Cancel</button>
            </div>
          </div>
        </div>
      </Show>

      <ConfirmDialog
        isOpen={showDeleteConfirm()}
        message={`Delete "${s()?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => void deleteAction.execute()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
