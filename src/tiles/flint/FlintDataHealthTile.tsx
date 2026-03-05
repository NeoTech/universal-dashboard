import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintDataHealth } from '../../data/flint';
import { useFlintResource } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { API_BASE_URL } from '../../data/api';
import { fmtDate } from './utils';

const DEFAULT_HEALTH: FlintDataHealth = {
  tableCounts: {},
  orphanedOrderLines: 0,
  duplicateAddresses: 0,
  stuckWebhooks: 0,
  unlinkedStripePayments: 0,
  lastCheckedAt: '',
};

type HealthAction = 'purge-orphans' | 'dedupe-addresses' | 'mark-webhook-processed' | 'rollback-order';

export function FlintDataHealthTile(_props: Record<string, never>): JSX.Element {
  const { data: health, loading, error } = useFlintResource<FlintDataHealth>('flint-data-health', DEFAULT_HEALTH);

  const [confirm, setConfirm]           = createSignal<HealthAction | null>(null);
  const [eventId, setEventId]           = createSignal('');
  const [paymentIntentId, setPaymentIntentId] = createSignal('');
  const [showActions, setShowActions]   = createSignal(false);

  const runAction = useStripeAction(
    async () => {
      const action = confirm();
      if (!action) return;
      const params = new URLSearchParams({ action });
      if (action === 'mark-webhook-processed') params.set('eventId', eventId());
      if (action === 'rollback-order')         params.set('paymentIntentId', paymentIntentId());
      const res = await fetch(`${API_BASE_URL}/api/flint/admin/data-health?${params.toString()}`, { method: 'POST' });
      if (!res.ok) throw new Error(await res.text());
    },
    { onSuccess: () => setConfirm(null) },
  );

  function trafficLight(value: number, warnThreshold = 1, label?: string): JSX.Element {
    const dot = value === 0 ? 'flint-dot--green'
      : value < warnThreshold * 5 ? 'flint-dot--yellow'
      : 'flint-dot--red';
    return (
      <span class={`flint-health-dot ${dot}`} title={label ?? String(value)} />
    );
  }

  const CONFIRM_LABELS: Record<HealthAction, string> = {
    'purge-orphans':              'Purge all orphaned order lines? This is irreversible.',
    'dedupe-addresses':           'Deduplicate addresses? Duplicate entries will be merged.',
    'mark-webhook-processed':     `Mark webhook event ${eventId() || '<id>'} as processed?`,
    'rollback-order':             `Rollback order for payment intent ${paymentIntentId() || '<id>'}?`,
  };

  return (
    <div class="stripe-tile flint-data-health-tile">
      <div class="tile-toolbar">
        <span class="flint-auth-form__label" style="flex:1">Data Health</span>
        <button class="btn btn--sm btn--neutral" onClick={() => setShowActions(v => !v)}>
          {showActions() ? 'Hide Actions' : 'Actions'}
        </button>
      </div>

      <BaseTile loading={loading()} error={error()}>
        {/* Summary table */}
        <table class="stripe-table">
          <thead>
            <tr>
              <th>Check</th>
              <th class="cell-right">Count</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Orphaned Order Lines</td>
              <td class="cell-right">{health().orphanedOrderLines}</td>
              <td>{trafficLight(health().orphanedOrderLines)}</td>
            </tr>
            <tr>
              <td>Duplicate Addresses</td>
              <td class="cell-right">{health().duplicateAddresses}</td>
              <td>{trafficLight(health().duplicateAddresses)}</td>
            </tr>
            <tr>
              <td>Stuck Webhooks</td>
              <td class="cell-right">{health().stuckWebhooks}</td>
              <td>{trafficLight(health().stuckWebhooks, 1)}</td>
            </tr>
            <tr>
              <td>Unlinked Stripe Payments</td>
              <td class="cell-right">{health().unlinkedStripePayments}</td>
              <td>{trafficLight(health().unlinkedStripePayments)}</td>
            </tr>
            <For each={Object.entries(health().tableCounts)}>
              {([table, count]) => (
                <tr>
                  <td class="cell-muted">{table}</td>
                  <td class="cell-right">{count}</td>
                  <td>{trafficLight(0)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <Show when={health().lastCheckedAt}>
          <p class="cell-muted" style="padding:4px 8px;font-size:var(--twm-font-size-xs)">
            Last checked: {fmtDate(health().lastCheckedAt)}
          </p>
        </Show>

        {/* Action panel */}
        <Show when={showActions()}>
          <div class="flint-health-actions" style="padding:8px;border-top:1px solid var(--twm-color-border)">
            <Show when={runAction.error()}>
              <p class="drawer-error">{runAction.error()}</p>
            </Show>
            <div class="drawer-actions" style="flex-wrap:wrap;gap:6px">
              <button class="btn btn--sm btn--danger" onClick={() => setConfirm('purge-orphans')}>
                Purge Orphans
              </button>
              <button class="btn btn--sm btn--neutral" onClick={() => setConfirm('dedupe-addresses')}>
                Dedupe Addresses
              </button>
            </div>

            <div style="margin-top:8px">
              <label class="flint-auth-form__label">Event ID (for Mark Processed)
                <input class="flint-auth-form__input" value={eventId()} onInput={(e) => setEventId(e.currentTarget.value)} placeholder="webhook event UUID" />
              </label>
              <button
                class="btn btn--sm btn--neutral"
                style="margin-top:4px"
                disabled={!eventId()}
                onClick={() => setConfirm('mark-webhook-processed')}
              >
                Mark Webhook Processed
              </button>
            </div>

            <div style="margin-top:8px">
              <label class="flint-auth-form__label">Payment Intent ID (for Rollback)
                <input class="flint-auth-form__input" value={paymentIntentId()} onInput={(e) => setPaymentIntentId(e.currentTarget.value)} placeholder="pi_…" />
              </label>
              <button
                class="btn btn--sm btn--danger"
                style="margin-top:4px"
                disabled={!paymentIntentId()}
                onClick={() => setConfirm('rollback-order')}
              >
                Rollback Order
              </button>
            </div>
          </div>
        </Show>
      </BaseTile>

      <ConfirmDialog
        isOpen={confirm() !== null}
        message={confirm() ? CONFIRM_LABELS[confirm()!] : ''}
        danger={confirm() === 'purge-orphans' || confirm() === 'rollback-order'}
        confirmLabel={runAction.loading() ? 'Running…' : 'Confirm'}
        onConfirm={() => void runAction.execute()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
