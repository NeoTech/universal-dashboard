import { createSignal, onMount, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchPayment, refundPayment, capturePayment, cancelPayment,
  fetchOrderStatuses, updateOrderStatus,
  formatAmount, formatDate,
} from '../../data/stripe';
import type {
  StripePayment, StripePaymentDetail,
  OrderWorkflowStatus, OrderStatusEntry,
} from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

// ── Stripe payment status helpers ───────────────────────────────────
function paymentLabel(status: StripePayment['status']): string {
  if (status === 'succeeded') return 'Paid';
  if (status === 'pending') return 'Pending';
  return 'Failed';
}
function paymentVariant(status: StripePayment['status']) {
  if (status === 'succeeded') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  return 'danger' as const;
}

// ── Workflow stage helpers ───────────────────────────────────────
export const STAGES: OrderWorkflowStatus[] = ['new', 'processing', 'packing', 'shipped', 'done'];

const STAGE_LABEL: Record<OrderWorkflowStatus, string> = {
  new: 'New',
  processing: 'Processing',
  packing: 'Packing',
  shipped: 'Shipped',
  done: 'Done',
};

function stageVariant(s: OrderWorkflowStatus) {
  if (s === 'done') return 'success' as const;
  if (s === 'shipped') return 'neutral' as const;
  if (s === 'new') return 'danger' as const;
  return 'warning' as const;
}

