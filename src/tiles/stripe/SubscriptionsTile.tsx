import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchSubscription, cancelSubscription, resumeSubscription,
  updateSubscription, formatAmount, formatDate,
} from '../../data/stripe';
import type { StripeSubscription, StripeSubscriptionDetail } from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

type SubStatus = StripeSubscription['status'];

function subVariant(status: SubStatus) {
  if (status === 'active') return 'success' as const;
  if (status === 'trialing') return 'warning' as const;
  if (status === 'past_due' || status === 'unpaid') return 'danger' as const;
  return 'neutral' as const;
}

export function SubscriptionsTile(_props: Props): JSX.Element {
  const { data: subs, loading, error } = useSseChannel<StripeSubscription[]>('stripe-subscriptions', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => subs(), 10);
  const [selected, setSelected] = createSignal<StripeSubscriptionDetail | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [showCancelNowConfirm, setShowCancelNowConfirm] = createSignal(false);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null);
    try { setSelected(await fetchSubscription(id)); }
    finally { setDetailLoading(false); }
  }

  const cancelAtPeriodEnd = useStripeAction(
    async () => { await cancelSubscription(selected()!.id, false); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const cancelNow = useStripeAction(
    async () => { await cancelSubscription(selected()!.id, true); },
    { onSuccess: () => { setShowCancelNowConfirm(false); setSelected(null); } },
  );

  const resumeAction = useStripeAction(
    async () => { await resumeSubscription(selected()!.id); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const removeCancelAction = useStripeAction(
    async () => { await updateSubscription(selected()!.id, { cancel_at_period_end: false }); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const counts = () => {
    const all = subs();
    return {
      active: all.filter((s) => s.status === 'active').length,
      trialing: all.filter((s) => s.status === 'trialing').length,
      canceled: all.filter((s) => s.status === 'canceled').length,
      pastDue: all.filter((s) => s.status === 'past_due').length,
    };
  };

  const d = () => selected();

  return (
    <div class="stripe-tile subscriptions-tile">
      <BaseTile loading={loading()} error={error()} skeletonLines={4}>
        <>
          <div class="sub-counts">
            <span><Badge variant="success">Active</Badge> {counts().active}</span>
            <span><Badge variant="warning">Trial</Badge> {counts().trialing}</span>
            <span><Badge variant="danger">Past due</Badge> {counts().pastDue}</span>
            <span><Badge variant="neutral">Canceled</Badge> {counts().canceled}</span>
          </div>
          <table class="tile-table tile-table--clickable">
            <thead><tr><th>ID</th><th>Status</th><th>Renews</th></tr></thead>
            <tbody>
              <For each={pageItems()}>
                {(s) => (
                  <tr onClick={() => void openDetail(s.id)}>
                    <td class="mono cell-truncate">{s.id}</td>
                    <td><Badge variant={subVariant(s.status)}>{s.status}</Badge></td>
                    <td>{formatDate(s.currentPeriodEnd)}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
        </>
      </BaseTile>
      <StripeDrawer
        isOpen={selected() !== null || detailLoading()}
        title={d() ? `Subscription ${d()!.id.slice(0, 20)}…` : 'Loading…'}
        onClose={() => { setSelected(null); setShowCancelNowConfirm(false); }}
      >
        <Show when={detailLoading()}><Skeleton lines={6} /></Show>
        <Show when={d()}>
          <div class="drawer-section">
            <div class="detail-row"><span class="detail-label">Status</span><Badge variant={subVariant(d()!.status as SubStatus)}>{d()!.status}</Badge></div>
            <div class="detail-row"><span class="detail-label">Period start</span><span>{formatDate(d()!.currentPeriodStart)}</span></div>
            <div class="detail-row"><span class="detail-label">Period end</span><span>{formatDate(d()!.currentPeriodEnd)}</span></div>
            <Show when={d()!.cancelAt}>
              <div class="detail-row"><span class="detail-label">Cancels at</span><span class="text-danger">{formatDate(d()!.cancelAt!)}</span></div>
            </Show>
            <Show when={d()!.trialEnd}>
              <div class="detail-row"><span class="detail-label">Trial ends</span><span>{formatDate(d()!.trialEnd!)}</span></div>
            </Show>
            <Show when={d()!.items?.length}>
              <div class="detail-row"><span class="detail-label">Plan</span>
                <span>{d()!.items![0].priceNickname ?? d()!.items![0].priceId ?? '—'}</span>
              </div>
              <div class="detail-row"><span class="detail-label">Price</span>
                <span>{formatAmount(d()!.items![0].unitAmount ?? 0, d()!.items![0].currency)}</span>
              </div>
            </Show>
          </div>

          <div class="drawer-section drawer-section--actions">
            {/* Resume if paused */}
            <Show when={d()!.status === 'paused'}>
              <Show when={resumeAction.error()}><p class="drawer-error">{resumeAction.error()}</p></Show>
              <button class="btn btn--primary" onClick={() => void resumeAction.execute()} disabled={resumeAction.loading()}>Resume</button>
            </Show>

            {/* Active subscription options */}
            <Show when={d()!.status === 'active' || d()!.status === 'trialing'}>
              <Show when={!d()!.cancelAt} fallback={
                <>
                  <p class="drawer-note">Scheduled to cancel at period end.</p>
                  <Show when={removeCancelAction.error()}><p class="drawer-error">{removeCancelAction.error()}</p></Show>
                  <button class="btn btn--neutral" onClick={() => void removeCancelAction.execute()} disabled={removeCancelAction.loading()}>Keep Subscription</button>
                </>
              }>
                <Show when={cancelAtPeriodEnd.error()}><p class="drawer-error">{cancelAtPeriodEnd.error()}</p></Show>
                <button class="btn btn--neutral" onClick={() => void cancelAtPeriodEnd.execute()} disabled={cancelAtPeriodEnd.loading()}>
                  Cancel at Period End
                </button>
              </Show>
              <Show when={cancelNow.error()}><p class="drawer-error">{cancelNow.error()}</p></Show>
              <button class="btn btn--danger" onClick={() => setShowCancelNowConfirm(true)} disabled={cancelNow.loading()}>Cancel Immediately</button>
            </Show>
          </div>
        </Show>
      </StripeDrawer>

      <ConfirmDialog
        isOpen={showCancelNowConfirm()}
        message="Cancel this subscription immediately? The customer will lose access right away."
        confirmLabel="Cancel Now"
        danger
        onConfirm={() => void cancelNow.execute()}
        onCancel={() => setShowCancelNowConfirm(false)}
      />
    </div>
  );
}
