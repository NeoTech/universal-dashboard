import { createSignal, createMemo, createEffect, on, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintAddress, FlintCustomer, FlintOrder } from '../../data/flint';
import { StripeDrawer } from '../../ui/StripeDrawer';
import { useFlintResource, sendCommand } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { API_BASE_URL } from '../../data/api';
import { formatCurrency, fmtDate, ORDER_STATUS_LABELS } from './utils';
import { flintStore } from './flintStore';
import { useFlintDensity } from './useFlintDensity';

export function FlintCustomersTile(_props: Record<string, never>): JSX.Element {
  const { density, ref } = useFlintDensity();
  const { data: customers, loading, error } = useFlintResource<FlintCustomer[]>('flint-customers', []);

  const [search, setSearch]         = createSignal('');
  const [selected, setSelected]     = createSignal<FlintCustomer | null>(null);
  const [activeTab, setActiveTab]   = createSignal<'profile' | 'orders' | 'addresses'>('profile');
  const [orders, setOrders]         = createSignal<FlintOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = createSignal(false);
  const [addresses, setAddresses] = createSignal<FlintAddress[]>([]);
  const [addressesLoading, setAddressesLoading] = createSignal(false);
  const [editMode, setEditMode]     = createSignal(false);
  const [editName, setEditName]     = createSignal('');
  const [editPhone, setEditPhone]   = createSignal('');

  const filtered = createMemo(() => {
    const q = search().toLowerCase();
    if (!q) return customers();
    return customers().filter(c =>
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 25);

  // ── Cross-tile store listener ──────────────────────────────────────────────

  createEffect(on(() => flintStore.selectedCustomerId(), (customerId) => {
    if (!customerId) return;
    const c = customers().find(x => x.id === customerId);
    if (c) openCustomer(c);
    flintStore.clearSelectedCustomer();
  }, { defer: true }));

  // ── Edit action ─────────────────────────────────────────────────────────────

  const saveEdit = useStripeAction(
    async (id: string, name: string, phone: string) => {
      const result = await sendCommand('update-customer', id, { name, phone: phone || undefined });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
    },
    { onSuccess: () => setEditMode(false) },
  );

  // ── Open customer + lazy-load orders ───────────────────────────────────────

  function openCustomer(c: FlintCustomer): void {
    setSelected(c);
    setActiveTab('profile');
    setOrders([]);
    setAddresses([]);
    setEditMode(false);
  }

  async function loadOrders(customerId: string): Promise<void> {
    setOrdersLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flint/customers/${customerId}/orders`);
      if (res.ok) {
        const json = await res.json() as { data?: FlintOrder[] } | FlintOrder[];
        setOrders(Array.isArray(json) ? json : (json as { data?: FlintOrder[] }).data ?? []);
      }
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadAddresses(customerId: string): Promise<void> {
    setAddressesLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/flint/customers/${customerId}/addresses`);
      if (res.ok) {
        const json = await res.json() as { data?: FlintAddress[] } | FlintAddress[];
        setAddresses(Array.isArray(json) ? json : (json as { data?: FlintAddress[] }).data ?? []);
      }
    } finally {
      setAddressesLoading(false);
    }
  }

  function handleTabChange(tab: 'profile' | 'orders' | 'addresses'): void {
    setActiveTab(tab);
    if (tab === 'orders' && selected() && orders().length === 0) {
      void loadOrders(selected()!.id);
    }
    if (tab === 'addresses' && selected() && addresses().length === 0) {
      void loadAddresses(selected()!.id);
    }
  }

  function viewInOrders(customerEmail: string): void {
    flintStore.filterOrders({ customerEmail });
  }

  return (
    <div class="stripe-tile flint-customers-tile" ref={ref} data-density={density()}>
      <div class="tile-toolbar">
        <input
          class="tile-search"
          type="search"
          placeholder="Search customers…"
          value={search()}
          onInput={(e) => { setSearch(e.currentTarget.value); setPage(1); }}
        />
        <span class="tile-toolbar__count">{filtered().length} customers</span>
      </div>

      <BaseTile loading={loading()} error={error()}>
        <table class="tile-table tile-table--clickable">
          <thead><tr><th>Name</th><th class="col-email">Email</th><th>Orders</th><th class="cell-right">Spent</th><th style={{ width: '80px' }}></th></tr></thead>
          <tbody>
            <Show when={filtered().length === 0}>
              <tr><td colspan="5" class="cell-empty">No customers found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(c) => (
                <tr onClick={() => openCustomer(c)}>
                  <td class="cell-truncate">{c.name}</td>
                  <td class="col-email cell-truncate">{c.email}</td>
                  <td>{c.totalOrders}</td>
                  <td class="cell-right">{formatCurrency(c.totalSpent, c.currency)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Show when={c.totalOrders > 0}>
                      <button
                        class="flint-inline-action"
                        onClick={() => viewInOrders(c.email)}
                      >
                        Orders
                      </button>
                    </Show>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </BaseTile>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />

      {/* Detail drawer */}
      <StripeDrawer
        isOpen={selected() !== null}
        title={selected()?.name ?? 'Customer'}
        onClose={() => { setSelected(null); setEditMode(false); }}
      >
        <Show when={selected()}>
          {(c) => (
            <>
              {/* Tabs */}
              <div class="flint-filter-chips" style="margin-bottom:10px">
                {(['profile', 'orders', 'addresses'] as const).map(tab => (
                  <button
                    class={`flint-filter-chip${activeTab() === tab ? ' flint-filter-chip--active' : ''}`}
                    onClick={() => handleTabChange(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {/* Profile tab */}
              <Show when={activeTab() === 'profile'}>
                <Show
                  when={editMode()}
                  fallback={
                    <>
                      <dl class="drawer-dl">
                        <dt>Email</dt>  <dd>{c().email}</dd>
                        <dt>Phone</dt>  <dd>{c().phone ?? '—'}</dd>
                        <dt>Orders</dt> <dd>{c().totalOrders}</dd>
                        <dt>Spent</dt>  <dd>{formatCurrency(c().totalSpent, c().currency)}</dd>
                        <dt>Joined</dt> <dd>{fmtDate(c().createdAt)}</dd>
                      </dl>
                      <div class="drawer-actions">
                        <button class="btn btn--neutral" onClick={() => { setEditName(c().name); setEditPhone(c().phone ?? ''); setEditMode(true); }}>Edit</button>
                        <button class="btn btn--neutral" onClick={() => viewInOrders(c().email)}>View Orders</button>
                      </div>
                    </>
                  }
                >
                  <div class="flint-inline-form">
                    <label class="flint-auth-form__label">Name<input class="flint-auth-form__input" value={editName()} onInput={(e) => setEditName(e.currentTarget.value)} /></label>
                    <label class="flint-auth-form__label">Phone<input class="flint-auth-form__input" value={editPhone()} onInput={(e) => setEditPhone(e.currentTarget.value)} /></label>
                    <div class="drawer-actions">
                      <button class="btn btn--primary" disabled={saveEdit.loading()} onClick={() => void saveEdit.execute(c().id, editName(), editPhone())}>
                        {saveEdit.loading() ? 'Saving…' : 'Save'}
                      </button>
                      <button class="btn btn--neutral" onClick={() => setEditMode(false)}>Cancel</button>
                    </div>
                  </div>
                </Show>
              </Show>

              {/* Orders tab */}
              <Show when={activeTab() === 'orders'}>
                <Show when={ordersLoading()}>
                  <p class="drawer-loading">Loading orders…</p>
                </Show>
                <Show when={!ordersLoading()}>
                  <table class="tile-table tile-table--sm">
                    <thead><tr><th>Order #</th><th>Status</th><th>Date</th><th class="cell-right">Total</th></tr></thead>
                    <tbody>
                      <Show when={orders().length === 0}>
                        <tr><td colspan="4" class="cell-empty">No orders</td></tr>
                      </Show>
                      <For each={orders()}>
                        {(o) => (
                          <tr>
                            <td><code>{o.orderNumber}</code></td>
                            <td>{ORDER_STATUS_LABELS[o.status]}</td>
                            <td>{fmtDate(o.createdAt)}</td>
                            <td class="cell-right">{formatCurrency(o.totalAmount, o.currency)}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                  <Show when={orders().length > 0}>
                    <button class="btn btn--sm btn--neutral" style="margin-top:6px" onClick={() => viewInOrders(c().email)}>
                      View in Orders tile
                    </button>
                  </Show>
                </Show>
              </Show>

              {/* Addresses tab */}
              <Show when={activeTab() === 'addresses'}>
                <Show when={addressesLoading()}>
                  <p class="drawer-loading">Loading addresses…</p>
                </Show>
                <Show when={!addressesLoading()}>
                  <Show when={addresses().length > 0} fallback={<p class="cell-empty" style="padding-top:16px">No addresses found</p>}>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                      <For each={addresses()}>
                        {(a) => (
                          <div class="flint-card" style="padding:10px; border:1px solid var(--border); border-radius:6px;">
                            <div style="display:flex; justify-content:space-between; gap:8px;">
                              <strong>{a.name ?? 'Address'}</strong>
                              <Show when={a.isDefault}><span class="cell-muted">Default</span></Show>
                            </div>
                            <div style="font-size:0.9rem; line-height:1.45; margin-top:4px;">
                              <div>{a.line1}</div>
                              <Show when={a.line2}><div>{a.line2}</div></Show>
                              <div>{a.city}{a.state ? `, ${a.state}` : ''} {a.postalCode}</div>
                              <div>{a.country}</div>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </Show>
              </Show>
            </>
          )}
        </Show>
      </StripeDrawer>
    </div>
  );
}
