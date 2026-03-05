import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintWebhookEvent } from '../../data/flint';
import { useFlintResource } from './flintRealtimeStore';
import { BaseWsTile as BaseTile } from '../../tiles/BaseWsTile';
import { API_BASE_URL } from '../../data/api';
import { timeAgo, formatCurrency } from './utils';
import { flintStore } from './flintStore';

interface Props {
  maxEvents?: number;
}

export function FlintWebhookMonitorTile(props: Props): JSX.Element {
  const maxEvents = () => props.maxEvents ?? 50;
  const { data: events, loading, error } = useFlintResource<FlintWebhookEvent[]>('flint-webhooks', []);

  const [expandedId, setExpandedId] = createSignal<string | null>(null);
  const [markingId, setMarkingId]   = createSignal<string | null>(null);
  const [markError, setMarkError]   = createSignal<string | null>(null);

  const visibleEvents = () => events().slice(0, maxEvents());

  function toggleExpand(id: string): void {
    setExpandedId(prev => (prev === id ? null : id));
  }

  function triggerSync(): void {
    flintStore.triggerSync();
  }

  async function markProcessed(id: string): Promise<void> {
    setMarkingId(id);
    setMarkError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/flint/admin/data-health?action=mark-webhook-processed&eventId=${encodeURIComponent(id)}`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      setMarkError(err instanceof Error ? err.message : String(err));
    } finally {
      if (markingId() === id) setMarkingId(null);
    }
  }

  return (
    <div class="stripe-tile flint-webhook-monitor-tile">
      <div class="tile-toolbar">
        <span class="flint-auth-form__label" style="flex:1">Webhook Monitor</span>
        <button class="btn btn--sm btn--primary" onClick={triggerSync}>
          Trigger Stripe Sync
        </button>
      </div>

      <Show when={markError()}>
        <p class="drawer-error" style="padding:0 8px">{markError()}</p>
      </Show>

      <BaseTile loading={loading()} error={error()}>
        <Show when={visibleEvents().length === 0}>
          <p class="cell-empty">No webhook events yet</p>
        </Show>
        <table class="stripe-table">
          <thead>
            <Show when={visibleEvents().length > 0}>
              <tr>
                <th>Time</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </Show>
          </thead>
          <tbody>
            <For each={visibleEvents()}>
              {(ev) => (
                <>
                  <tr
                    class={`stripe-table__row${ev.error ? ' tr--muted' : ''}`}
                    style="cursor:pointer"
                    onClick={() => toggleExpand(ev.id)}
                  >
                    <td class="cell-muted">{timeAgo(ev.receivedAt)}</td>
                    <td>
                      <span class={`flint-webhook-type-badge${ev.processed ? '' : ' flint-status--pending'}`}>
                        {ev.type}
                      </span>
                    </td>
                    <td>
                      <Show when={ev.amount != null}>
                        {formatCurrency(ev.amount!, ev.currency ?? 'USD')}
                      </Show>
                    </td>
                    <td>
                      <Show
                        when={ev.processed}
                        fallback={<span class="flint-status-badge flint-status--pending">Pending</span>}
                      >
                        <span class="flint-status-badge flint-status--delivered">Processed</span>
                      </Show>
                    </td>
                    <td>
                      <Show when={!ev.processed}>
                        <button
                          class="btn btn--xs btn--neutral"
                          disabled={markingId() === ev.id}
                          onClick={(e) => { e.stopPropagation(); void markProcessed(ev.id); }}
                        >
                          {markingId() === ev.id ? 'Marking…' : 'Mark Processed'}
                        </button>
                      </Show>
                    </td>
                  </tr>
                  <Show when={expandedId() === ev.id}>
                    <tr>
                      <td colspan="5" style="padding:8px;background:var(--twm-color-surface2)">
                        <pre class="flint-webhook-json">{JSON.stringify(ev, null, 2)}</pre>
                        <Show when={ev.error}>
                          <p class="drawer-error">Error: {ev.error}</p>
                        </Show>
                      </td>
                    </tr>
                  </Show>
                </>
              )}
            </For>
          </tbody>
        </table>
      </BaseTile>
    </div>
  );
}
