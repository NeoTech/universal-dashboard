import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintOrder, FlintCustomer } from '../../data/flint';
import { Badge } from '../../ui/Badge';
import { API_BASE_URL } from '../../data/api';
import { sendCommand } from './flintRealtimeStore';
import { formatCurrency, fmtDate, ORDER_STATUS_LABELS, nextActions } from './utils';
import { flintStore } from './flintStore';

type SearchResult =
  | { kind: 'order'; order: FlintOrder }
  | { kind: 'customer'; customer: FlintCustomer }
  | { kind: 'none' };

export function FlintOrderSearchTile(_props: Record<string, never>): JSX.Element {
  const [query, setQuery]           = createSignal('');
  const [loading, setLoading]       = createSignal(false);
  const [searchError, setSearchError] = createSignal<string | null>(null);
  const [result, setResult]         = createSignal<SearchResult | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);

  async function doSearch(): Promise<void> {
    const q = query().trim();
    if (!q) return;
    setLoading(true);
    setSearchError(null);
    setResult(null);
    setActionError(null);

    try {
      if (q.includes('@')) {
        // Email → customer search
        const res = await fetch(`${API_BASE_URL}/api/flint/customers?email=${encodeURIComponent(q)}`);
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json() as FlintCustomer[] | FlintCustomer;
        const customer = Array.isArray(data) ? data[0] : data;
        if (customer?.id) {
          setResult({ kind: 'customer', customer });
        } else {
          setResult({ kind: 'none' });
        }
      } else {
        // UUID → order lookup
        const res = await fetch(`${API_BASE_URL}/api/flint/orders/${encodeURIComponent(q)}`);
        if (res.status === 404) { setResult({ kind: 'none' }); return; }
        if (!res.ok) throw new Error(await res.text());
        const order = await res.json() as FlintOrder;
        setResult({ kind: 'order', order });
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function advanceOrder(orderId: string, targetStatus: string): Promise<void> {
    setActionError(null);
    try {
      const result = await sendCommand('update-order-status', orderId, { status: targetStatus });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
      setResult({ kind: 'order', order: result.data as FlintOrder });
      flintStore.filterOrders({ orderId });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  }

  function openCustomer(customerId: string): void {
    flintStore.openCustomer(customerId);
  }

  function openOrdersForCustomer(customerEmail: string): void {
    flintStore.filterOrders({ customerEmail });
  }

  return (
    <div class="stripe-tile flint-order-search-tile" style="padding:12px">
      <div class="tile-toolbar">
        <input
          class="tile-search"
          type="search"
          placeholder="Order UUID or customer email…"
          value={query()}
          onInput={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void doSearch(); }}
          style="flex:1"
        />
        <button
          class="btn btn--primary"
          disabled={loading() || !query().trim()}
          onClick={() => void doSearch()}
        >
          {loading() ? 'Searching…' : 'Search'}
        </button>
      </div>

      <Show when={searchError()}>
        <p class="drawer-error">{searchError()}</p>
      </Show>

      <Show when={result()}>
        {(r) => (
          <>
            <Show when={r().kind === 'none'}>
              <p class="cell-empty" style="margin-top:12px">No results found</p>
            </Show>

            <Show when={r().kind === 'order'}>
              {(() => {
                const order = () => (r() as { kind: 'order'; order: FlintOrder }).order;
                return (
                  <div class="flint-search-result-card" style="margin-top:12px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                      <strong>Order #{order().orderNumber}</strong>
                      <Badge variant="neutral">{ORDER_STATUS_LABELS[order().status]}</Badge>
                    </div>
                    <p class="cell-muted">{fmtDate(order().createdAt)} · {formatCurrency(order().totalAmount, order().currency)}</p>
                    <p>{order().customerName} &lt;{order().customerEmail}&gt;</p>
                    <Show when={actionError()}>
                      <p class="drawer-error">{actionError()}</p>
                    </Show>
                    <div class="drawer-actions" style="margin-top:8px;flex-wrap:wrap">
                      <button
                        class="btn btn--sm btn--neutral"
                        onClick={() => flintStore.filterOrders({ orderId: order().id })}
                      >
                        View in Orders tile
                      </button>
                      {nextActions(order().status).map(a => (
                        <button
                          class="btn btn--sm btn--primary"
                          onClick={() => void advanceOrder(order().id, a.targetStatus)}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </Show>

            <Show when={r().kind === 'customer'}>
              {(() => {
                const customer = () => (r() as { kind: 'customer'; customer: FlintCustomer }).customer;
                return (
                  <div class="flint-search-result-card" style="margin-top:12px">
                    <strong>{customer().name}</strong>
                    <p class="cell-muted">{customer().email}</p>
                    <p>{customer().totalOrders} orders · {formatCurrency(customer().totalSpent, customer().currency)} spent</p>
                    <div class="drawer-actions" style="margin-top:8px">
                      <button class="btn btn--sm btn--neutral" onClick={() => openCustomer(customer().id)}>
                        View Profile
                      </button>
                      <button class="btn btn--sm btn--neutral" onClick={() => openOrdersForCustomer(customer().email)}>
                        View Orders
                      </button>
                    </div>
                  </div>
                );
              })()}
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
