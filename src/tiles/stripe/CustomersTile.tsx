import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchCustomer, updateCustomer, deleteCustomer, formatDate, 
} from '../../data/stripe';
import type { StripeCustomerListItem, StripeCustomerDetail } from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { useTileConfig } from '../TileConfigContext';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

export function CustomersTile(_props: Props): JSX.Element {
  const config = useTileConfig();
  const compact = () => config?.displayMode === 'compact';
  const { data: customers, loading, error } = useSseChannel<StripeCustomerListItem[]>('stripe-customers', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => customers(), 10);
  const [selected, setSelected] = createSignal<StripeCustomerDetail | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [editMode, setEditMode] = createSignal(false);
  const [editName, setEditName] = createSignal('');
  const [editEmail, setEditEmail] = createSignal('');
  const [editPhone, setEditPhone] = createSignal('');
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null); setEditMode(false);
    try {
      const cust = await fetchCustomer(id);
      setSelected(cust);
      setEditName(cust.name ?? '');
      setEditEmail(cust.email ?? '');
      setEditPhone(cust.phone ?? '');
    } finally { setDetailLoading(false); }
  }

  const saveEdit = useStripeAction(
    async () => { await updateCustomer(selected()!.id, { name: editName(), email: editEmail(), phone: editPhone() }); },
    { onSuccess: () => { setEditMode(false); void openDetail(selected()!.id); } },
  );

  const deleteAction = useStripeAction(
    async () => { await deleteCustomer(selected()!.id); },
    { onSuccess: () => { setShowDeleteConfirm(false); setSelected(null); } },
  );

  const d = () => selected();

  return (
    <div class="stripe-tile customers-tile">
      <BaseTile loading={loading()} error={error()}>
        <>
          <table class="tile-table" classList={{ 'tile-table--clickable': !compact() }}>
            <thead><tr><th>Name</th><th>Email</th><Show when={!compact()}><th>Joined</th></Show><th>Status</th></tr></thead>
            <tbody>
              <Show when={customers().length === 0}>
                <tr><td colspan={compact() ? '3' : '4'} class="cell-empty">No customers yet</td></tr>
              </Show>
              <For each={pageItems()}>
                {(c) => (
                  <tr onClick={compact() ? undefined : () => void openDetail(c.id)}>
                    <td class="cell-truncate">{c.name ?? '—'}</td>
                    <td class="cell-truncate">{c.email ?? '—'}</td>
                    <Show when={!compact()}><td>{formatDate(c.created)}</td></Show>
                    <td>
                      <Show when={c.delinquent}>
                        <Badge variant="danger">Delinquent</Badge>
                      </Show>
                      <Show when={!c.delinquent}>
                        <Badge variant="success">OK</Badge>
                      </Show>
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          <Show when={!compact()}>
            <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
          </Show>
        </>
      </BaseTile>
      <Show when={!compact()}>
      <StripeDrawer
        isOpen={selected() !== null || detailLoading()}
        title={d() ? (d()!.name ?? d()!.email ?? d()!.id) : 'Loading…'}
        onClose={() => { setSelected(null); setEditMode(false); setShowDeleteConfirm(false); }}
      >
        <Show when={detailLoading()}><Skeleton lines={5} /></Show>
        <Show when={d()}>
          <Show when={!editMode()} fallback={
            <div class="drawer-section">
              <h3 class="drawer-section__title">Edit Customer</h3>
              <label class="field"><span class="field__label">Name</span>
                <input class="field__input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} />
              </label>
              <label class="field"><span class="field__label">Email</span>
                <input class="field__input" type="email" value={editEmail()} onInput={(e) => setEditEmail(e.currentTarget.value)} />
              </label>
              <label class="field"><span class="field__label">Phone</span>
                <input class="field__input" type="tel" value={editPhone()} onInput={(e) => setEditPhone(e.currentTarget.value)} />
              </label>
              <Show when={saveEdit.error()}><p class="drawer-error">{saveEdit.error()}</p></Show>
              <div class="action-bar">
                <button class="btn btn--primary" onClick={() => void saveEdit.execute()} disabled={saveEdit.loading()}>Save</button>
                <button class="btn btn--neutral" onClick={() => setEditMode(false)}>Cancel</button>
              </div>
            </div>
          }>
            <div class="drawer-section">
              <div class="detail-row"><span class="detail-label">ID</span><code class="detail-code">{d()!.id}</code></div>
              <Show when={d()!.email}><div class="detail-row"><span class="detail-label">Email</span><span>{d()!.email}</span></div></Show>
              <Show when={d()!.phone}><div class="detail-row"><span class="detail-label">Phone</span><span>{d()!.phone}</span></div></Show>
              <div class="detail-row"><span class="detail-label">Created</span><span>{formatDate(d()!.created)}</span></div>
              <Show when={d()!.balance !== 0}>
                <div class="detail-row">
                  <span class="detail-label">Balance</span>
                  <span class={d()!.balance < 0 ? 'text-success' : 'text-danger'}>{d()!.balance / 100}</span>
                </div>
              </Show>
              <Show when={d()!.delinquent}>
                <div class="detail-row"><span class="detail-label">Status</span><Badge variant="danger">Delinquent</Badge></div>
              </Show>
              <Show when={d()!.description}><div class="detail-row"><span class="detail-label">Description</span><span>{d()!.description}</span></div></Show>
              <Show when={d()!.address?.city}>
                <div class="detail-row">
                  <span class="detail-label">Address</span>
                  <span>{[d()!.address?.line1, d()!.address?.city, d()!.address?.country].filter(Boolean).join(', ')}</span>
                </div>
              </Show>
              <div class="action-bar">
                <button class="btn btn--neutral" onClick={() => setEditMode(true)}>Edit</button>
                <button class="btn btn--danger" onClick={() => setShowDeleteConfirm(true)}>Delete</button>
              </div>
              <Show when={deleteAction.error()}><p class="drawer-error">{deleteAction.error()}</p></Show>
            </div>
          </Show>
        </Show>
      </StripeDrawer>
      </Show>

      <ConfirmDialog
        isOpen={showDeleteConfirm()}
        message={`Delete customer "${d()?.name ?? d()?.email ?? d()?.id}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        onConfirm={() => void deleteAction.execute()}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
