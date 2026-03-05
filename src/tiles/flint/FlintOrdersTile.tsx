import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintOrder, FlintOrderStatus, FlintProduct } from '../../data/flint';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { useFlintResource, sendCommand, queryResource } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { API_BASE_URL } from '../../data/api';
import {
  formatCurrency, fmtDate, nextActions,
  ORDER_STATUS_LABELS, normalizeOrderLines,
} from './utils';
import { flintStore } from './flintStore';
import { useFlintDensity } from './useFlintDensity';
import { useDashboardActions } from '../DashboardActionsContext';
import { makeTile } from '../TileConfig';

// ── Status badge helper ───────────────────────────────────────────────────────

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

/** Short button labels for inline action column. */
const SHORT_ACTION_LABELS: Partial<Record<FlintOrderStatus, string>> = {
  confirmed:  'Confirm',
  processing: 'Process',
  shipped:    'Ship',
  delivered:  'Deliver',
  pending:    'Unhide',
};

/** Terminal statuses have no forward actions. */
const TERMINAL_STATUSES: ReadonlySet<FlintOrderStatus> = new Set(['cancelled', 'delivered', 'refunded']);

// ── Status filter chips ───────────────────────────────────────────────────────

const ALL_FILTER_STATUSES: (FlintOrderStatus | 'all')[] = [
  'all', 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'hidden',
];

const ORDER_DETAIL_TIMEOUT_MS = 12_000;
const HIDDEN_ORDER_IDS_KEY = 'flint:hidden-order-ids';

function readHiddenOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_ORDER_IDS_KEY);
    if (!raw) return new Set<string>();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set<string>();
    return new Set(parsed.filter((value): value is string => typeof value === 'string'));
  } catch {
    return new Set<string>();
  }
}

