import { createSignal, onMount, onCleanup, For } from 'solid-js';
import type { JSX } from 'solid-js';
import type { StripeWebhookEvent } from '../../data/stripe';
import { API_BASE_URL, formatDate } from '../../data/stripe';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props {
  refreshInterval?: number;
}

export function WebhooksTile(_props: Props): JSX.Element {
  const { data: sseEvents, loading, error } = useSseChannel<StripeWebhookEvent[]>('stripe-webhooks', []);
  const [live, setLive] = createSignal(false);
  const [liveEvents, setLiveEvents] = createSignal<StripeWebhookEvent[]>([]);

  // Merge: real-time live events (not yet in SSE base list) prepended
  const events = () => {
    const sse = sseEvents();
    const sseIds = new Set(sse.map((e) => e.id));
    return [...liveEvents().filter((e) => !sseIds.has(e.id)), ...sse].slice(0, 25);
  };
  const { page, setPage, totalPages, pageItems } = usePagination(() => events(), 10);

  // Connect to dedicated stream for real-time incoming webhook events
  onMount(() => {
    const es = new EventSource(`${API_BASE_URL}/api/stripe/webhooks/stream`);
    es.addEventListener('open', () => setLive(true));
    es.addEventListener('error', () => setLive(false));
    es.addEventListener('message', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string) as { type: string; event?: StripeWebhookEvent };
        if (payload.type === 'stripe-event' && payload.event) {
          setLiveEvents((prev) => [payload.event!, ...prev].slice(0, 25));
        }
      } catch { /* malformed payload */ }
    });
    onCleanup(() => es.close());
  });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile webhooks-tile" skeletonLines={4}>
      <>
        <div class="webhooks-header">
          <span class={`live-indicator ${live() ? 'live-indicator--on' : ''}`}>
            {live() ? '● Live' : '○ Polling'}
          </span>
        </div>
        <table class="tile-table">
          <thead><tr><th>Event</th><th>Date</th><th>Mode</th></tr></thead>
          <tbody>
            <For each={pageItems()}>
              {(ev) => (
                <tr>
                  <td class="mono event-type">{ev.type}</td>
                  <td>{formatDate(ev.created)}</td>
                  <td>{ev.livemode ? 'Live' : 'Test'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
