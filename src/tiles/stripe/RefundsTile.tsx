import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { createRefund, formatAmount, formatDate } from '../../data/stripe';
import type { StripeRefund } from '../../data/stripe';
import { Badge } from '../../ui/Badge';
import { useStripeAction } from '../../ui/useStripeAction';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function refundVariant(status: string) {
  if (status === 'succeeded') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  if (status === 'failed' || status === 'canceled') return 'danger' as const;
  return 'neutral' as const;
}

export function RefundsTile(_props: Props): JSX.Element {
  const { data: refunds, loading, error } = useSseChannel<StripeRefund[]>('stripe-refunds', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => refunds(), 10);
  const [showForm, setShowForm] = createSignal(false);
  const [chargeId, setChargeId] = createSignal('');
  const [amount, setAmount] = createSignal('');
  const [reason, setReason] = createSignal('requested_by_customer');

  const createAction = useStripeAction(
    async () => {
      const body: Record<string, unknown> = { reason: reason() };
      const rawId = chargeId().trim();
      if (rawId.startsWith('pi_')) body['payment_intent'] = rawId;
      else body['charge'] = rawId;
      if (amount()) body['amount'] = Math.round(parseFloat(amount()) * 100);
      await createRefund(body);
    },
    {
      onSuccess: () => {
        setShowForm(false);
        setChargeId(''); setAmount(''); setReason('requested_by_customer');
      },
    },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile refunds-tile">
      <>
      <div class="tile-toolbar">
        <span class="tile-toolbar__count">{refunds().length} refunds</span>
        <button class="btn btn--sm btn--primary" onClick={() => setShowForm(v => !v)}>
          {showForm() ? 'Cancel' : '+ New Refund'}
        </button>
      </div>

      <Show when={showForm()}>
        <div class="refund-form drawer-section">
          <label class="field">
            <span class="field__label">Charge ID or Payment Intent ID</span>
            <input class="field__input" value={chargeId()} onInput={(e) => setChargeId(e.currentTarget.value)} placeholder="ch_... or pi_..." />
          </label>
          <label class="field">
            <span class="field__label">Amount (blank = full refund)</span>
            <input class="field__input" type="number" min="0.01" step="0.01" value={amount()} onInput={(e) => setAmount(e.currentTarget.value)} placeholder="Leave blank for full amount" />
          </label>
          <label class="field">
            <span class="field__label">Reason</span>
            <select class="field__input" value={reason()} onChange={(e) => setReason(e.currentTarget.value)}>
              <option value="requested_by_customer">Requested by customer</option>
              <option value="duplicate">Duplicate</option>
              <option value="fraudulent">Fraudulent</option>
            </select>
          </label>
          <Show when={createAction.error()}><p class="drawer-error">{createAction.error()}</p></Show>
          <button class="btn btn--primary" onClick={() => void createAction.execute()} disabled={createAction.loading() || !chargeId().trim()}>
            {createAction.loading() ? 'Creating…' : 'Create Refund'}
          </button>
        </div>
      </Show>

      {refunds().length === 0 ? (
        <p class="drawer-empty">No refunds found.</p>
      ) : (
        <table class="tile-table">
          <thead><tr><th>Amount</th><th>Status</th><th>Reason</th><th>Date</th></tr></thead>
          <tbody>
            <For each={pageItems()}>
              {(r) => (
                <tr>
                  <td>{formatAmount(r.amount, r.currency)}</td>
                  <td><Badge variant={refundVariant(r.status ?? '')}>{r.status ?? '—'}</Badge></td>
                  <td>{r.reason ?? '—'}</td>
                  <td>{formatDate(r.created)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      )}
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
