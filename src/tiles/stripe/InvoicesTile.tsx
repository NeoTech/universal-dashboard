import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import {
  fetchInvoice, finalizeInvoice, payInvoice, voidInvoice, sendInvoice,
  formatAmount, formatDate,
} from '../../data/stripe';
import type { StripeInvoice, StripeInvoiceDetail } from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function invoiceVariant(status: string) {
  if (status === 'paid') return 'success' as const;
  if (status === 'open') return 'warning' as const;
  if (status === 'void' || status === 'uncollectible') return 'neutral' as const;
  return 'danger' as const;
}

export function InvoicesTile(_props: Props): JSX.Element {
  const { data: invoices, loading, error } = useSseChannel<StripeInvoice[]>('stripe-invoices', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => invoices(), 10);
  const [selected, setSelected] = createSignal<StripeInvoiceDetail | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [showVoidConfirm, setShowVoidConfirm] = createSignal(false);

  async function openDetail(id: string) {
    setDetailLoading(true);
    setSelected(null);
    try { setSelected(await fetchInvoice(id)); }
    finally { setDetailLoading(false); }
  }

  const finalizeAction = useStripeAction(
    async () => { await finalizeInvoice(selected()!.id); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const payAction = useStripeAction(
    async () => { await payInvoice(selected()!.id); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const voidAction = useStripeAction(
    async () => { await voidInvoice(selected()!.id); },
    { onSuccess: () => { setShowVoidConfirm(false); void openDetail(selected()!.id); } },
  );

  const sendAction = useStripeAction(
    async () => { await sendInvoice(selected()!.id); },
    { onSuccess: () => { void openDetail(selected()!.id); } },
  );

  const d = () => selected();

  return (
    <div class="stripe-tile invoices-tile">
      <BaseTile loading={loading()} error={error()}>
        <>
          <table class="tile-table tile-table--clickable">
            <thead><tr><th>#</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
            <tbody>
              <For each={pageItems()}>
                {(inv) => (
                  <tr onClick={() => void openDetail(inv.id)}>
                    <td class="mono cell-truncate">{inv.number ?? inv.id.slice(0, 12)}</td>
                    <td>{formatAmount(inv.amountDue, inv.currency)}</td>
                    <td><Badge variant={invoiceVariant(inv.status ?? 'void')}>{inv.status ?? '—'}</Badge></td>
                    <td>{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
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
        title={d() ? `Invoice ${d()!.number ?? d()!.id}` : 'Loading…'}
        onClose={() => { setSelected(null); setShowVoidConfirm(false); }}
      >
        <Show when={detailLoading()}><Skeleton lines={6} /></Show>
        <Show when={d()}>
          <div class="drawer-section">
            <div class="detail-row"><span class="detail-label">Status</span><Badge variant={invoiceVariant(d()!.status ?? 'void')}>{d()!.status ?? '—'}</Badge></div>
            <div class="detail-row"><span class="detail-label">Total</span><span>{formatAmount(d()!.total, d()!.currency)}</span></div>
            <div class="detail-row"><span class="detail-label">Amount due</span><span>{formatAmount(d()!.amountDue, d()!.currency)}</span></div>
            <div class="detail-row"><span class="detail-label">Amount paid</span><span class="text-success">{formatAmount(d()!.amountPaid, d()!.currency)}</span></div>
            <Show when={d()!.amountRemaining > 0}>
              <div class="detail-row"><span class="detail-label">Remaining</span><span class="text-danger">{formatAmount(d()!.amountRemaining, d()!.currency)}</span></div>
            </Show>
            <Show when={d()!.dueDate}>
              <div class="detail-row"><span class="detail-label">Due date</span><span>{formatDate(d()!.dueDate!)}</span></div>
            </Show>
            <Show when={d()!.attemptCount > 0}>
              <div class="detail-row"><span class="detail-label">Payment attempts</span><span>{d()!.attemptCount}</span></div>
            </Show>
            <Show when={d()!.hostedInvoiceUrl}>
              <div class="detail-row"><span class="detail-label">Hosted URL</span><a href={d()!.hostedInvoiceUrl!} target="_blank" rel="noopener" class="drawer-link">View ↗</a></div>
            </Show>
          </div>

          {/* Line items */}
          <Show when={d()!.lines?.length}>
            <div class="drawer-section">
              <h3 class="drawer-section__title">Line Items</h3>
              <table class="tile-table tile-table--sm">
                <thead><tr><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                  <For each={d()!.lines}>
                    {(line) => (
                      <tr>
                        <td class="cell-truncate">{line.description ?? '—'}</td>
                        <td>{formatAmount(line.amount, line.currency)}</td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>

          {/* Actions */}
          <div class="drawer-section drawer-section--actions">
            <Show when={d()!.status === 'draft'}>
              <Show when={finalizeAction.error()}><p class="drawer-error">{finalizeAction.error()}</p></Show>
              <button class="btn btn--primary" onClick={() => void finalizeAction.execute()} disabled={finalizeAction.loading()}>
                {finalizeAction.loading() ? 'Finalizing…' : 'Finalize Invoice'}
              </button>
            </Show>
            <Show when={d()!.status === 'open'}>
              <Show when={payAction.error()}><p class="drawer-error">{payAction.error()}</p></Show>
              <button class="btn btn--primary" onClick={() => void payAction.execute()} disabled={payAction.loading()}>
                {payAction.loading() ? 'Collecting…' : 'Collect Payment'}
              </button>
              <Show when={sendAction.error()}><p class="drawer-error">{sendAction.error()}</p></Show>
              <button class="btn btn--neutral" onClick={() => void sendAction.execute()} disabled={sendAction.loading()}>
                {sendAction.loading() ? 'Sending…' : 'Send to Customer'}
              </button>
              <Show when={voidAction.error()}><p class="drawer-error">{voidAction.error()}</p></Show>
              <button class="btn btn--danger" onClick={() => setShowVoidConfirm(true)} disabled={voidAction.loading()}>Void Invoice</button>
            </Show>
          </div>
        </Show>
      </StripeDrawer>

      <ConfirmDialog
        isOpen={showVoidConfirm()}
        message="Void this invoice? This cannot be undone."
        confirmLabel="Void Invoice"
        danger
        onConfirm={() => void voidAction.execute()}
        onCancel={() => setShowVoidConfirm(false)}
      />
    </div>
  );
}
