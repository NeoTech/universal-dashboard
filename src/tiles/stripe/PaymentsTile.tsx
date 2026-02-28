import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchPayment, refundPayment, capturePayment, cancelPayment,
  formatAmount, formatDate,
} from '../../data/stripe';
import type { StripePayment, StripePaymentDetail } from '../../data/stripe';
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

function statusVariant(status: string) {
  if (status === 'succeeded') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  return 'danger' as const;
}

export function PaymentsTile(_props: Props): JSX.Element {
  const config = useTileConfig();
  const compact = () => config?.displayMode === 'compact';
  const { data: payments, loading, error } = useSseChannel<StripePayment[]>('stripe-payments', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => payments(), 10);
  const [selected, setSelected] = createSignal<StripePaymentDetail | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [refundAmount, setRefundAmount] = createSignal('');
  const [refundReason, setRefundReason] = createSignal('requested_by_customer');
  const [showRefundConfirm, setShowRefundConfirm] = createSignal(false);
  const [showCancelConfirm, setShowCancelConfirm] = createSignal(false);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null);
    try {
      const detail = await fetchPayment(id);
      setSelected(detail);
      setRefundAmount(String((detail.amount - detail.amountRefunded) / 100));
    } finally { setDetailLoading(false); }
  }

  const refundAction = useStripeAction(
    async () => {
      const d = selected();
      if (!d) return;
      await refundPayment(d.id, {
        amount: Math.round(parseFloat(refundAmount()) * 100),
        reason: refundReason(),
      });
    },
    { onSuccess: () => { setShowRefundConfirm(false); void openDetail(selected()!.id); } },
  );

  const captureAction = useStripeAction(
    async () => { await capturePayment(selected()!.id); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const cancelAction = useStripeAction(
    async () => { await cancelPayment(selected()!.paymentIntent ?? selected()!.id); },
    { onSuccess: () => { setShowCancelConfirm(false); void openDetail(selected()!.id); } },
  );

  const d = () => selected();
  const maxRefund = () => d() ? (d()!.amount - d()!.amountRefunded) / 100 : 0;
  const canRefund = () => d() && d()!.status === 'succeeded' && !d()!.refunded && d()!.amountRefunded < d()!.amount;
  const canCapture = () => d() && !d()!.captured && d()!.status !== 'failed';
  const canCancel = () => d() && d()!.paymentIntent && d()!.status === 'pending';

  return (
    <div class="stripe-tile payments-tile">
      <BaseTile loading={loading()} error={error()}>
        <>
          <table class="tile-table" classList={{ 'tile-table--clickable': !compact() }}>
            <thead><tr><th>Amount</th><th>Status</th><Show when={!compact()}><th>Customer</th></Show><th>Date</th></tr></thead>
            <tbody>
              <For each={pageItems()}>
                {(p) => (
                  <tr onClick={compact() ? undefined : () => void openDetail(p.id)}>
                    <td>{formatAmount(p.amount, p.currency)}</td>
                    <td><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                    <Show when={!compact()}><td class="cell-truncate">{p.receiptEmail ?? p.customer ?? '—'}</td></Show>
                    <td>{formatDate(p.created)}</td>
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
      {/* Detail drawer — hidden in compact mode */}
      <Show when={!compact()}>
      <StripeDrawer
        isOpen={selected() !== null || detailLoading()}
        title={d() ? `Charge ${d()!.id}` : 'Loading…'}
        onClose={() => { setSelected(null); setShowRefundConfirm(false); setShowCancelConfirm(false); }}
      >
        <Show when={detailLoading()}><Skeleton lines={6} /></Show>
        <Show when={d()}>
          <div class="drawer-section">
            <div class="detail-row"><span class="detail-label">Amount</span><span>{formatAmount(d()!.amount, d()!.currency)}</span></div>
            <div class="detail-row"><span class="detail-label">Status</span><Badge variant={statusVariant(d()!.status)}>{d()!.status}</Badge></div>
            <div class="detail-row"><span class="detail-label">Date</span><span>{formatDate(d()!.created)}</span></div>
            <Show when={d()!.billingDetails?.email ?? d()!.receiptEmail}>
              <div class="detail-row"><span class="detail-label">Email</span><span>{d()!.billingDetails?.email ?? d()!.receiptEmail}</span></div>
            </Show>
            <Show when={d()!.billingDetails?.name}>
              <div class="detail-row"><span class="detail-label">Name</span><span>{d()!.billingDetails!.name}</span></div>
            </Show>
            <Show when={d()!.amountRefunded > 0}>
              <div class="detail-row"><span class="detail-label">Refunded</span><span class="text-danger">{formatAmount(d()!.amountRefunded, d()!.currency)}</span></div>
            </Show>
            <Show when={d()!.receiptUrl}>
              <div class="detail-row"><span class="detail-label">Receipt</span><a href={d()!.receiptUrl!} target="_blank" rel="noopener" class="drawer-link">Open ↗</a></div>
            </Show>
            <Show when={d()!.failureMessage}>
              <div class="detail-row"><span class="detail-label">Failure</span><span class="text-danger">{d()!.failureMessage}</span></div>
            </Show>
            <Show when={d()!.outcome?.sellerMessage}>
              <div class="detail-row"><span class="detail-label">Outcome</span><span>{d()!.outcome!.sellerMessage}</span></div>
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
                <button class="btn btn--danger" onClick={() => setShowCancelConfirm(true)} disabled={cancelAction.loading()}>Cancel Payment</button>
              </Show>
            </div>
          </Show>
        </Show>
      </StripeDrawer>
      </Show>

      <ConfirmDialog
        isOpen={showRefundConfirm()}
        message={`Refund ${refundAmount() ? `$${refundAmount()}` : 'full amount'}? This cannot be undone.`}
        confirmLabel="Issue Refund"
        danger
        onConfirm={() => void refundAction.execute()}
        onCancel={() => setShowRefundConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showCancelConfirm()}
        message="Cancel this payment? This cannot be undone."
        confirmLabel="Cancel Payment"
        danger
        onConfirm={() => void cancelAction.execute()}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}
