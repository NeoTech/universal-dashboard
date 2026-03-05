import { createSignal, createEffect, on, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintOrder, FlintShipment, FlintShipmentStatus, FlintTrackingInfo } from '../../data/flint';
import { useFlintResource, sendCommand } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { API_BASE_URL } from '../../data/api';
import { fmtDate, timeAgo } from './utils';
import { flintStore } from './flintStore';
import { useFlintDensity } from './useFlintDensity';

const SHIPMENT_STATUS_LABELS: Record<FlintShipmentStatus, string> = {
  pending:    'Pending',
  in_transit: 'In Transit',
  delivered:  'Delivered',
  returned:   'Returned',
  failed:     'Failed',
};

const SHIPMENT_STATUS_CSS: Record<FlintShipmentStatus, string> = {
  pending:    'flint-status--pending',
  in_transit: 'flint-status--processing',
  delivered:  'flint-status--delivered',
  returned:   'flint-status--cancelled',
  failed:     'flint-status--cancelled',
};

export function FlintShipmentsTile(_props: Record<string, never>): JSX.Element {
  const { density, ref } = useFlintDensity();
  const { data: shipments, loading, error } = useFlintResource<FlintShipment[]>('flint-shipments', []);
  const { data: orders } = useFlintResource<FlintOrder[]>('flint-orders', []);

  const [search, setSearch]             = createSignal('');
  const [selected, setSelected]         = createSignal<FlintShipment | null>(null);
  const [drawerOpen, setDrawerOpen]     = createSignal(false);
  const [tracking, setTracking]         = createSignal<FlintTrackingInfo | null>(null);
  const [trackingLoading, setTrackingLoading] = createSignal(false);

  // Create form state
  const [showCreate, setShowCreate]     = createSignal(false);
  const [newOrderId, setNewOrderId]     = createSignal('');
  const [newCarrier, setNewCarrier]     = createSignal('');
  const [newTracking, setNewTracking]   = createSignal('');

  // Edit state
  const [editStatus, setEditStatus]     = createSignal<FlintShipmentStatus>('pending');

  // ── Cross-tile store listener ──────────────────────────────────────────────

  createEffect(on(() => flintStore.shipmentPrefill(), (data) => {
    if (!data) return;
    setNewOrderId(data.orderId);
    setShowCreate(true);
    flintStore.clearShipmentPrefill();
  }, { defer: true }));

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = () => {
    const q = search().toLowerCase();
    if (!q) return shipments();
    return shipments().filter(s =>
      s.trackingNumber.toLowerCase().includes(q) ||
      s.carrier.toLowerCase().includes(q) ||
      (s.orderNumber ?? '').toLowerCase().includes(q),
    );
  };

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 25);

  // ── Actions ────────────────────────────────────────────────────────────────

  function openDrawer(s: FlintShipment): void {
    setSelected(s);
    setEditStatus(s.status);
    setTracking(null);
    setDrawerOpen(true);
    loadTracking(s.trackingNumber);
  }

  async function loadTracking(trackingNumber: string): Promise<void> {
    setTrackingLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flint/tracking/${trackingNumber}`);
      if (res.ok) setTracking(await res.json() as FlintTrackingInfo);
    } catch { /* ignore */ }
    finally { setTrackingLoading(false); }
  }

  const updateAction = useStripeAction(
    async () => {
      const s = selected();
      if (!s) return;
      const result = await sendCommand('update-shipment', s.id, { status: editStatus() });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => setDrawerOpen(false) },
  );

  const createAction = useStripeAction(
    async () => {
      const result = await sendCommand('create-shipment', undefined, { orderId: newOrderId(), carrier: newCarrier(), trackingNumber: newTracking() });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    {
      onSuccess: () => {
        setShowCreate(false);
        setNewOrderId(''); setNewCarrier(''); setNewTracking('');
      },
    },
  );

  // Inline "Mark Delivered" action
  const inlineDeliverAction = useStripeAction(
    async (shipmentId: string) => {
      const result = await sendCommand('update-shipment', shipmentId, { status: 'delivered' });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
  );

  function dispatchOrderFilter(orderId: string): void {
    flintStore.filterOrders({ orderId });
  }

  function copyText(text: string): void {
    void navigator.clipboard.writeText(text).catch(() => undefined);
  }

  return (
    <div class="stripe-tile flint-shipments-tile" ref={ref} data-density={density()}>
      {/* Toolbar */}
      <div class="tile-toolbar">
        <input
          class="tile-search"
          type="search"
          placeholder="Search shipments…"
          value={search()}
          onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
        />
        <button class="btn btn--sm btn--primary" onClick={() => setShowCreate(v => !v)}>
          + New Shipment
        </button>
      </div>

      {/* Create form */}
      <Show when={showCreate()}>
        <div class="flint-inline-form" style="padding:8px;border-bottom:1px solid var(--twm-color-border)">
          <Show when={createAction.error()}>
            <p class="drawer-error">{createAction.error()}</p>
          </Show>
          <label class="flint-auth-form__label">Order ID
            <input
              class="flint-auth-form__input"
              list="flint-order-id-options"
              value={newOrderId()}
              onInput={(e) => setNewOrderId(e.currentTarget.value)}
              placeholder="UUID"
            />
            <datalist id="flint-order-id-options">
              <For each={orders()}>
                {(o) => <option value={o.id}>{o.orderNumber}</option>}
              </For>
            </datalist>
          </label>
          <label class="flint-auth-form__label">Carrier
            <input class="flint-auth-form__input" value={newCarrier()} onInput={(e) => setNewCarrier(e.currentTarget.value)} placeholder="FedEx, UPS…" />
          </label>
          <label class="flint-auth-form__label">Tracking #
            <input class="flint-auth-form__input" value={newTracking()} onInput={(e) => setNewTracking(e.currentTarget.value)} />
          </label>
          <div class="drawer-actions">
            <button class="btn btn--sm btn--primary" disabled={createAction.loading()} onClick={() => void createAction.execute()}>
              {createAction.loading() ? 'Creating…' : 'Create'}
            </button>
            <button class="btn btn--sm btn--neutral" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      </Show>

      <BaseTile loading={loading()} error={error()}>
        <table class="stripe-table">
          <thead>
            <tr>
              <th>Carrier</th>
              <th>Tracking #</th>
              <th>Order</th>
              <th>Status</th>
              <th>Date</th>
              <th style={{ width: '70px' }}></th>
            </tr>
          </thead>
          <tbody>
            <For each={pageItems()}>
              {(s) => (
                <tr class="stripe-table__row" onClick={() => openDrawer(s)}>
                  <td>{s.carrier}</td>
                  <td>
                    <span class="flint-tracking-copy" onClick={(ev) => { ev.stopPropagation(); copyText(s.trackingNumber); }}>
                      {s.trackingNumber.slice(0, 16)}{s.trackingNumber.length > 16 ? '…' : ''}
                    </span>
                  </td>
                  <td>
                    <Show when={s.orderNumber}>
                      <span class="flint-order-chip" onClick={(ev) => { ev.stopPropagation(); dispatchOrderFilter(s.orderId); }}>
                        #{s.orderNumber}
                      </span>
                    </Show>
                  </td>
                  <td><span class={`flint-status-badge ${SHIPMENT_STATUS_CSS[s.status]}`}>{SHIPMENT_STATUS_LABELS[s.status]}</span></td>
                  <td class="cell-muted">{fmtDate(s.createdAt)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <Show when={s.status !== 'delivered' && s.status !== 'returned' && s.status !== 'failed'}>
                      <button
                        class="flint-inline-action"
                        disabled={inlineDeliverAction.loading()}
                        onClick={() => void inlineDeliverAction.execute(s.id)}
                        title="Mark as Delivered"
                      >
                        Deliver
                      </button>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} totalPages={totalPages} setPage={setPage} />
      </BaseTile>

      {/* Detail drawer */}
      <StripeDrawer isOpen={drawerOpen()} title="Shipment" onClose={() => setDrawerOpen(false)}>
        <Show when={selected()}>
          {(s) => (
            <div class="flint-shipment-detail">
              <p><strong>Carrier:</strong> {s().carrier}</p>
              <p><strong>Tracking:</strong> {s().trackingNumber}
                <button class="btn btn--xs btn--neutral" style="margin-left:6px" onClick={() => copyText(s().trackingNumber)}>Copy</button>
              </p>
              <p><strong>Shipped:</strong> {s().shippedAt ? fmtDate(s().shippedAt!) : '—'}</p>
              <p><strong>Est. Delivery:</strong> {s().estimatedDelivery ? fmtDate(s().estimatedDelivery!) : '—'}</p>
              <p><strong>Created:</strong> {timeAgo(s().createdAt)}</p>

              {/* Tracking events */}
              <Show when={trackingLoading()}>
                <p class="cell-muted">Loading tracking…</p>
              </Show>
              <Show when={tracking()}>
                {(t) => (
                  <div style="margin-top:8px">
                    <p class="flint-auth-form__label"><strong>Live Tracking</strong></p>
                    <p>Status: {t().status}</p>
                    <Show when={t().events && t().events!.length > 0}>
                      <ul class="flint-tracking-events">
                        <For each={t().events!}>
                          {(ev) => (
                            <li>
                              <span class="cell-muted">{fmtDate(ev.timestamp)}</span>
                              {ev.location ? ` [${ev.location}] ` : ' '}{ev.description}
                            </li>
                          )}
                        </For>
                      </ul>
                    </Show>
                  </div>
                )}
              </Show>

              {/* Status update */}
              <div style="margin-top:12px">
                <label class="flint-auth-form__label">Update Status
                  <select
                    class="flint-auth-form__input"
                    value={editStatus()}
                    onChange={(e) => setEditStatus(e.currentTarget.value as FlintShipmentStatus)}
                  >
                    <For each={Object.keys(SHIPMENT_STATUS_LABELS) as FlintShipmentStatus[]}>
                      {(st) => <option value={st}>{SHIPMENT_STATUS_LABELS[st]}</option>}
                    </For>
                  </select>
                </label>
                <Show when={updateAction.error()}>
                  <p class="drawer-error">{updateAction.error()}</p>
                </Show>
                <div class="drawer-actions" style="margin-top:8px">
                  <button class="btn btn--sm btn--primary" disabled={updateAction.loading()} onClick={() => void updateAction.execute()}>
                    {updateAction.loading() ? 'Saving…' : 'Save Status'}
                  </button>
                  <Show when={s().status !== 'delivered'}>
                    <button
                      class="btn btn--sm btn--neutral"
                      onClick={() => { setEditStatus('delivered'); void updateAction.execute(); }}
                    >
                      Mark Delivered
                    </button>
                  </Show>
                </div>
              </div>
            </div>
          )}
        </Show>
      </StripeDrawer>
    </div>
  );
}