export function OrdersTile(_props: Props): JSX.Element {
  const { data: orders, loading, error } = useSseChannel<StripePayment[]>('stripe-payments', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => orders(), 10);
  const [statuses, setStatuses] = createSignal<Record<string, OrderStatusEntry>>({});

  // Load local order statuses once on mount (SQLite backed, not pushed via SSE)
  onMount(() => {
    void fetchOrderStatuses().then(setStatuses).catch(() => {});
  });

  // Detail drawer
  const [detail, setDetail] = createSignal<StripePaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [refundAmount, setRefundAmount] = createSignal('');
  const [refundReason, setRefundReason] = createSignal('requested_by_customer');
  const [showRefundConfirm, setShowRefundConfirm] = createSignal(false);
  const [showCancelConfirm, setShowCancelConfirm] = createSignal(false);
  const [stageUpdating, setStageUpdating] = createSignal(false);
  const [stageError, setStageError] = createSignal<string | null>(null);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setDetail(null);
    setShowRefundConfirm(false);
    setShowCancelConfirm(false);
    setStageError(null);
    try {
      const d = await fetchPayment(id);
      setDetail(d);
      setRefundAmount(String((d.amount - d.amountRefunded) / 100));
    } finally {
      setDetailLoading(false);
    }
  }

  async function setStage(orderId: string, s: OrderWorkflowStatus) {
    setStageUpdating(true);
    setStageError(null);
    try {
      const entry = await updateOrderStatus(orderId, s);
      setStatuses((prev) => ({ ...prev, [orderId]: entry }));
    } catch (e) {
      setStageError(e instanceof Error ? e.message : 'Failed to update stage');
    } finally {
      setStageUpdating(false);
    }
  }

  const refundAction = useStripeAction(
    async () => {
      const d = detail();
      if (!d) return;
      await refundPayment(d.id, {
        amount: Math.round(parseFloat(refundAmount()) * 100),
        reason: refundReason(),
      });
    },
    { onSuccess: () => { setShowRefundConfirm(false); void openDetail(detail()!.id); } },
  );

  const captureAction = useStripeAction(
    async () => { await capturePayment(detail()!.id); },
    { onSuccess: () => { void openDetail(detail()!.id); } },
  );

  const cancelAction = useStripeAction(
    async () => { await cancelPayment(detail()!.paymentIntent ?? detail()!.id); },
    { onSuccess: () => { setShowCancelConfirm(false); void openDetail(detail()!.id); } },
  );

  const d = () => detail();
  const maxRefund = () => d() ? (d()!.amount - d()!.amountRefunded) / 100 : 0;
  const canRefund = () => d() && d()!.status === 'succeeded' && !d()!.refunded && d()!.amountRefunded < d()!.amount;
  const canCapture = () => d() && !d()!.captured && d()!.status !== 'failed';
  const canCancel = () => d() && d()!.paymentIntent && d()!.status === 'pending';

  // Stage for current open order
  const detailStage = (): OrderWorkflowStatus => (d() ? (statuses()[d()!.id]?.status ?? 'new') : 'new');

  // Stage counts across all loaded orders
  const stageCounts = (): Record<OrderWorkflowStatus, number> => {
    const counts: Record<OrderWorkflowStatus, number> = { new: 0, processing: 0, packing: 0, shipped: 0, done: 0 };
    for (const o of orders()) {
      const s = statuses()[o.id]?.status ?? 'new';
      counts[s]++;
    }
    return counts;
  };

  return (
    <div class="stripe-tile orders-tile">
      <BaseTile loading={loading()} error={error()} skeletonLines={4}>
        <>
          {/* Stage summary row */}
          <div class="orders-stages">
            <For each={STAGES}>
              {(s) => (
                <div class="orders-stage">
                  <span class="orders-stage__label">{STAGE_LABEL[s]}</span>
                  <Badge variant={stageVariant(s)}>{stageCounts()[s]}</Badge>
                </div>
              )}
            </For>
          </div>
          {/* Order table */}
          <table class="tile-table tile-table--clickable tile-table--sm">
            <thead>
              <tr><th>Amount</th><th>Stage</th><th>Customer</th><th>Date</th></tr>
            </thead>
            <tbody>
              <For each={pageItems()}>
                {(o) => {
                  const stage = () => statuses()[o.id]?.status ?? 'new';
                  const isClosed = () => stage() === 'done' || o.status === 'failed';
                  return (
                    <tr
                      class={isClosed() ? 'tr--done' : ''}
                      onClick={() => void openDetail(o.id)}
                      title={isClosed() ? (o.status === 'failed' ? 'View order (failed)' : 'View order (completed)') : undefined}
                    >
                      <td>{formatAmount(o.amount, o.currency)}</td>
                      <td><Badge variant={stageVariant(stage())}>{STAGE_LABEL[stage()]}</Badge></td>
                      <td class="cell-truncate">{o.receiptEmail ?? o.customer ?? '—'}</td>
                      <td>{formatDate(o.created)}</td>
                    </tr>
                  );
                }}
              </For>
            </tbody>
          </table>
          <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
        </>
      </BaseTile>
      {/* Order detail drawer */}
      <StripeDrawer
        isOpen={detail() !== null || detailLoading()}
        title={d() ? `Order ${d()!.id}` : 'Loading…'}
        onClose={() => { setDetail(null); setShowRefundConfirm(false); setShowCancelConfirm(false); setStageError(null); }}
      >
        <Show when={detailLoading()}><Skeleton lines={6} /></Show>
        <Show when={d()}>
          {/* Workflow stage pipeline */}
          <div class="drawer-section">
            <h3 class="drawer-section__title">Order Stage</h3>
            <div class="order-pipeline">
              <For each={STAGES}>
                {(s) => (
                  <button
                    class={`order-pipeline__step${detailStage() === s ? ' order-pipeline__step--active' : ''}`}
                    disabled={stageUpdating() || detailStage() === s}
                    onClick={() => void setStage(d()!.id, s)}
                    title={`Mark as ${STAGE_LABEL[s]}`}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                )}
              </For>
            </div>
            <Show when={stageError()}><p class="drawer-error">{stageError()}</p></Show>
          </div>

          {/* Payment details */}
          <div class="drawer-section">
            <div class="detail-row"><span class="detail-label">Amount</span><span>{formatAmount(d()!.amount, d()!.currency)}</span></div>
            <div class="detail-row"><span class="detail-label">Payment</span><Badge variant={paymentVariant(d()!.status)}>{paymentLabel(d()!.status)}</Badge></div>
            <div class="detail-row"><span class="detail-label">Date</span><span>{formatDate(d()!.created)}</span></div>
            <Show when={d()!.description}>
              <div class="detail-row"><span class="detail-label">Description</span><span>{d()!.description}</span></div>
            </Show>
            <Show when={d()!.billingDetails?.name}>
              <div class="detail-row"><span class="detail-label">Name</span><span>{d()!.billingDetails!.name}</span></div>
            </Show>
            <Show when={d()!.billingDetails?.email ?? d()!.receiptEmail}>
              <div class="detail-row"><span class="detail-label">Email</span><span>{d()!.billingDetails?.email ?? d()!.receiptEmail}</span></div>
            </Show>
            <Show when={d()!.billingDetails?.phone}>
              <div class="detail-row"><span class="detail-label">Phone</span><span>{d()!.billingDetails!.phone}</span></div>
            </Show>
            <Show when={d()!.billingDetails?.address?.line1}>
              <div class="detail-row">
                <span class="detail-label">Address</span>
                <span>{[
                  d()!.billingDetails!.address!['line1'],
                  d()!.billingDetails!.address!['city'],
                  d()!.billingDetails!.address!['country'],
                ].filter(Boolean).join(', ')}</span>
              </div>
            </Show>
            <Show when={d()!.amountRefunded > 0}>
              <div class="detail-row"><span class="detail-label">Refunded</span><span class="text-danger">{formatAmount(d()!.amountRefunded, d()!.currency)}</span></div>
            </Show>
            <Show when={d()!.receiptUrl}>
              <div class="detail-row"><span class="detail-label">Receipt</span><a href={d()!.receiptUrl!} target="_blank" rel="noopener" class="drawer-link">Open ↗</a></div>
            </Show>
            <Show when={d()!.outcome?.sellerMessage}>
              <div class="detail-row"><span class="detail-label">Outcome</span><span>{d()!.outcome!.sellerMessage}</span></div>
            </Show>
            <Show when={d()!.failureMessage}>
              <div class="detail-row"><span class="detail-label">Failure</span><span class="text-danger">{d()!.failureMessage}</span></div>
            </Show>
            <Show when={d()!.disputed}>
              <div class="detail-row"><span class="detail-label">Dispute</span><Badge variant="danger">Disputed</Badge></div>
            </Show>
          </div>

          {/* Refund section */}
          <Show when={canRefund()}>
            <div class="drawer-section drawer-section--actions">
              <h3 class="drawer-section__title">Issue Refund</h3>
              <label class="field">
                <span class="field__label">Amount (max {maxRefund().toFixed(2)})</span>
                <input class="field__input" type="number" min="0.01" max={maxRefund()} step="0.01"
                  value={refundAmount()} onInput={(e) => setRefundAmount(e.currentTarget.value)} />
              </label>
              <label class="field">
                <span class="field__label">Reason</span>
                <select class="field__input" value={refundReason()} onChange={(e) => setRefundReason(e.currentTarget.value)}>
                  <option value="requested_by_customer">Requested by customer</option>
                  <option value="duplicate">Duplicate</option>
                  <option value="fraudulent">Fraudulent</option>
                </select>
              </label>
              <Show when={refundAction.error()}><p class="drawer-error">{refundAction.error()}</p></Show>
              <button class="btn btn--primary" onClick={() => setShowRefundConfirm(true)} disabled={refundAction.loading()}>Refund</button>
            </div>
          </Show>

          {/* Capture / Cancel */}
          <Show when={canCapture() || canCancel()}>
            <div class="drawer-section drawer-section--actions">
              <Show when={canCapture()}>
                <Show when={captureAction.error()}><p class="drawer-error">{captureAction.error()}</p></Show>
                <button class="btn btn--primary" onClick={() => void captureAction.execute()} disabled={captureAction.loading()}>
                  {captureAction.loading() ? 'Capturing…' : 'Capture Payment'}
                </button>
              </Show>
              <Show when={canCancel()}>
                <Show when={cancelAction.error()}><p class="drawer-error">{cancelAction.error()}</p></Show>
                <button class="btn btn--danger" onClick={() => setShowCancelConfirm(true)} disabled={cancelAction.loading()}>Cancel Order</button>
              </Show>
            </div>
          </Show>
        </Show>
      </StripeDrawer>

      <ConfirmDialog
        isOpen={showRefundConfirm()}
        message={`Refund $${refundAmount() || maxRefund().toFixed(2)}? This cannot be undone.`}
        confirmLabel="Issue Refund"
        danger
        onConfirm={() => void refundAction.execute()}
        onCancel={() => setShowRefundConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showCancelConfirm()}
        message="Cancel this order? This cannot be undone."
        confirmLabel="Cancel Order"
        danger
        onConfirm={() => void cancelAction.execute()}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}
