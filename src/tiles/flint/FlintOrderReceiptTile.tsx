import { createSignal, createEffect, on, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintOrder, FlintOrderStatus, FlintProduct } from '../../data/flint';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { API_BASE_URL } from '../../data/api';
import { sendCommand, queryResource } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import {
  formatCurrency, fmtDate, timeAgo, nextActions,
  ORDER_STATUS_LABELS, normalizeOrderLines,
} from './utils';
import { flintStore } from './flintStore';
import { useFlintResource } from './flintRealtimeStore';
import { useDashboardActions } from '../DashboardActionsContext';
import { makeTile } from '../TileConfig';

// ── Status badge map ──────────────────────────────────────────────────────────

const STATUS_BADGE: Record<FlintOrderStatus, BadgeVariant> = {
  pending:    'warning',
  confirmed:  'neutral',
  processing: 'neutral',
  shipped:    'neutral',
  delivered:  'success',
  cancelled:  'danger',
  refunded:   'danger',
  hidden:     'neutral',
};

// ── Status pipeline (for timeline) ────────────────────────────────────────────

const PIPELINE: FlintOrderStatus[] = [
  'pending', 'confirmed', 'processing', 'shipped', 'delivered',
];

function pipelineIndex(status: FlintOrderStatus): number {
  if (status === 'cancelled' || status === 'refunded' || status === 'hidden') return -1;
  return PIPELINE.indexOf(status);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FlintOrderReceiptTile(_props: Record<string, never>): JSX.Element {
  const { data: products } = useFlintResource<FlintProduct[]>('flint-products', []);
  const dashActions = useDashboardActions();
  const [order, setOrder]     = createSignal<FlintOrder | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError]     = createSignal<string | null>(null);
  let latestRequestId = 0;
  let inFlightController: AbortController | null = null;

  // ── Fetch order by ID ───────────────────────────────────────────────────

  async function fetchOrder(orderId: string): Promise<void> {
    const requestId = ++latestRequestId;
    inFlightController?.abort();
    const controller = new AbortController();
    inFlightController = controller;
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 10_000);
    setLoading(true);
    setError(null);

    try {
      // Fast path: WS query reads from server projection cache (zero upstream calls)
      try {
        const cached = await queryResource<FlintOrder>('flint-order-detail', { id: orderId });
        if (requestId !== latestRequestId) return;
        if (cached && cached.lines && cached.lines.length > 0) {
          setOrder(normalizeOrderLines(cached));
          return;
        }
      } catch {
        // WS query failed, fall through to REST
      }

      // Fallback: REST endpoint triggers upstream fetch + enrichment if needed
      const res = await fetch(`${API_BASE_URL}/api/flint/orders/${orderId}`, { signal: controller.signal });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const json = await res.json() as { data?: FlintOrder } | FlintOrder;
      const raw = (json as { data?: FlintOrder }).data ?? (json as FlintOrder);
      if (requestId !== latestRequestId) return;
      setOrder(normalizeOrderLines(raw));
    } catch (err) {
      if (requestId !== latestRequestId) return;
      if (err instanceof DOMException && err.name === 'AbortError') {
        setError('Loading order timed out. Please try again.');
        return;
      }
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      clearTimeout(timeoutId);
      if (inFlightController === controller) inFlightController = null;
      if (requestId === latestRequestId) setLoading(false);
    }
  }

  // ── React to cross-tile signal ──────────────────────────────────────────

  createEffect(on(() => flintStore.receiptOrderRequest(), (request) => {
    if (request?.orderId) {
      if (request.snapshot) {
        setOrder(normalizeOrderLines(request.snapshot));
      }
      void fetchOrder(request.orderId);
    }
  }));

  onCleanup(() => {
    inFlightController?.abort();
  });

  // ── Advance action ──────────────────────────────────────────────────────

  const advanceAction = useStripeAction(
    async (orderId: string, targetStatus: string) => {
      const result = await sendCommand('update-order-status', orderId, { status: targetStatus });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
      // Refresh
      void fetchOrder(orderId);
    },
  );

  // ── Helpers ─────────────────────────────────────────────────────────────

  function lineSubtotal(o: FlintOrder): number {
    return o.lines.reduce((sum, l) => sum + (l.totalPrice ?? l.quantity * l.unitPrice), 0);
  }

  function resolveLineProductName(line: { productId: string; productName: string }): string {
    const current = line.productName ?? '';
    const placeholder = !current || current === '—' || current === line.productId;
    if (!placeholder) return current;
    const mapped = products().find((product) => product.id === line.productId)?.name;
    return mapped ?? current ?? line.productId ?? '—';
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div class="stripe-tile flint-receipt-tile" style="padding: 16px; overflow-y: auto;">
      <Show when={loading()}>
        <p class="drawer-loading">Loading order...</p>
      </Show>

      <Show when={error()}>
        <p class="drawer-error">{error()}</p>
      </Show>

      <Show when={!order() && !loading() && !error()}>
        <div style="text-align: center; padding: 48px 16px; color: var(--text-muted);">
          <p style="font-size: 2rem; margin-bottom: 8px;">No order selected</p>
          <p>Click <strong>Full Details</strong> on an order to view its receipt here.</p>
        </div>
      </Show>

      <Show when={order()}>
        {(o) => {
          const lines = () => o().lines ?? [];
          const subtotal = () => lineSubtotal(o());
          const statusIdx = () => pipelineIndex(o().status);
          const isTerminal = () => o().status === 'cancelled' || o().status === 'refunded' || o().status === 'hidden';

          return (
            <>
              {/* Header */}
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
                <div>
                  <h2 style="margin: 0; font-size: 1.15rem;">
                    Order #{o().orderNumber}
                  </h2>
                  <span class="cell-muted" style="font-size: 0.85rem;">
                    {fmtDate(o().createdAt)} ({timeAgo(o().createdAt)})
                  </span>
                </div>
                <Badge variant={STATUS_BADGE[o().status]}>
                  {ORDER_STATUS_LABELS[o().status]}
                </Badge>
              </div>

              {/* Status pipeline */}
              <Show when={!isTerminal()}>
                <div class="flint-receipt-pipeline" style="display: flex; gap: 2px; margin-bottom: 16px;">
                  <For each={PIPELINE}>
                    {(step, i) => {
                      const active = () => i() <= statusIdx();
                      return (
                        <div
                          style={{
                            flex: '1',
                            height: '4px',
                            'border-radius': '2px',
                            background: active()
                              ? 'var(--accent, #3b82f6)'
                              : 'var(--border, #333)',
                            transition: 'background 0.2s',
                          }}
                          title={ORDER_STATUS_LABELS[step]}
                        />
                      );
                    }}
                  </For>
                </div>
              </Show>

              <Show when={isTerminal()}>
                <div style={{
                  'margin-bottom': '16px',
                  padding: '6px 12px',
                  'border-radius': '4px',
                  background: 'var(--danger-bg, rgba(239,68,68,0.1))',
                  color: 'var(--danger, #ef4444)',
                  'font-size': '0.85rem',
                }}>
                  This order has been {o().status}.
                </div>
              </Show>

              {/* Customer info */}
              <section style="margin-bottom: 16px;">
                <h3 class="drawer-section__title" style="margin: 0 0 6px;">Customer</h3>
                <dl class="drawer-dl" style="margin: 0;">
                  <dt>Name</dt>
                  <dd>
                    <span
                      class="flint-link"
                      onClick={() => flintStore.openCustomer(o().customerId)}
                    >
                      {o().customerName}
                    </span>
                  </dd>
                  <dt>Email</dt><dd>{o().customerEmail}</dd>
                </dl>
              </section>

              {/* Shipping address */}
              <Show when={o().shippingAddress}>
                {(addr) => (
                  <section style="margin-bottom: 16px;">
                    <h3 class="drawer-section__title" style="margin: 0 0 6px;">Shipping Address</h3>
                    <p style="margin: 0; line-height: 1.5; font-size: 0.9rem;">
                      <Show when={addr().name}>{addr().name}<br /></Show>
                      {addr().line1}<br />
                      <Show when={addr().line2}>{addr().line2}<br /></Show>
                      {addr().city}{addr().state ? `, ${addr().state}` : ''} {addr().postalCode}<br />
                      {addr().country}
                    </p>
                  </section>
                )}
              </Show>

              {/* Payment info */}
              <Show when={o().paymentIntentId}>
                <section style="margin-bottom: 16px;">
                  <h3 class="drawer-section__title" style="margin: 0 0 6px;">Payment</h3>
                  <dl class="drawer-dl" style="margin: 0;">
                    <dt>Payment Intent</dt>
                    <dd><code style="font-size: 0.8rem;">{o().paymentIntentId}</code></dd>
                    <Show when={o().stripeSessionId}>
                      <dt>Session</dt>
                      <dd><code style="font-size: 0.8rem;">{o().stripeSessionId}</code></dd>
                    </Show>
                  </dl>
                </section>
              </Show>

              {/* Line items */}
              <section style="margin-bottom: 16px;">
                <h3 class="drawer-section__title" style="margin: 0 0 6px;">Items</h3>
                <Show when={lines().length > 0} fallback={
                  <p class="cell-muted">No line items</p>
                }>
                  <table class="tile-table" style="margin-bottom: 8px;">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th class="cell-right">Price</th>
                        <th class="cell-right">Qty</th>
                        <th class="cell-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={lines()}>
                        {(line) => (
                          <tr>
                            <td>
                              {resolveLineProductName(line)}
                              <Show when={line.variantName}>
                                <span class="cell-muted"> · {line.variantName}</span>
                              </Show>
                            </td>
                            <td class="cell-right">{formatCurrency(line.unitPrice, line.currency)}</td>
                            <td class="cell-right">{line.quantity}</td>
                            <td class="cell-right">{formatCurrency(line.totalPrice, line.currency)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                  {/* Totals */}
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-size: 0.9rem;">
                    <div style="display: flex; gap: 24px;">
                      <span class="cell-muted">Subtotal</span>
                      <span>{formatCurrency(subtotal(), o().currency)}</span>
                    </div>
                    <div style="display: flex; gap: 24px; font-weight: 600; font-size: 1rem;">
                      <span>Total</span>
                      <span>{formatCurrency(o().totalAmount, o().currency)}</span>
                    </div>
                  </div>
                </Show>
              </section>

              {/* Notes */}
              <Show when={o().notes}>
                <section style="margin-bottom: 16px;">
                  <h3 class="drawer-section__title" style="margin: 0 0 6px;">Notes</h3>
                  <p style="margin: 0; white-space: pre-wrap; font-size: 0.9rem;">{o().notes}</p>
                </section>
              </Show>

              {/* Actions */}
              <section>
                <h3 class="drawer-section__title" style="margin: 0 0 6px;">Shipment</h3>
                <div class="drawer-actions" style="flex-wrap: wrap;">
                  <button
                    class="btn btn--sm btn--neutral"
                    onClick={() => {
                      const hasShipmentsTile = dashActions?.hasTileType('flint-shipments') ?? false;
                      if (dashActions && !hasShipmentsTile) {
                        dashActions.addTile(makeTile('flint-shipments'));
                      }
                      flintStore.prefillShipment({ orderId: o().id });
                    }}
                  >
                    New shipment
                  </button>
                </div>
              </section>

              <Show when={nextActions(o().status).length > 0}>
                <section>
                  <h3 class="drawer-section__title" style="margin: 0 0 6px;">Actions</h3>
                  <Show when={advanceAction.error()}>
                    <p class="drawer-error">{advanceAction.error()}</p>
                  </Show>
                  <div class="drawer-actions" style="flex-wrap: wrap;">
                    <For each={nextActions(o().status)}>
                      {(action) => (
                        <button
                          class={`btn btn--sm ${action.targetStatus === 'cancelled' ? 'btn--danger' : 'btn--primary'}`}
                          disabled={advanceAction.loading()}
                          onClick={() => void advanceAction.execute(o().id, action.targetStatus)}
                        >
                          {advanceAction.loading() ? 'Saving...' : action.label}
                        </button>
                      )}
                    </For>
                  </div>
                </section>
              </Show>

              {/* Metadata footer */}
              <div style="margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--border, #333); font-size: 0.8rem; color: var(--text-muted);">
                <span>ID: {o().id}</span>
                <Show when={o().updatedAt !== o().createdAt}>
                  <span style="margin-left: 12px;">Updated {timeAgo(o().updatedAt)}</span>
                </Show>
              </div>
            </>
          );
        }}
      </Show>
    </div>
  );
}
