import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { PayPalTransactionDetail, PayPalBalance } from '../../data/paypal';
import { ppStatusLabel, ppPayerName } from '../../data/paypal';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function statusBadge(code: string): { label: string; variant: BadgeVariant } {
  switch (code) {
    case 'S': return { label: 'Success',      variant: 'success' };
    case 'P': return { label: 'Pending',      variant: 'warning' };
    case 'D': return { label: 'Denied',       variant: 'danger'  };
    case 'V': return { label: 'Reversed',     variant: 'danger'  };
    case 'F': return { label: 'Part. Refund', variant: 'neutral' };
    default:  return { label: code,           variant: 'neutral' };
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtAmount(amount: { currency_code: string; value: string } | undefined): string {
  if (!amount) return '—';
  return `${amount.currency_code} ${amount.value}`;
}

interface PayPalData { transactions: PayPalTransactionDetail[]; balances: PayPalBalance[]; }

export function TransactionsTile(_props: Props): JSX.Element {
  const { data: ppData, loading, error } = useSseChannel<PayPalData>('paypal-data', { transactions: [], balances: [] });
  const txns = () => ppData().transactions;
  const balances = () => ppData().balances;
  const { page, setPage, totalPages, pageItems } = usePagination(() => txns(), 10);
  const [selected, setSelected] = createSignal<PayPalTransactionDetail | null>(null);

  const primaryBalance = () => balances().find((b) => b.primary) ?? balances()[0];

  return (
    <div class="stripe-tile paypal-tile">
      {/* Summary bar */}
      <Show when={primaryBalance()}>
        {(bal) => (
          <div class="orders-stages" style="margin-bottom:6px">
            <div class="orders-stage">
              <span class="orders-stage__label">Balance</span>
              <strong>{fmtAmount(bal().total_balance)}</strong>
            </div>
            <div class="orders-stage">
              <span class="orders-stage__label">Transactions (30d)</span>
              <strong>{txns().length}</strong>
            </div>
          </div>
        )}
      </Show>

      <BaseTile loading={loading()} error={error()}>
        <table class="tile-table tile-table--clickable">
          <thead><tr><th>Date</th><th>Payer</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>
            <Show when={txns().length === 0}>
              <tr><td colspan="4" class="cell-empty">No transactions in the last 30 days</td></tr>
            </Show>
            <For each={pageItems()}>
              {(t) => {
                const ti = t.transaction_info;
                const badge = statusBadge(ti.transaction_status);
                return (
                  <tr onClick={() => setSelected(t)}>
                    <td>{fmtDate(ti.transaction_initiation_date)}</td>
                    <td class="cell-truncate">{ppPayerName(t.payer_info)}</td>
                    <td>{fmtAmount(ti.transaction_amount)}</td>
                    <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
      </BaseTile>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />

      {/* Detail drawer */}
      <StripeDrawer
        isOpen={selected() !== null}
        title={`Transaction ${selected()?.transaction_info.transaction_id ?? ''}`}
        onClose={() => setSelected(null)}
      >
        <Show when={selected()}>
          {(t) => {
            const ti = t().transaction_info;
            const pi = t().payer_info;
            const badge = statusBadge(ti.transaction_status);
            return (
              <div class="drawer-section">
                <h3 class="drawer-section__title">Transaction Detail</h3>
                <dl class="drawer-dl">
                  <dt>ID</dt>          <dd><code>{ti.transaction_id}</code></dd>
                  <dt>Status</dt>      <dd><Badge variant={badge.variant}>{ppStatusLabel(ti.transaction_status)}</Badge></dd>
                  <dt>Amount</dt>      <dd>{fmtAmount(ti.transaction_amount)}</dd>
                  <dt>Fee</dt>         <dd>{fmtAmount(ti.fee_amount)}</dd>
                  <dt>Balance after</dt><dd>{fmtAmount(ti.ending_balance)}</dd>
                  <dt>Date</dt>        <dd>{fmtDate(ti.transaction_initiation_date)}</dd>
                  <dt>Event code</dt>  <dd>{ti.transaction_event_code}</dd>
                  <Show when={ti.invoice_id}>
                    <dt>Invoice</dt>   <dd>{ti.invoice_id}</dd>
                  </Show>
                  <Show when={ti.transaction_note}>
                    <dt>Note</dt>      <dd>{ti.transaction_note}</dd>
                  </Show>
                </dl>
                <Show when={pi}>
                  <h3 class="drawer-section__title" style="margin-top:12px">Payer</h3>
                  <dl class="drawer-dl">
                    <dt>Name</dt>  <dd>{ppPayerName(pi)}</dd>
                    <dt>Email</dt> <dd>{pi?.email_address ?? '—'}</dd>
                  </dl>
                </Show>
              </div>
            );
          }}
        </Show>
      </StripeDrawer>
    </div>
  );
}