function writeHiddenOrderIds(ids: Set<string>): void {
  try {
    localStorage.setItem(HIDDEN_ORDER_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // Ignore storage errors (private mode, quota limits)
  }
}

// ── Order detail type (fetched per order) ────────────────────────────────────

interface Props {
  compact?: boolean;
}

// ── Shipment form state ───────────────────────────────────────────────────────

interface ShipmentForm {
  carrier: string;
  tracking: string;
}

export function FlintOrdersTile(props: Props): JSX.Element {
  const { density, ref } = useFlintDensity();
  const { data: orders, loading, error } = useFlintResource<FlintOrder[]>('flint-orders', []);
  const { data: products } = useFlintResource<FlintProduct[]>('flint-products', []);
  const dashActions = useDashboardActions();

  const [statusFilter, setStatusFilter] = createSignal<FlintOrderStatus | 'all'>('all');
  const [hiddenOrderIds, setHiddenOrderIds] = createSignal<Set<string>>(readHiddenOrderIds());
  const [search, setSearch]             = createSignal('');
  const [selected, setSelected]         = createSignal<FlintOrder | null>(null);
  const [detail,   setDetail]           = createSignal<FlintOrder | null>(null);
  const [detailLoading, setDetailLoading] = createSignal(false);
  const [confirmCancel, setConfirmCancel] = createSignal(false);
  const [showRefund,    setShowRefund]    = createSignal(false);
  const [refundAmount,  setRefundAmount]  = createSignal('');
  const [refundReason,  setRefundReason]  = createSignal('');
  const [showShipment,  setShowShipment]  = createSignal(false);
  const [shipForm, setShipForm]           = createSignal<ShipmentForm>({ carrier: '', tracking: '' });
  const [expandedOrderId, setExpandedOrderId] = createSignal<string | null>(null);
  const [selectedIds, setSelectedIds]     = createSignal<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = createSignal<{ done: number; total: number } | null>(null);
  const [orderDetailCache, setOrderDetailCache] = createSignal<Record<string, FlintOrder>>({});
  const [expandError, setExpandError] = createSignal<string | null>(null);

  // ── Action hooks ───────────────────────────────────────────────────────────

  const advanceAction = useStripeAction(
    async (orderId: string, targetStatus: string) => {
      const result = await sendCommand('update-order-status', orderId, { status: targetStatus });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setSelected(null); setDetail(null); } },
  );

  const cancelAction = useStripeAction(
    async (orderId: string) => {
      const result = await sendCommand('delete-order', orderId);
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setSelected(null); setDetail(null); setConfirmCancel(false); } },
  );

  const refundAction = useStripeAction(
    async (orderId: string, amount: string, reason: string) => {
      const result = await sendCommand('refund-order', orderId, { amount: parseFloat(amount), reason });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => { setShowRefund(false); setRefundAmount(''); setRefundReason(''); } },
  );

  const shipAction = useStripeAction(
    async (orderId: string, carrier: string, tracking: string) => {
      const r1 = await sendCommand('create-shipment', undefined, { orderId, carrier, trackingNumber: tracking });
      if (r1.status === 'failed') throw new Error(r1.error ?? 'Command failed');
      // Advance order to shipped
      const r2 = await sendCommand('update-order-status', orderId, { status: 'shipped' });
      if (r2.status === 'failed') throw new Error(r2.error ?? 'Command failed');
    },
    { onSuccess: () => { setShowShipment(false); setShipForm({ carrier: '', tracking: '' }); setSelected(null); setDetail(null); } },
  );

  // Inline advance action — same API call, no side-effects on success
  const inlineAdvanceAction = useStripeAction(
    async (orderId: string, targetStatus: string) => {
      const result = await sendCommand('update-order-status', orderId, { status: targetStatus });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
  );

  // ── Batch operations ──────────────────────────────────────────────────────

  async function batchAdvance(targetStatus: FlintOrderStatus): Promise<void> {
    const ids = [...selectedIds()];
    if (ids.length === 0) return;
    setBatchProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      try {
        const result = await sendCommand('update-order-status', ids[i], { status: targetStatus });
        if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
      } catch { /* continue batch on single failure */ }
      setBatchProgress({ done: i + 1, total: ids.length });
    }
    setBatchProgress(null);
    setSelectedIds(new Set<string>());
  }

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelect(id: string): void {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    const items = pageItems();
    const all = selectedIds();
    const allSelected = items.every(o => all.has(o.id));
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        items.forEach(o => next.delete(o.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        items.forEach(o => next.add(o.id));
        return next;
      });
    }
  }

  // ── Expand row detail fetch ───────────────────────────────────────────────

  const [expandDetail, setExpandDetail] = createSignal<FlintOrder | null>(null);
  const [expandLoading, setExpandLoading] = createSignal(false);

  function cacheDetail(order: FlintOrder): void {
    const normalized = normalizeOrderLines(order);
    setOrderDetailCache(prev => ({ ...prev, [normalized.id]: normalized }));
  }

  async function fetchOrderDetail(orderId: string, forceFresh = false): Promise<FlintOrder | null> {
    // Fast path: WS query reads from server projection cache (zero upstream calls)
    if (!forceFresh) {
      try {
        const cached = await queryResource<FlintOrder>('flint-order-detail', { id: orderId });
        if (cached && cached.lines && cached.lines.length > 0) return normalizeOrderLines(cached);
      } catch {
        // WS query failed (disconnected, timeout), fall through to REST
      }
    }

    // Fallback: REST endpoint triggers upstream fetch + enrichment if needed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ORDER_DETAIL_TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flint/orders/${orderId}`, {
        signal: controller.signal,
        headers: forceFresh ? { 'x-flint-bypass-cache': '1' } : undefined,
      });
      if (!res.ok) return null;
      const json = await res.json() as { data?: FlintOrder } | FlintOrder;
      const detail = (json as { data?: FlintOrder }).data ?? (json as FlintOrder);
      return detail ? normalizeOrderLines(detail) : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function refreshOrdersChannel(): Promise<void> {
    try {
      await fetch(`${API_BASE_URL}/api/refresh/flint-orders`, { method: 'POST' });
    } catch {
      // Ignore refresh errors and continue with cached/live detail fetch path.
    }
  }

  async function toggleExpand(order: FlintOrder): Promise<void> {
    if (expandedOrderId() === order.id) {
      setExpandedOrderId(null);
      setExpandDetail(null);
      setExpandLoading(false);
      setExpandError(null);
      return;
    }

    setExpandedOrderId(order.id);
    setExpandError(null);
    const cached = orderDetailCache()[order.id];
    setExpandDetail(cached ?? normalizeOrderLines(order));
    setExpandLoading(true);
    try {
      void refreshOrdersChannel();
      const live = await fetchOrderDetail(order.id, false);
      if (expandedOrderId() !== order.id) return;

      if (live) {
        setExpandDetail(live);
        cacheDetail(live);
      } else if (!cached) {
        setExpandError('Live details unavailable, showing cached summary.');
      }
    } finally {
      if (expandedOrderId() === order.id) setExpandLoading(false);
    }
  }

  // ── Primary inline action for a row ───────────────────────────────────────

  function primaryAction(order: FlintOrder): { targetStatus: FlintOrderStatus; label: string } | null {
    if (hiddenOrderIds().has(order.id)) {
      return { targetStatus: 'pending', label: SHORT_ACTION_LABELS.pending ?? 'Unhide' };
    }
    const status = order.status;
    if (status === 'hidden') {
      return { targetStatus: 'pending', label: SHORT_ACTION_LABELS.pending ?? 'Unhide' };
    }
    if (TERMINAL_STATUSES.has(status)) return null;
    const forwardTarget: Partial<Record<FlintOrderStatus, FlintOrderStatus>> = {
      pending: 'confirmed',
      confirmed: 'processing',
      processing: 'shipped',
      shipped: 'delivered',
    };
    const targetStatus = forwardTarget[status];
    if (!targetStatus) return null;
    return { targetStatus, label: SHORT_ACTION_LABELS[targetStatus] ?? ORDER_STATUS_LABELS[targetStatus] };
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = createMemo(() => {
    const sf = statusFilter();
    const q  = search().toLowerCase();
    const hiddenIds = hiddenOrderIds();
    return orders().filter(o => {
      const isHidden = hiddenIds.has(o.id);
      if (sf === 'hidden') return isHidden;
      if (isHidden) return false;
      if (sf !== 'all' && o.status !== sf) return false;
      if (q && !o.orderNumber.toLowerCase().includes(q) &&
               !o.customerName.toLowerCase().includes(q) &&
               !o.customerEmail.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 25);

  // ── Detail fetch ──────────────────────────────────────────────────────────

  async function openOrder(order: FlintOrder): Promise<void> {
    if (props.compact) return;
    const fallback = normalizeOrderLines(order);
    setSelected(fallback);
    setDetail(fallback);
    setDetailLoading(true);
    try {
      void refreshOrdersChannel();
      const live = await fetchOrderDetail(order.id, false);
      if (live) {
        setDetail(live);
        cacheDetail(live);
      } else {
        setDetail(fallback);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  // ── Cross-tile store listener ──────────────────────────────────────────────

  createEffect(on(() => flintStore.orderFilter(), (filter) => {
    if (!filter) return;
    if (filter.customerEmail || filter.customerId) {
      setSearch(filter.customerEmail ?? filter.customerId ?? '');
      setStatusFilter('all');
    }
    if (filter.orderId) {
      const order = orders().find(o => o.id === filter.orderId);
      if (order) void openOrder(order);
    }
    flintStore.clearOrderFilter();
  }, { defer: true }));

  // ── Derived helpers ───────────────────────────────────────────────────────

  const activeOrder = () => detail() ?? selected();

  function isClosed(status: FlintOrderStatus): boolean {
    return status === 'cancelled' || status === 'delivered' || status === 'refunded';
  }

  function setHiddenState(orderId: string, hidden: boolean): void {
    setHiddenOrderIds((prev) => {
      const next = new Set(prev);
      if (hidden) next.add(orderId);
      else next.delete(orderId);
      writeHiddenOrderIds(next);
      return next;
    });
  }

  function resolveLineProductName(line: { productId: string; productName: string }): string {
    const current = line.productName ?? '';
    const placeholder = !current || current === '—' || current === line.productId;
    if (!placeholder) return current;
    const mapped = products().find((product) => product.id === line.productId)?.name;
    return mapped ?? current ?? line.productId ?? '—';
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div class="stripe-tile flint-orders-tile" ref={ref} data-density={density()}>
      {/* Toolbar */}
      <div class="tile-toolbar">
        <div class="flint-filter-chips">
          <For each={ALL_FILTER_STATUSES}>
            {(s) => (
              <button
                class={`flint-filter-chip${statusFilter() === s ? ' flint-filter-chip--active' : ''}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === 'all' ? 'All' : ORDER_STATUS_LABELS[s as FlintOrderStatus]}
              </button>
            )}
          </For>
        </div>
        <input
          class="tile-search"
          type="search"
          placeholder="Search orders…"
          value={search()}
          onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
        />
      </div>

      {/* Batch toolbar */}
      <Show when={selectedIds().size >= 2}>
        <div class="flint-batch-toolbar">
          <Show when={batchProgress()} fallback={
            <>
              <span>{selectedIds().size} orders selected</span>
              <button class="btn btn--primary btn--sm" onClick={() => void batchAdvance('confirmed')}>Confirm All</button>
              <button class="btn btn--primary btn--sm" onClick={() => void batchAdvance('processing')}>Process All</button>
              <button class="btn btn--neutral btn--sm" onClick={() => setSelectedIds(new Set<string>())}>Clear</button>
            </>
          }>
            {(p) => <span>Processing {p().done}/{p().total}...</span>}
          </Show>
        </div>
      </Show>

      <BaseTile loading={loading()} error={error()}>
        <table class="tile-table tile-table--clickable">
          <thead>
            <tr>
              <th style={{ width: '28px' }}>
                <input
                  type="checkbox"
                  checked={pageItems().length > 0 && pageItems().every(o => selectedIds().has(o.id))}
                  onChange={() => toggleSelectAll()}
                />
              </th>
              <th>Order #</th>
              <th class="col-customer">Customer</th>
              <th class="col-date">Date</th>
              <th>Status</th>
              <th class="cell-right">Total</th>
              <th style={{ width: '160px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            <Show when={filtered().length === 0}>
              <tr><td colspan="7" class="cell-empty">No orders match the current filter</td></tr>
            </Show>
            <For each={pageItems()}>
              {(order) => {
                const action = () => primaryAction(order);
                return (
                  <>
                    <tr
                      class={`${isClosed(order.status) ? 'tr--muted' : ''}${expandedOrderId() === order.id ? ' tr--expanded' : ''}`}
                      onClick={() => void toggleExpand(order)}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds().has(order.id)}
                          onChange={() => toggleSelect(order.id)}
                        />
                      </td>
                      <td><code>{order.orderNumber}</code></td>
                      <td class="col-customer cell-truncate">
                        <span
                          class="flint-link"
                          onClick={(e) => { e.stopPropagation(); flintStore.openCustomer(order.customerId); }}
                        >
                          {order.customerName}
                        </span>
                      </td>
                      <td class="col-date">{fmtDate(order.createdAt)}</td>
                      <td>
                        <Badge variant={STATUS_BADGE[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </td>
                      <td class="cell-right">
                        {formatCurrency(order.totalAmount, order.currency)}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px', 'justify-content': 'flex-end' }}>
                          <Show when={action()}>
                            {(a) => (
                              <button
                                class="flint-inline-action"
                                disabled={inlineAdvanceAction.loading()}
                                onClick={() => {
                                  if (hiddenOrderIds().has(order.id)) {
                                    setHiddenState(order.id, false);
                                    return;
                                  }
                                  void inlineAdvanceAction.execute(order.id, a().targetStatus);
                                }}
                              >
                                {a().label}
                              </button>
                            )}
                          </Show>
                          <button
                            class="flint-inline-action"
                            onClick={() => setHiddenState(order.id, !hiddenOrderIds().has(order.id))}
                          >
                            {hiddenOrderIds().has(order.id) ? 'Unhide' : 'Hide'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    <Show when={expandedOrderId() === order.id}>
                      <tr class="flint-expand-row">
                        <td colspan="7">
                          <div class="flint-expand-content">
                            <Show when={expandLoading()}>
                              <p class="cell-muted">Refreshing live details…</p>
                            </Show>
                            <Show when={expandError()}>
                              <p class="drawer-error">{expandError()}</p>
                            </Show>
                            <Show when={expandDetail()} fallback={<p class="drawer-loading">Loading live details…</p>}>
                              {(det) => {
                                const lines = det().lines;
                                return (
                                  <>
                                    <Show when={lines.length > 0}>
                                      <table class="tile-table">
                                        <thead><tr><th>Product</th><th>Qty</th><th class="cell-right">Total</th></tr></thead>
                                        <tbody>
                                          <For each={lines}>
                                            {(line) => (
                                              <tr>
                                                <td>
                                                  {resolveLineProductName(line)}
                                                  <Show when={line.variantName}>
                                                    <span class="cell-muted"> · {line.variantName}</span>
                                                  </Show>
                                                </td>
                                                <td>{line.quantity}</td>
                                                <td class="cell-right">{formatCurrency(line.totalPrice, line.currency)}</td>
                                              </tr>
                                            )}
                                          </For>
                                        </tbody>
                                      </table>
                                    </Show>
                                    <Show when={lines.length === 0}>
                                      <p class="cell-muted">No line items</p>
                                    </Show>
                                    <button
                                      class="btn btn--neutral btn--sm"
                                      style={{ "margin-top": '8px' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const hasReceiptTile = dashActions?.hasTileType('flint-order-receipt') ?? false;
                                        if (dashActions && !hasReceiptTile) {
                                          dashActions.addTile(makeTile('flint-order-receipt'));
                                        }
                                        const cachedDetail = orderDetailCache()[order.id];
                                        const currentExpanded = expandedOrderId() === order.id ? expandDetail() : null;
                                        const snapshotBase = currentExpanded ?? cachedDetail ?? { ...order, lines: [] };
                                        flintStore.openOrderReceipt(order.id, normalizeOrderLines(snapshotBase));
                                      }}
                                    >
                                      Full Details
                                    </button>
                                  </>
                                );
                              }}
                            </Show>
                          </div>
                        </td>
                      </tr>
                    </Show>
                  </>
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
        title={`Order ${activeOrder()?.orderNumber ?? ''}`}
        onClose={() => { setSelected(null); setDetail(null); setShowRefund(false); setShowShipment(false); }}
      >
        <Show when={detailLoading()}>
          <p class="drawer-loading">Loading order details…</p>
        </Show>
        <Show when={activeOrder()}>
          {(o) => (
            <>
              {/* Summary */}
              <dl class="drawer-dl">
                <dt>Status</dt>
                <dd>
                  <Badge variant={STATUS_BADGE[o().status]}>
                    {ORDER_STATUS_LABELS[o().status]}
                  </Badge>
                </dd>
                <dt>Customer</dt><dd>{o().customerName} ({o().customerEmail})</dd>
                <dt>Total</dt>   <dd>{formatCurrency(o().totalAmount, o().currency)}</dd>
                <dt>Date</dt>    <dd>{fmtDate(o().createdAt)}</dd>
                <Show when={o().paymentIntentId}>
                  <dt>Payment Intent</dt><dd><code>{o().paymentIntentId}</code></dd>
                </Show>
                <Show when={o().notes}>
                  <dt>Notes</dt><dd>{o().notes}</dd>
                </Show>
              </dl>

              {/* Line items */}
              <Show when={o().lines.length > 0}>
                <h3 class="drawer-section__title">Line Items</h3>
                <table class="tile-table">
                  <thead><tr><th>Product</th><th>Qty</th><th class="cell-right">Total</th></tr></thead>
                  <tbody>
                    <For each={o().lines}>
                      {(line) => (
                        <tr>
                          <td>
                            {resolveLineProductName(line)}
                            <Show when={line.variantName}>
                              <span class="cell-muted"> · {line.variantName}</span>
                            </Show>
                          </td>
                          <td>{line.quantity}</td>
                          <td class="cell-right">{formatCurrency(line.totalPrice, line.currency)}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Show>

              {/* Actions */}
              <Show when={!isClosed(o().status)}>
                <h3 class="drawer-section__title">Actions</h3>
                <Show when={advanceAction.error()}>
                  <p class="drawer-error">{advanceAction.error()}</p>
                </Show>
                <div class="drawer-actions">
                  <Show
                    when={!hiddenOrderIds().has(o().id)}
                    fallback={
                      <button
                        class="btn btn--neutral"
                        onClick={() => setHiddenState(o().id, false)}
                      >
                        Unhide Order
                      </button>
                    }
                  >
                    <button
                      class="btn btn--neutral"
                      onClick={() => setHiddenState(o().id, true)}
                    >
                      Hide Order
                    </button>
                  </Show>
                  <For each={nextActions(o().status)}>
                    {(action) => (
                      <Show
                        when={action.targetStatus === 'shipped'}
                        fallback={
                          <Show
                            when={action.targetStatus === 'cancelled'}
                            fallback={
                              <button
                                class="btn btn--primary"
                                disabled={advanceAction.loading()}
                                onClick={() => void advanceAction.execute(o().id, action.targetStatus)}
                              >
                                {advanceAction.loading() ? 'Saving…' : action.label}
                              </button>
                            }
                          >
                            <button
                              class="btn btn--danger"
                              onClick={() => setConfirmCancel(true)}
                            >
                              {action.label}
                            </button>
                          </Show>
                        }
                      >
                        <button
                          class="btn btn--neutral"
                          onClick={() => setShowShipment(true)}
                        >
                          {action.label}
                        </button>
                      </Show>
                    )}
                  </For>

                  {/* Issue Refund — only for confirmed/processing/shipped */}
                  <Show when={['confirmed', 'processing', 'shipped'].includes(o().status)}>
                    <button
                      class="btn btn--neutral"
                      onClick={() => setShowRefund(v => !v)}
                    >
                      Issue Refund
                    </button>
                  </Show>
                </div>

                {/* Refund form */}
                <Show when={showRefund()}>
                  <div class="flint-inline-form">
                    <Show when={refundAction.error()}>
                      <p class="drawer-error">{refundAction.error()}</p>
                    </Show>
                    <label class="flint-auth-form__label">
                      Amount ({o().currency})
                      <input
                        type="number"
                        class="flint-auth-form__input"
                        min="0.01"
                        step="0.01"
                        value={refundAmount()}
                        onInput={(e) => setRefundAmount(e.currentTarget.value)}
                      />
                    </label>
                    <label class="flint-auth-form__label">
                      Reason
                      <input
                        type="text"
                        class="flint-auth-form__input"
                        value={refundReason()}
                        onInput={(e) => setRefundReason(e.currentTarget.value)}
                      />
                    </label>
                    <button
                      class="btn btn--primary"
                      disabled={refundAction.loading() || !refundAmount()}
                      onClick={() => void refundAction.execute(o().id, refundAmount(), refundReason())}
                    >
                      {refundAction.loading() ? 'Processing…' : 'Submit Refund'}
                    </button>
                  </div>
                </Show>

                {/* Shipment form */}
                <Show when={showShipment()}>
                  <div class="flint-inline-form">
                    <Show when={shipAction.error()}>
                      <p class="drawer-error">{shipAction.error()}</p>
                    </Show>
                    <label class="flint-auth-form__label">
                      Carrier
                      <input
                        type="text"
                        class="flint-auth-form__input"
                        placeholder="DHL, FedEx, UPS…"
                        value={shipForm().carrier}
                        onInput={(e) => setShipForm(f => ({ ...f, carrier: e.currentTarget.value }))}
                      />
                    </label>
                    <label class="flint-auth-form__label">
                      Tracking Number
                      <input
                        type="text"
                        class="flint-auth-form__input"
                        value={shipForm().tracking}
                        onInput={(e) => setShipForm(f => ({ ...f, tracking: e.currentTarget.value }))}
                      />
                    </label>
                    <button
                      class="btn btn--primary"
                      disabled={shipAction.loading() || !shipForm().carrier || !shipForm().tracking}
                      onClick={() => void shipAction.execute(o().id, shipForm().carrier, shipForm().tracking)}
                    >
                      {shipAction.loading() ? 'Saving…' : 'Create Shipment & Mark Shipped'}
                    </button>
                  </div>
                </Show>
              </Show>
            </>
          )}
        </Show>
      </StripeDrawer>

      {/* Cancel confirm */}
      <ConfirmDialog
        isOpen={confirmCancel()}
        message={`Cancel order ${activeOrder()?.orderNumber ?? ''}? This cannot be undone.`}
        confirmLabel="Cancel Order"
        danger
        onConfirm={() => activeOrder() && void cancelAction.execute(activeOrder()!.id)}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
