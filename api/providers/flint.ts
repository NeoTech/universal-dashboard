/**
 * FLINT provider — server-side integration for the LOPC e-commerce API.
 *
 * The LOPC API ({@link https://lopc-api.andreas-016.workers.dev}) uses RS256
 * JWTs with a 15-minute TTL. This module owns the entire JWT lifecycle:
 *
 * - `loginFlint()` — obtains fresh access + refresh tokens at startup.
 * - `refreshFlintToken()` — renews the access token using the refresh token.
 * - `getFlintToken()` — returns the cached access token, refreshing proactively
 *   when fewer than 30 s remain before expiry.
 * - A proactive 12-minute interval keeps tokens warm so mid-poll 401s are rare.
 *
 * Credentials are read from the environment:
 *  - `FLINT_FUNCTION_URL` — base URL, e.g. `https://lopc-api.andreas-016.workers.dev`
 *  - `FLINT_AUTH_EMAIL` — account email
 *  - `FLINT_AUTH_TOKEN` — account password, **base64-encoded** (bun's .env parser collapses `$$` → `$`)
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';
import type {
  FlintOrder, FlintOrderLine, FlintProduct, FlintCategory, FlintCustomer,
  FlintShipment, FlintDashboardSummary, FlintSalesPoint, FlintAddress,
  FlintInventoryRow, FlintCustomerReport, FlintDataHealth,
  FlintWebhookEvent, FlintSessionStatus,
} from '../../src/data/flint.ts';
import {
  upsertCache,
  getCache,
  purgeExpired,
  getDbSizeBytes,
  replaceProjectedOrders,
  getProjectedOrders,
  getProjectedOrderById,
  upsertProjectedOrder,
  replaceProjectedCustomers,
  getProjectedCustomers,
  getProjectedCustomerById,
  replaceProjectedCustomerAddresses,
  getProjectedCustomerAddresses,
  getProjectedCustomerOrders,
  getProjectedCustomer360ByEmail,
  upsertProjectedCustomer,
  replaceProjectedProducts,
  getProductNameMap,
  getProductNameById,
  resolveOrderLineNames,
  enrichAndStoreOrder,
  replaceProjectedCategories,
  getProjectedCategories,
  getCategoryNameById,
} from '../db/flint-db.ts';
import { broadcastResource } from '../ws/flint-hub.ts';
import { getQueueStatus } from './flint-queue.ts';

// ── Module-level session state ────────────────────────────────────────────────
let _accessToken: string | null = null;
let _refreshToken: string | null = null;
let _tokenExpiry = 0;            // epoch ms when the access token expires
let _sessionEmail = '';          // stored for SSE broadcast

// ── Broadcast callback — stored during register() so dataFlintCustomers can
// re-broadcast flint-orders after enriching with fresh customer names.
let _broadcastOrders: ((data: unknown) => void) | null = null;
// Webhook ring buffer (max 50, deduped by id) — kept in-memory because events
// arrive via push (Stripe webhooks) rather than periodic fetch.
let _webhookEvents: FlintWebhookEvent[] = [];  // ring buffer, max 50

function snapshotFlintWebhookEvents(): FlintWebhookEvent[] {
  const events = [..._webhookEvents].reverse();
  upsertCache('flint-webhooks', events, 24 * 60 * 60_000);
  return events;
}

// Sales date window — mutable, updated by POST /api/flint/sales-range
let _salesFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
let _salesTo   = new Date().toISOString().slice(0, 10);

// ── Env accessors (deferred so tests can override process.env) ────────────────
function flintUrl():   string { return (process.env['FLINT_FUNCTION_URL'] ?? '').replace(/\/$/, ''); }
function flintEmail(): string { return process.env['FLINT_AUTH_EMAIL'] ?? ''; }
function flintPass():  string {
  const raw = process.env['FLINT_AUTH_TOKEN'] ?? '';
  // Stored base64-encoded so bun's .env parser can't mangle special chars (e.g. $$)
  try { return Buffer.from(raw, 'base64').toString('utf8'); } catch { return raw; }
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

/** POST /auth/login with email + password → stores access/refresh tokens. */
export async function loginFlint(): Promise<void> {
  const base  = flintUrl();
  const email = flintEmail();
  const pass  = flintPass();
  if (!base || !email || !pass) return;
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass }),
  });
  if (!r.ok) {
    const body = await r.text();
    const preview = body.slice(0, 120).replace(/\s+/g, ' ').trim();
    console.error(`[flint] login failed: ${r.status} ${preview}${body.length > 120 ? '…' : ''}`);
    return;
  }
  type LoginPayload = { accessToken?: string; refreshToken?: string; token?: string; user?: { email?: string }; };
  type LoginEnvelope = { data?: LoginPayload } & LoginPayload;
  const env = await r.json() as LoginEnvelope;
  // LOPC wraps tokens in { data: { accessToken, ... } }; fall back to flat shape for future-proofing
  const payload: LoginPayload = (env as LoginEnvelope).data ?? env;
  _accessToken  = payload.accessToken ?? payload.token ?? null;
  _refreshToken = payload.refreshToken ?? null;
  _tokenExpiry  = Date.now() + 14 * 60 * 1000;   // 14 min safety (TTL is 15 min)
  _sessionEmail = payload.user?.email ?? email;
  console.log('[flint] authenticated as', _sessionEmail);
}

/** POST /auth/refresh → renews access token; falls back to full login on failure. */
export async function refreshFlintToken(): Promise<void> {
  const base = flintUrl();
  if (!base) return;
  if (_refreshToken) {
    try {
      const r = await fetch(`${base}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: _refreshToken }),
      });
      if (r.ok) {
        type RefreshPayload = { accessToken?: string; refreshToken?: string; token?: string; };
        type RefreshEnvelope = { data?: RefreshPayload } & RefreshPayload;
        const env = await r.json() as RefreshEnvelope;
        const payload: RefreshPayload = env.data ?? env;
        _accessToken  = payload.accessToken ?? payload.token ?? null;
        if (payload.refreshToken) _refreshToken = payload.refreshToken;
        _tokenExpiry  = Date.now() + 14 * 60 * 1000;
        return;
      }
    } catch { /* fall through to re-login */ }
  }
  await loginFlint();
}

// Single-flight guard: if multiple pollers call getFlintToken() concurrently
// (e.g. at startup), only ONE HTTP auth request goes to the LOPC Worker.
// This prevents "Worker exceeded resource limits" (503) on the free CF tier.
let _refreshInFlight: Promise<void> | null = null;

/**
 * Returns the current access token, proactively refreshing when < 30 s remain.
 * Throws if no credentials are configured.
 */
export async function getFlintToken(): Promise<string> {
  if (_accessToken && Date.now() < _tokenExpiry - 30_000) return _accessToken;
  // Dedup concurrent refresh calls — only one HTTP round-trip at a time.
  if (!_refreshInFlight) {
    _refreshInFlight = refreshFlintToken().finally(() => { _refreshInFlight = null; });
  }
  await _refreshInFlight;
  if (!_accessToken) {
    throw new Error('FLINT authentication failed — check FLINT_AUTH_EMAIL / FLINT_AUTH_TOKEN');
  }
  return _accessToken;
}

/** Returns standard headers for authenticated FLINT API requests. */
async function flintHeaders(): Promise<Record<string, string>> {
  return {
    Authorization: `Bearer ${await getFlintToken()}`,
    'Content-Type': 'application/json',
  };
}

// ── Concurrency limiter ───────────────────────────────────────────────────────
// The LOPC Cloudflare Worker (free tier) rate-limits concurrent requests with
// a 503 / 1102 "Worker exceeded resource limits" response.  Cap outbound calls
// to MAX_CONCURRENT so we never blast it with all pollers at once.
const MAX_CONCURRENT = 2;
let _activeRequests = 0;
const _requestQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (_activeRequests < MAX_CONCURRENT) {
    _activeRequests++;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => { _requestQueue.push(resolve); });
}

function releaseSlot(): void {
  const next = _requestQueue.shift();
  if (next) {
    next(); // hand slot directly to the next waiter
  } else {
    _activeRequests--;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(headerValue: string | null, fallbackMs: number): number {
  if (!headerValue) return fallbackMs;
  const asSeconds = Number(headerValue);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.max(0, Math.floor(asSeconds * 1000));
  }
  const asDate = Date.parse(headerValue);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }
  return fallbackMs;
}

/** Authenticated fetch with auto-retry on 401. */
export async function flintFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = flintUrl();
  await acquireSlot();
  try {
    let lastRes: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const hdrs = await flintHeaders();
      const merged = { ...hdrs, ...(options.headers as Record<string, string> | undefined ?? {}) };
      const res = await fetch(`${base}${path}`, { ...options, headers: merged });
      lastRes = res;

      if (res.status === 401) {
        // Token expired mid-flight — refresh and retry once.
        await refreshFlintToken();
        continue;
      }

      if (res.status === 429 && attempt < 3) {
        const baseDelay = [400, 1200, 2600][attempt] ?? 2600;
        const waitMs = retryAfterMs(res.headers.get('retry-after'), baseDelay);
        await sleep(waitMs);
        continue;
      }

      return res;
    }
    return lastRes ?? new Response('FLINT fetch failed', { status: 520 });
  } finally {
    releaseSlot();
  }
}

// ── Field normalizers ─────────────────────────────────────────────────────────
// LOPC may return snake_case or differently-named fields. These normalizers
// coerce raw API objects into our TypeScript types regardless of field naming.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOrderLine(l: any): FlintOrderLine {
  const qty = Number(
    l.quantity
    ?? l.qty
    ?? l.count
    ?? l.qty_ordered
    ?? 0,
  );
  const unit = Number(
    l.unitPrice
    ?? l.unit_price
    ?? l.price
    ?? l.unit_amount
    ?? l.amount
    ?? 0,
  );
  const total = Number(
    l.totalPrice
    ?? l.total_price
    ?? l.lineTotal
    ?? l.line_total
    ?? l.subtotal
    ?? ((qty * unit) || 0),
  );
  const productId = String(
    l.productId
    ?? l.product_id
    ?? l.productID
    ?? l.productIdSnapshot
    ?? l.product_id_snapshot
    ?? (typeof l.product === 'string' ? l.product : l.product?.id)
    ?? '',
  );
  const rawProductName = l.productName
    ?? l.product_name
    ?? l.product_title
    ?? l.productTitle
    ?? l.product?.name
    ?? l.product?.title
    ?? l.name;
  const fallbackProductName = productId ? productId : '—';
  return {
    id:          l.id ?? l.lineId ?? l.line_id ?? '',
    productId,
    variantId:   l.variantId   ?? l.variant_id,
    productName: rawProductName ?? fallbackProductName,
    variantName: l.variantName ?? l.variant_name,
    quantity:    qty,
    unitPrice:   unit,
    totalPrice:  total,
    currency:    l.currency ?? l.currencyCode ?? l.currency_code ?? l.product?.currency ?? 'USD',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeOrder(o: any): FlintOrder {
  const rawLines: unknown[] = o.lines ?? o.items ?? o.order_lines ?? o.lineItems ?? o.line_items ?? [];
  const orderCurrency = o.currency ?? 'USD';
  return {
    id:              o.id,
    orderNumber:     o.orderNumber ?? o.order_number ?? o.number ?? o.id,
    customerId:      o.customerId   ?? o.customer_id  ?? o.customer?.id ?? '',
    customerName:    o.customerName ?? o.customer_name ?? o.customer?.name ?? '—',
    customerEmail:   o.customerEmail ?? o.customer_email ?? o.customer?.email ?? '—',
    status:          o.status ?? 'pending',
    paymentIntentId: o.paymentIntentId ?? o.payment_intent_id ?? o.stripe_payment_intent_id,
    stripeSessionId: o.stripeSessionId ?? o.stripe_session_id,
    totalAmount:     o.totalAmount ?? o.total_amount ?? o.total ?? o.amount ?? 0,
    lineCount:       o.lineCount ?? o.line_count,
    currency:        orderCurrency,
    lines:           rawLines.map((l: any) => normalizeOrderLine({ ...l, currency: (l as any).currency ?? orderCurrency })),
    shippingAddress: o.shippingAddress ?? o.shipping_address,
    notes:           o.notes,
    createdAt:       o.createdAt ?? o.created_at ?? new Date().toISOString(),
    updatedAt:       o.updatedAt ?? o.updated_at ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeProduct(p: any): FlintProduct {
  return {
    id:             p.id,
    name:           p.name ?? '—',
    description:    p.description,
    status:         p.status ?? 'draft',
    categoryId:     p.categoryId   ?? p.category_id,
    categoryName:   p.categoryName ?? p.category_name ?? p.category?.name,
    price:          p.price ?? 0,
    compareAtPrice: p.compareAtPrice ?? p.compare_at_price,
    stock:          p.stock ?? p.inventory ?? p.quantity ?? 0,
    sku:            p.sku,
    images:         p.images,
    variants:       p.variants,
    createdAt:      p.createdAt ?? p.created_at ?? new Date().toISOString(),
    updatedAt:      p.updatedAt ?? p.updated_at ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCategory(c: any): FlintCategory {
  return {
    id:           c.id,
    name:         c.name ?? '—',
    slug:         c.slug ?? '',
    parentId:     c.parentId ?? c.parent_id,
    sortOrder:    c.sortOrder ?? c.sort_order ?? 0,
    productCount: c.productCount ?? c.product_count,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeCustomer(c: any): FlintCustomer {
  // LOPC returns firstName + lastName, not a combined name field.
  const firstName = c.firstName ?? c.first_name ?? '';
  const lastName  = c.lastName  ?? c.last_name  ?? '';
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  return {
    id:                c.id,
    name:              c.name ?? (fullName || '—'),
    email:             c.email ?? '—',
    phone:             c.phone,
    stripeCustomerId:  c.stripeCustomerId  ?? c.stripe_customer_id,
    totalOrders:       c.totalOrders  ?? c.total_orders  ?? c.ordersCount ?? c.orders_count ?? 0,
    totalSpent:        c.totalSpent   ?? c.total_spent   ?? c.spent ?? 0,
    currency:          c.currency ?? 'USD',
    createdAt:         c.createdAt ?? c.created_at ?? new Date().toISOString(),
    updatedAt:         c.updatedAt ?? c.updated_at ?? new Date().toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function normalizeAddress(a: any): FlintAddress {
  return {
    id: a.id,
    customerId: a.customerId ?? a.customer_id,
    name: a.name,
    line1: a.line1 ?? a.line_1 ?? '',
    line2: a.line2 ?? a.line_2,
    city: a.city ?? '',
    state: a.state,
    postalCode: a.postalCode ?? a.postal_code ?? '',
    country: a.country ?? '',
    isDefault: Boolean(a.isDefault ?? a.is_default ?? false),
  };
}

// ── SSE data functions ────────────────────────────────────────────────────────

export async function dataFlintSession(): Promise<FlintSessionStatus> {
  try {
    await getFlintToken();
    const session: FlintSessionStatus = {
      authenticated: !!_accessToken,
      email: _sessionEmail,
      expiresAt: _tokenExpiry,
    };
    upsertCache('flint-session', session, 15 * 60_000);
    return session;
  } catch {
    const session: FlintSessionStatus = { authenticated: false };
    upsertCache('flint-session', session, 15 * 60_000);
    return session;
  }
}

/** Join orders with customers by customerId (LOPC does not embed customer data in orders). */
export function enrichOrdersWithCustomers(orders: FlintOrder[], customers: FlintCustomer[]): FlintOrder[] {
  if (customers.length === 0) return orders;
  const byId = new Map(customers.map(c => [c.id, c]));
  return orders.map(o => {
    const c = byId.get(o.customerId);
    if (!c) return o;
    return { ...o, customerName: c.name, customerEmail: c.email };
  });
}

export async function dataFlintOrders(): Promise<FlintOrder[]> {
  try {
    const r = await flintFetch('/orders?page=1&pageSize=100');
    if (!r.ok) throw new Error(`${r.status}`);
    const json = await r.json() as { data?: FlintOrder[]; orders?: FlintOrder[] } | FlintOrder[];
    const raw = Array.isArray(json) ? json
      : (json as { data?: FlintOrder[] }).data
        ?? (json as { orders?: FlintOrder[] }).orders ?? [];
    const cachedOrders = getCache<FlintOrder[]>('flint-orders');
    if ((!cachedOrders || cachedOrders.length === 0) && raw.length > 0) {
      console.log('[flint] raw order sample keys:', Object.keys(raw[0] as object));
    }
    const orders = raw.map(normalizeOrder);

    // Enrich with customer data from relational cache (no upstream call)
    const cachedCustomers = getCache<FlintCustomer[]>('flint-customers');
    const customers = cachedCustomers && cachedCustomers.length > 0 ? cachedCustomers : await dataFlintCustomers();
    const withCustomers = enrichOrdersWithCustomers(orders, customers);

    // Merge with previously cached detail (lines, addresses, notes)
    const projectedById = new Map(getProjectedOrders().map((o) => [o.id, o]));
    const merged = withCustomers.map((order) => {
      const prev = projectedById.get(order.id);
      if (!prev) return order;
      return {
        ...order,
        lines: order.lines.length > 0 ? order.lines : prev.lines,
        shippingAddress: order.shippingAddress ?? prev.shippingAddress,
        notes: order.notes ?? prev.notes,
        customerName: order.customerName !== '\u2014' ? order.customerName : prev.customerName,
        customerEmail: order.customerEmail !== '\u2014' ? order.customerEmail : prev.customerEmail,
      };
    });

    // Resolve product names on any cached lines from the relational product table
    const productNameMap = getProductNameMap();
    const enriched = merged.map((order) => ({
      ...order,
      lines: resolveOrderLineNames(order.lines, productNameMap),
    }));

    // Persist to relational projection + blob cache
    replaceProjectedOrders(enriched);
    upsertCache('flint-orders', enriched, 60_000);

    // Batch-fetch detail for orders with lineCount > 0 but no cached lines.
    // This is done AFTER the main broadcast so tiles get data fast, then
    // a follow-up broadcast sends enriched lines.
    const missingLineIds = enriched
      .filter((order) => (order.lineCount ?? 0) > 0 && order.lines.length === 0)
      .slice(0, 8)
      .map((order) => order.id);

    if (missingLineIds.length > 0) {
      console.log(`[flint-cache] hydrating ${missingLineIds.length} order details for missing lines`);
      const byId = new Map(enriched.map((o) => [o.id, o]));
      let hydrated = false;
      for (const orderId of missingLineIds) {
        try {
          const res = await flintFetch(`/orders/${orderId}`);
          if (!res.ok) continue;
          const detailRaw = await res.json() as Record<string, unknown>;
          const body = (detailRaw as { data?: unknown }).data ?? detailRaw;
          const detail = normalizeOrder(body);
          if (detail.lines.length === 0) continue;
          // Resolve product names from local cache
          const resolvedLines = resolveOrderLineNames(detail.lines, productNameMap);
          const prev = byId.get(orderId);
          byId.set(orderId, {
            ...detail,
            lines: resolvedLines,
            customerName: detail.customerName !== '\u2014' ? detail.customerName : (prev?.customerName ?? detail.customerName),
            customerEmail: detail.customerEmail !== '\u2014' ? detail.customerEmail : (prev?.customerEmail ?? detail.customerEmail),
            shippingAddress: detail.shippingAddress ?? prev?.shippingAddress,
          });
          hydrated = true;
        } catch (err) {
          console.warn(`[flint] hydration failed for order ${orderId}:`, err);
        }
      }
      if (hydrated) {
        const hydratedOrders = enriched.map((order) => byId.get(order.id) ?? order);
        replaceProjectedOrders(hydratedOrders);
        upsertCache('flint-orders', hydratedOrders, 60_000);
        _broadcastOrders?.(hydratedOrders);
        return hydratedOrders;
      }
    }

    return enriched;
  } catch (e) {
    console.error('[flint] orders fetch error:', e);
    const projected = getProjectedOrders();
    if (projected.length > 0) return projected;
    return getCache<FlintOrder[]>('flint-orders') ?? [];
  }
}

export async function dataFlintProducts(): Promise<FlintProduct[]> {
  try {
    const statuses = ['active', 'draft', 'archived'] as const;
    type ProductEnvelope = { data?: FlintProduct[]; meta?: { page?: number; pageSize?: number; total?: number } };
    const fetchStatus = async (status: (typeof statuses)[number]): Promise<FlintProduct[]> => {
      const pageSize = 200;
      let page = 1;
      let totalPages = 1;
      const out: FlintProduct[] = [];

      while (page <= totalPages) {
        const r = await flintFetch(`/products?status=${status}&page=${page}&pageSize=${pageSize}`);
        if (!r.ok) {
          if (status !== 'active' && (r.status === 401 || r.status === 403)) {
            console.warn(
              `[flint] products status=${status} denied (${r.status}). `
              + 'FLINT auth user may be non-admin, so non-active products cannot be cached.',
            );
          } else {
            console.warn(`[flint] products status=${status} page=${page} failed (${r.status})`);
          }
          break;
        }

        const json = await r.json() as ProductEnvelope | FlintProduct[];
        const env = Array.isArray(json) ? { data: json, meta: undefined } : json as ProductEnvelope;
        const pageRows = env.data ?? [];
        out.push(...pageRows);

        const total = Number(env.meta?.total ?? pageRows.length);
        totalPages = Math.max(1, Math.ceil(total / pageSize));
        page += 1;
      }

      return out;
    };

    const statusRows = await Promise.all(statuses.map((status) => fetchStatus(status)));
    const raw = statusRows.flat();
    const cachedProducts = getCache<FlintProduct[]>('flint-products');
    if ((!cachedProducts || cachedProducts.length === 0) && raw.length > 0) {
      console.log('[flint] raw product sample keys:', Object.keys(raw[0] as object));
    }
    if (raw.length > 0) {
      const rawByStatus = raw.reduce<Record<string, number>>((acc, p) => {
        const key = String(p.status ?? 'unknown');
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {});
      console.log('[flint] products raw distribution by status:', rawByStatus);
    }
    // Deduplicate by id (in case API responses overlap across status filters)
    const seen = new Set<string>();
    const deduped = raw.filter((p) => {
      const duplicate = seen.has(p.id);
      seen.add(p.id);
      return !duplicate;
    });
    const products = deduped.map(normalizeProduct);
    // Log status distribution to detect silent API-side filtering.
    const byStatus = products.reduce<Record<string, number>>((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {});
    console.log(`[flint] products fetched: ${products.length} total —`, byStatus);
    // Write into relational projection table (enables local name resolution)
    replaceProjectedProducts(products);
    console.log(`[flint-cache] products projection: ${products.length} rows written`);
    upsertCache('flint-products', products, 240_000);
    return products;
  } catch (e) {
    console.error('[flint] products fetch error:', e);
    return getCache<FlintProduct[]>('flint-products') ?? [];
  }
}

export async function dataFlintCategories(): Promise<FlintCategory[]> {
  try {
    const r = await flintFetch('/categories');
    if (!r.ok) throw new Error(`${r.status}`);
    const json = await r.json() as { data?: FlintCategory[] } | FlintCategory[];
    const raw = Array.isArray(json) ? json : (json as { data?: FlintCategory[] }).data ?? [];
    const categories = (raw as Record<string, unknown>[]).map(normalizeCategory);
    // Write into relational projection table
    replaceProjectedCategories(categories);
    console.log(`[flint-cache] categories projection: ${categories.length} rows written`);
    upsertCache('flint-categories', categories, 600_000);
    return categories;
  } catch (e) {
    console.error('[flint] categories fetch error:', e);
    return getCache<FlintCategory[]>('flint-categories') ?? [];
  }
}

export async function dataFlintCustomers(): Promise<FlintCustomer[]> {
  try {
    const r = await flintFetch('/customers?page=1&pageSize=200');
    if (!r.ok) throw new Error(`${r.status}`);
    const json = await r.json() as { data?: FlintCustomer[] } | FlintCustomer[];
    const raw = Array.isArray(json) ? json : (json as { data?: FlintCustomer[] }).data ?? [];
    const cachedCustomers = getCache<FlintCustomer[]>('flint-customers');
    if ((!cachedCustomers || cachedCustomers.length === 0) && raw.length > 0) {
      console.log('[flint] raw customer sample keys:', Object.keys(raw[0] as object));
    }
    const customers = raw.map(normalizeCustomer);
    replaceProjectedCustomers(customers);
    upsertCache('flint-customers', customers, 240_000);
    // Re-enrich cached orders with the now-available customer names and product names,
    // then re-broadcast so tiles update without waiting for the next poll.
    const cachedOrders = getCache<FlintOrder[]>('flint-orders');
    if (cachedOrders && cachedOrders.length > 0) {
      const enriched = enrichOrdersWithCustomers(cachedOrders, customers);
      // Also resolve product names from the relational cache
      const productNameMap = getProductNameMap();
      const withNames = enriched.map((order) => ({
        ...order,
        lines: resolveOrderLineNames(order.lines, productNameMap),
      }));
      replaceProjectedOrders(withNames);
      upsertCache('flint-orders', withNames, 60_000);
      _broadcastOrders?.(withNames);
    }
    return customers;
  } catch (e) {
    console.error('[flint] customers fetch error:', e);
    const projected = getProjectedCustomers();
    if (projected.length > 0) return projected;
    return getCache<FlintCustomer[]>('flint-customers') ?? [];
  }
}

/** Threshold below which a product (or any of its variants) is considered low-stock. */
const LOW_STOCK_THRESHOLD = 5;

export async function dataFlintDashboard(): Promise<FlintDashboardSummary> {
  try {
    // Use Drizzle cache to avoid redundant LOPC API calls
    const cachedO = getCache<FlintOrder[]>('flint-orders');
    const cachedP = getCache<FlintProduct[]>('flint-products');
    const cachedC = getCache<FlintCustomer[]>('flint-customers');
    const [orders, products, customers] = await Promise.all([
      cachedO && cachedO.length > 0 ? Promise.resolve(cachedO) : dataFlintOrders(),
      cachedP && cachedP.length > 0 ? Promise.resolve(cachedP) : dataFlintProducts(),
      cachedC && cachedC.length > 0 ? Promise.resolve(cachedC) : dataFlintCustomers(),
    ]);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    const todayOrders = orders.filter(o => o.createdAt.startsWith(today));
    const ordersToday   = todayOrders.length;
    const revenueToday  = todayOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
    const currency      = orders[0]?.currency ?? 'USD';
    const pendingOrders    = orders.filter(o => o.status === 'pending').length;
    const processingOrders = orders.filter(o => o.status === 'processing').length;

    const newCustomersToday = customers.filter(c => c.createdAt?.startsWith(today)).length;

    const lowStockCount = products.filter(p =>
      (p.variants?.length ?? 0) > 0
        ? p.variants!.some((v: { stock: number }) => v.stock <= LOW_STOCK_THRESHOLD)
        : (p.stock ?? 0) <= LOW_STOCK_THRESHOLD,
    ).length;

    const summary: FlintDashboardSummary = {
      ordersToday, revenueToday, currency,
      newCustomersToday, lowStockCount, pendingOrders, processingOrders,
    };
    upsertCache('flint-dashboard', summary, 120_000);
    return summary;
  } catch (e) {
    console.error('[flint] dashboard aggregate error:', e);
    return getCache<FlintDashboardSummary>('flint-dashboard') ?? {
      ordersToday: 0, revenueToday: 0, currency: 'USD',
      newCustomersToday: 0, lowStockCount: 0, pendingOrders: 0, processingOrders: 0,
    };
  }
}

export async function dataFlintInventory(): Promise<FlintInventoryRow[]> {
  try {
    // Use Drizzle cache to avoid a redundant LOPC fetch
    const cachedP = getCache<FlintProduct[]>('flint-products');
    const products = cachedP && cachedP.length > 0 ? cachedP : await dataFlintProducts();
    const rows: FlintInventoryRow[] = [];
    for (const p of products) {
      if ((p.variants?.length ?? 0) > 0) {
        for (const v of p.variants!) {
          rows.push({
            productId: p.id,
            variantId: v.id,
            productName: p.name,
            variantName: v.name,
            sku: v.sku ?? p.sku,
            stock: v.stock,
            price: v.price,
            currency: 'USD',
            status: p.status,
            isLowStock: v.stock <= 5,
          });
        }
      } else {
        rows.push({
          productId: p.id,
          productName: p.name,
          sku: p.sku,
          stock: p.stock,
          price: p.price,
          currency: 'USD',
          status: p.status,
          isLowStock: p.stock <= 5,
        });
      }
    }
    upsertCache('flint-inventory', rows, 120_000);
    return rows;
  } catch (e) {
    console.error('[flint] inventory error:', e);
    return getCache<FlintInventoryRow[]>('flint-inventory') ?? [];
  }
}

export async function dataFlintSales(): Promise<FlintSalesPoint[]> {
  try {
    // No /orders/sales-summary endpoint — aggregate from orders
    // Use Drizzle cache to avoid a redundant LOPC fetch
    const cachedO = getCache<FlintOrder[]>('flint-orders');
    const orders = cachedO && cachedO.length > 0 ? cachedO : await dataFlintOrders();
    const from = new Date(_salesFrom).getTime();
    const to   = new Date(_salesTo + 'T23:59:59Z').getTime();
    const byDate = new Map<string, { revenue: number; orderCount: number; currency: string }>();
    for (const o of orders) {
      const ts = new Date(o.createdAt).getTime();
      if (ts < from || ts > to) continue;
      const date = o.createdAt.slice(0, 10);
      const bucket = byDate.get(date) ?? { revenue: 0, orderCount: 0, currency: o.currency ?? 'USD' };
      bucket.revenue += o.totalAmount ?? 0;
      bucket.orderCount += 1;
      byDate.set(date, bucket);
    }
    const points: FlintSalesPoint[] = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, b]) => ({ date, revenue: b.revenue, orderCount: b.orderCount, currency: b.currency }));
    upsertCache('flint-sales', points, 600_000);
    return points;
  } catch (e) {
    console.error('[flint] sales aggregate error:', e);
    return getCache<FlintSalesPoint[]>('flint-sales') ?? [];
  }
}

export async function dataFlintCustomerReport(): Promise<FlintCustomerReport> {
  try {
    // No /customers/report endpoint — aggregate from customers list
    // Use Drizzle cache to avoid a redundant LOPC fetch
    const cachedC = getCache<FlintCustomer[]>('flint-customers');
    const customers = cachedC && cachedC.length > 0 ? cachedC : await dataFlintCustomers();
    const now = new Date();
    const thisMonth       = now.toISOString().slice(0, 7); // YYYY-MM
    const thirtyDaysAgo  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const totalActive    = customers.filter(c => (c.totalOrders ?? 0) > 0).length;
    const totalInactive  = customers.filter(c => (c.totalOrders ?? 0) === 0).length;
    const newThisMonth   = customers.filter(c => c.createdAt.startsWith(thisMonth)).length;
    const byDate = new Map<string, number>();
    for (const c of customers) {
      const date = c.createdAt.slice(0, 10);
      if (date < thirtyDaysAgo) continue;
      byDate.set(date, (byDate.get(date) ?? 0) + 1);
    }
    const newPerDay = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    const report: FlintCustomerReport = { totalActive, totalInactive, newThisMonth, newPerDay };
    upsertCache('flint-customer-report', report, 600_000);
    return report;
  } catch (e) {
    console.error('[flint] customer-report aggregate error:', e);
    return getCache<FlintCustomerReport>('flint-customer-report') ?? { totalActive: 0, totalInactive: 0, newThisMonth: 0, newPerDay: [] };
  }
}

export async function dataFlintShipments(): Promise<FlintShipment[]> {
  try {
    const r = await flintFetch('/logistics/shipments?page=1&pageSize=100');
    if (!r.ok) throw new Error(`${r.status}`);
    const json = await r.json() as { data?: FlintShipment[] } | FlintShipment[];
    const shipments = Array.isArray(json) ? json : (json as { data?: FlintShipment[] }).data ?? [];
    upsertCache('flint-shipments', shipments, 120_000);
    return shipments;
  } catch (e) {
    console.error('[flint] shipments fetch error:', e);
    return getCache<FlintShipment[]>('flint-shipments') ?? [];
  }
}

export async function dataFlintDataHealth(): Promise<FlintDataHealth> {
  try {
    const r = await flintFetch('/admin/data-health');
    if (!r.ok) throw new Error(`${r.status}`);
    const json = await r.json() as FlintDataHealth | { data?: FlintDataHealth };
    const health = (json as { data?: FlintDataHealth }).data ?? json as FlintDataHealth;
    upsertCache('flint-data-health', health, 600_000);
    return health;
  } catch (e) {
    console.error('[flint] data-health fetch error:', e);
    return getCache<FlintDataHealth>('flint-data-health') ?? {
      tableCounts: {}, orphanedOrderLines: 0, duplicateAddresses: 0,
      stuckWebhooks: 0, unlinkedStripePayments: 0, lastCheckedAt: new Date().toISOString(),
    };
  }
}

/**
 * Push a Stripe webhook event into the local ring buffer (max 50, deduped by id).
 * Called by the server's Stripe webhook route handler.
 */
export function addFlintWebhookEvent(ev: FlintWebhookEvent): void {
  if (_webhookEvents.some(e => e.id === ev.id)) return;
  _webhookEvents.push(ev);
  _webhookEvents = _webhookEvents.slice(-50);
  snapshotFlintWebhookEvents();
}

export async function dataFlintWebhooks(): Promise<FlintWebhookEvent[]> {
  // LOPC has no list endpoint for webhook events — return the local ring buffer.
  // Events are added via addFlintWebhookEvent() when Stripe webhooks arrive at
  // the TWM server's own POST /api/stripe/webhook endpoint.
  return snapshotFlintWebhookEvents();
}

// ── register ──────────────────────────────────────────────────────────────────

/** Register all FLINT pollers and route handlers with the server context. */
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (flintUrl() && flintEmail() && flintPass()) {
    // ── DB size audit + periodic purge ────────────────────────────────────
    const sizeKB = (getDbSizeBytes() / 1024).toFixed(1);
    const purged = purgeExpired();
    console.log(`[flint] cache DB: ${sizeKB} KB, purged ${purged} expired entries`);
    // Purge expired cache entries every 10 minutes to keep DB compact
    setInterval(() => {
      const n = purgeExpired();
      if (n > 0) console.log(`[flint] purged ${n} expired cache entries`);
    }, 10 * 60_000);

    // ── WS broadcaster + cache-warm scheduler ─────────────────────────────
    // Uses direct broadcastResource() (WS) and periodic backend refreshes.
    // Data functions upsertCache() into SQLite and each run broadcasts the
    // latest snapshot to subscribed WS clients.
    const registerFlintResource = (
      event: string,
      fn: () => Promise<unknown>,
      options: { initialDelayMs?: number; pollMs?: number } = {},
    ): void => {
      const initialDelayMs = options.initialDelayMs ?? 0;
      const pollMs = options.pollMs ?? 0;
      let inFlight: Promise<void> | null = null;
      const run = async (): Promise<void> => {
        if (inFlight) return inFlight;
        inFlight = (async () => {
        try {
          const data = await fn();
          broadcastResource(event, data);
          ctx.broadcastSse(event, data);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[flint-refresh] error ${event}: ${msg}`);
        } finally {
          inFlight = null;
        }
        })();
        return inFlight;
      };
      // Initial warm fetch (optionally delayed for aggregation resources)
      if (initialDelayMs > 0) {
        setTimeout(() => { void run(); }, initialDelayMs);
      } else {
        void run();
      }
      if (pollMs > 0) {
        setInterval(() => { void run(); }, pollMs);
      }
      // Register in refreshRegistry for POST /api/refresh/:event and
      // post-command data refresh in the WS hub lifecycle hooks.
      ctx.refreshRegistry.set(event, run);
    };

    // Store broadcast callback so dataFlintCustomers can re-broadcast orders
    // immediately after enriching them with customer names (via WS).
    _broadcastOrders = (data) => broadcastResource('flint-orders', data);

    // Seed session cache so WS subscribers receive an immediate auth snapshot
    // on first subscribe (before the first poll cycle completes).
    upsertCache('flint-session', { authenticated: false } satisfies FlintSessionStatus, 15 * 60_000);

    // Session resource heartbeat + refresh endpoint.
    registerFlintResource('flint-session', dataFlintSession, { pollMs: 12 * 60_000 });

    // Primary resources — periodic backend cache warm (Cloudflare -> SQLite)
    // and websocket broadcast updates to clients.
    const readPollMs = (key: string, fallbackMs: number): number => {
      const raw = process.env[key];
      if (!raw || raw.trim() === '') return fallbackMs;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallbackMs;
    };
    const ordersPollMs = readPollMs('FLINT_POLL_ORDERS_MS', 30_000);
    const productsPollMs = readPollMs('FLINT_POLL_PRODUCTS_MS', 120_000);
    const categoriesPollMs = readPollMs('FLINT_POLL_CATEGORIES_MS', 300_000);
    const customersPollMs = readPollMs('FLINT_POLL_CUSTOMERS_MS', 120_000);
    const shipmentsPollMs = readPollMs('FLINT_POLL_SHIPMENTS_MS', 60_000);
    const healthPollMs = readPollMs('FLINT_POLL_HEALTH_MS', 300_000);
    const webhooksPollMs = readPollMs('FLINT_POLL_WEBHOOKS_MS', 30_000);
    registerFlintResource('flint-products',    dataFlintProducts,    { initialDelayMs: 0,     pollMs: productsPollMs });
    registerFlintResource('flint-categories',  dataFlintCategories,  { initialDelayMs: 2_000, pollMs: categoriesPollMs });
    registerFlintResource('flint-orders',      dataFlintOrders,      { initialDelayMs: 4_000, pollMs: ordersPollMs });
    registerFlintResource('flint-customers',   dataFlintCustomers,   { initialDelayMs: 6_000, pollMs: customersPollMs });
    registerFlintResource('flint-shipments',   dataFlintShipments,   { initialDelayMs: 8_000, pollMs: shipmentsPollMs });
    registerFlintResource('flint-data-health', dataFlintDataHealth,  { initialDelayMs: 10_000, pollMs: healthPollMs });
    registerFlintResource('flint-webhooks',    dataFlintWebhooks,    { initialDelayMs: 0, pollMs: webhooksPollMs });

    // Aggregation pollers — depend on primary caches; delay first run so that
    // primary pollers have time to complete and populate the Drizzle cache.
    // Without the delay, all pollers fire at startup simultaneously and hit
    // the Cloudflare Worker concurrently, causing 503 resource-limit errors.
    const AGGREGATE_DELAY = 15_000; // 15s — enough for primary pollers to warm up
    const dashboardPollMs = readPollMs('FLINT_POLL_DASHBOARD_MS', 60_000);
    const inventoryPollMs = readPollMs('FLINT_POLL_INVENTORY_MS', 60_000);
    const salesPollMs = readPollMs('FLINT_POLL_SALES_MS', 300_000);
    const customerReportPollMs = readPollMs('FLINT_POLL_CUSTOMER_REPORT_MS', 300_000);
    registerFlintResource('flint-dashboard',       dataFlintDashboard,      { initialDelayMs: AGGREGATE_DELAY, pollMs: dashboardPollMs });
    registerFlintResource('flint-inventory',       dataFlintInventory,      { initialDelayMs: AGGREGATE_DELAY, pollMs: inventoryPollMs });
    registerFlintResource('flint-sales',           dataFlintSales,          { initialDelayMs: AGGREGATE_DELAY, pollMs: salesPollMs });
    registerFlintResource('flint-customer-report', dataFlintCustomerReport, { initialDelayMs: AGGREGATE_DELAY, pollMs: customerReportPollMs });

    // Hook into the stripe-webhooks refresh so FLINT's ring buffer is updated
    // immediately when a Stripe event arrives, without waiting for the 30s poll.
    const stripeWebhooksRefresh = ctx.refreshRegistry.get('stripe-webhooks');
    if (stripeWebhooksRefresh) {
      ctx.refreshRegistry.set('stripe-webhooks', async () => {
        await stripeWebhooksRefresh();
        const events = await dataFlintWebhooks();
        broadcastResource('flint-webhooks', events);
        // Also refresh orders — checkout.session.completed creates new orders.
        void ctx.refreshRegistry.get('flint-orders')?.();
      });
    }
  } else {
    console.log('[flint] skipped — FLINT_FUNCTION_URL / FLINT_AUTH_EMAIL / FLINT_AUTH_TOKEN not set');
  }

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    _url: URL,
    path: string,
    method: string,
    body: string,
  ): Promise<boolean> => {
    if (!path.startsWith('/api/flint/')) return false;

    // ── Auth routes ─────────────────────────────────────────────────────────

    if (path === '/api/flint/auth/login' && method === 'POST') {
      await ctx.route(res, async () => {
        const { email, password } = JSON.parse(body) as { email: string; password: string };
        const r = await fetch(`${flintUrl()}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!r.ok) throw new Error(`Login failed: ${r.status}`);
        type LoginPayload = { accessToken?: string; refreshToken?: string; token?: string; user?: { email?: string }; };
        type LoginEnvelope = { data?: LoginPayload } & LoginPayload;
        const env = await r.json() as LoginEnvelope;
        const payload: LoginPayload = env.data ?? env;
        _accessToken  = payload.accessToken ?? payload.token ?? null;
        _refreshToken = payload.refreshToken ?? null;
        _tokenExpiry  = Date.now() + 14 * 60 * 1000;
        _sessionEmail = payload.user?.email ?? email;
        broadcastResource('flint-session', { authenticated: true, email: _sessionEmail, expiresAt: _tokenExpiry });
        return { ok: true };
      });
      return true;
    }

    if (path === '/api/flint/auth/logout' && method === 'POST') {
      await ctx.route(res, async () => {
        _accessToken  = null;
        _refreshToken = null;
        _tokenExpiry  = 0;
        broadcastResource('flint-session', { authenticated: false });
        return { ok: true };
      });
      return true;
    }

    // ── Orders ───────────────────────────────────────────────────────────────

    const orderIdMatch  = path.match(/^\/api\/flint\/orders\/([^/]+)$/);
    const orderActMatch = path.match(/^\/api\/flint\/orders\/([^/]+)\/(status|refund)$/);

    if (orderActMatch && method === 'PUT' && orderActMatch[2] === 'status') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/orders/${orderActMatch[1]}/status`, { method: 'PUT', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-orders')?.();
        return result;
      });
      return true;
    }

    if (orderActMatch && method === 'POST' && orderActMatch[2] === 'refund') {
      await ctx.route(res, async () => {
        const orderId = orderActMatch[1];
        const orderRes = await flintFetch(`/orders/${orderId}`);
        if (!orderRes.ok) throw new Error(`FLINT ${orderRes.status}: ${await orderRes.text()}`);
        const orderJson = await orderRes.json() as FlintOrder | { data?: FlintOrder };
        const order = (orderJson as { data?: FlintOrder }).data ?? orderJson as FlintOrder;

        if (order.status !== 'confirmed' && order.status !== 'processing' && order.status !== 'delivered') {
          throw new Error(`FLINT 422: {"code":"UNPROCESSABLE","message":"Order status must be confirmed, processing, or delivered to process a refund"}`);
        }

        if (order.status === 'confirmed' || order.status === 'processing') {
          const promoteRes = await flintFetch(`/orders/${orderId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status: 'delivered' }),
          });
          if (!promoteRes.ok) throw new Error(`FLINT ${promoteRes.status}: ${await promoteRes.text()}`);
        }

        const r = await flintFetch(`/orders/${orderId}/refund`, { method: 'POST', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-orders')?.();
        return result;
      });
      return true;
    }

    if (orderIdMatch && method === 'GET') {
      await ctx.route(res, async () => {
        const orderId = orderIdMatch[1];
        const bypassCacheHeader = req.headers['x-flint-bypass-cache'];
        const forceFresh = (Array.isArray(bypassCacheHeader) ? bypassCacheHeader[0] : bypassCacheHeader) === '1';

        // ── 1. Check relational projection (instant, zero upstream calls) ────
        const projected = getProjectedOrderById(orderId);
        const hasLines = projected && projected.lines.length > 0;
        const linesResolved = hasLines && projected.lines.every(
          (l) => l.productName && l.productName !== '\u2014' && l.productName !== l.productId,
        );

        if (!forceFresh && projected && hasLines && linesResolved) {
          console.log(`[flint-cache] order detail HIT (projection): ${orderId}`);
          return projected;
        }

        // ── 2. Try blob cache (per-order detail key) ─────────────────────────
        const orderDetailKey = `flint-order:${orderId}`;
        const cachedDetail = getCache<FlintOrder>(orderDetailKey);
        if (!forceFresh && cachedDetail && cachedDetail.lines.length > 0) {
          // Resolve names from relational cache before returning
          const enriched = enrichAndStoreOrder(cachedDetail);
          console.log(`[flint-cache] order detail HIT (blob): ${orderId}`);
          return enriched;
        }

        // ── 3. Fetch from upstream (single call) ────────────────────────────
        let normalized: FlintOrder;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          try {
            const r = await flintFetch(`/orders/${orderId}`, { signal: controller.signal });
            if (!r.ok) throw new Error(`FLINT ${r.status}`);
            const raw = await r.json() as Record<string, unknown>;
            const body = (raw as { data?: unknown }).data ?? raw;
            normalized = normalizeOrder(body);
          } finally {
            clearTimeout(timeoutId);
          }
        } catch {
          // Return best-effort from any cache source
          if (projected) return projected;
          if (cachedDetail) return cachedDetail;
          const listOrder = (getCache<FlintOrder[]>('flint-orders') ?? []).find((o) => o.id === orderId);
          if (listOrder) return listOrder;
          throw new Error('FLINT order detail unavailable and no cached order exists');
        }

        // ── 4. Enrich from local relational caches (zero upstream calls) ────
        // Resolve product names
        const productNameMap = getProductNameMap();
        const enrichedLines = resolveOrderLineNames(normalized.lines, productNameMap);

        // Resolve customer name/email from projected order or customer cache
        const cachedCustomer = normalized.customerId
          ? getProjectedCustomerById(normalized.customerId)
          : null;
        const customerName = normalized.customerName !== '\u2014'
          ? normalized.customerName
          : (projected?.customerName ?? cachedCustomer?.name ?? '\u2014');
        const customerEmail = normalized.customerEmail !== '\u2014'
          ? normalized.customerEmail
          : (projected?.customerEmail ?? cachedCustomer?.email ?? '\u2014');

        // Resolve shipping address from projection
        const shippingAddress = normalized.shippingAddress
          ?? projected?.shippingAddress
          ?? (normalized.customerId
            ? getProjectedCustomerAddresses(normalized.customerId).find((a) => a.isDefault)
              ?? getProjectedCustomerAddresses(normalized.customerId)[0]
            : undefined);

        const enriched: FlintOrder = {
          ...normalized,
          lines: enrichedLines,
          customerName,
          customerEmail,
          shippingAddress,
        };

        // Log unresolved lines for observability
        const unresolved = enriched.lines.filter(
          (l) => !l.productName || l.productName === '\u2014' || l.productName === l.productId,
        );
        if (unresolved.length > 0) {
          console.warn(`[flint-cache] order ${orderId}: ${unresolved.length} lines with unresolved product names`,
            unresolved.map((l) => l.productId || '(missing)'));
        }

        // ── 5. Persist and broadcast ─────────────────────────────────────────
        upsertProjectedOrder(enriched);
        upsertCache(orderDetailKey, enriched, 300_000);

        // Merge into list cache
        const cachedOrders = getCache<FlintOrder[]>('flint-orders') ?? getProjectedOrders();
        const replaced = cachedOrders.map((o) => o.id === enriched.id ? {
          ...o,
          customerName: enriched.customerName !== '\u2014' ? enriched.customerName : o.customerName,
          customerEmail: enriched.customerEmail !== '\u2014' ? enriched.customerEmail : o.customerEmail,
          shippingAddress: enriched.shippingAddress ?? o.shippingAddress,
          notes: enriched.notes ?? o.notes,
          lines: enriched.lines.length > 0 ? enriched.lines : o.lines,
          status: enriched.status,
          updatedAt: enriched.updatedAt,
        } : o);
        const exists = replaced.some((o) => o.id === enriched.id);
        upsertCache('flint-orders', exists ? replaced : [enriched, ...replaced], 60_000);

        return enriched;
      });
      return true;
    }

    if (orderIdMatch && method === 'DELETE') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/orders/${orderIdMatch[1]}`, { method: 'DELETE' });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        void ctx.refreshRegistry.get('flint-orders')?.();
        return { ok: true };
      });
      return true;
    }

    // ── Products ─────────────────────────────────────────────────────────────

    const productIdMatch     = path.match(/^\/api\/flint\/products\/([^/]+)$/);
    const variantCreateMatch = path.match(/^\/api\/flint\/products\/([^/]+)\/variants$/);
    const variantUpdateMatch = path.match(/^\/api\/flint\/products\/([^/]+)\/variants\/([^/]+)$/);

    if (path === '/api/flint/products' && method === 'POST') {
      await ctx.route(res, async () => {
        const r = await flintFetch('/products', { method: 'POST', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-products')?.();
        void ctx.refreshRegistry.get('flint-inventory')?.();
        return result;
      });
      return true;
    }

    if (productIdMatch && method === 'GET') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/products/${productIdMatch[1]}`);
        if (!r.ok) throw new Error(`FLINT ${r.status}`);
        return r.json();
      });
      return true;
    }

    if (productIdMatch && method === 'PUT') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/products/${productIdMatch[1]}`, { method: 'PUT', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-products')?.();
        void ctx.refreshRegistry.get('flint-inventory')?.();
        return result;
      });
      return true;
    }

    if (productIdMatch && method === 'DELETE') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/products/${productIdMatch[1]}`, { method: 'DELETE' });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        void ctx.refreshRegistry.get('flint-products')?.();
        void ctx.refreshRegistry.get('flint-inventory')?.();
        return { ok: true };
      });
      return true;
    }

    if (variantCreateMatch && method === 'POST') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/products/${variantCreateMatch[1]}/variants`, { method: 'POST', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-products')?.();
        void ctx.refreshRegistry.get('flint-inventory')?.();
        return result;
      });
      return true;
    }

    if (variantUpdateMatch && method === 'PUT') {
      await ctx.route(res, async () => {
        const r = await flintFetch(
          `/products/${variantUpdateMatch[1]}/variants/${variantUpdateMatch[2]}`,
          { method: 'PUT', body },
        );
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-products')?.();
        void ctx.refreshRegistry.get('flint-inventory')?.();
        return result;
      });
      return true;
    }

    // ── Categories ───────────────────────────────────────────────────────────

    const categoryIdMatch = path.match(/^\/api\/flint\/categories\/([^/]+)$/);

    if (path === '/api/flint/categories' && method === 'POST') {
      await ctx.route(res, async () => {
        const r = await flintFetch('/categories', { method: 'POST', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-categories')?.();
        return result;
      });
      return true;
    }

    if (categoryIdMatch && method === 'PUT') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/categories/${categoryIdMatch[1]}`, { method: 'PUT', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-categories')?.();
        return result;
      });
      return true;
    }

    if (categoryIdMatch && method === 'DELETE') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/categories/${categoryIdMatch[1]}`, { method: 'DELETE' });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        void ctx.refreshRegistry.get('flint-categories')?.();
        return { ok: true };
      });
      return true;
    }

    // ── Customers ────────────────────────────────────────────────────────────

    const customerIdMatch  = path.match(/^\/api\/flint\/customers\/([^/]+)$/);
    const customerSubMatch = path.match(/^\/api\/flint\/customers\/([^/]+)\/(orders|addresses)$/);

    if (path === '/api/flint/customer-360' && method === 'GET') {
      await ctx.route(res, async () => {
        const email = (_url.searchParams.get('email') ?? '').trim();
        if (!email) throw new Error('email query param is required');

        const local = getProjectedCustomer360ByEmail(email);
        if (local.customer) return local;

        const rCustomer = await flintFetch(`/customers?search=${encodeURIComponent(email)}&page=1&pageSize=5`);
        if (!rCustomer.ok) throw new Error(`FLINT ${rCustomer.status}`);
        const customerRaw = await rCustomer.json() as { data?: unknown[] } | unknown[];
        const customerRows = Array.isArray(customerRaw)
          ? customerRaw
          : ((customerRaw as { data?: unknown[] }).data ?? []);
        const customer = (customerRows as Record<string, unknown>[])
          .map((row) => normalizeCustomer(row))
          .find((c) => c.email.toLowerCase() === email.toLowerCase())
          ?? (customerRows[0] ? normalizeCustomer(customerRows[0] as Record<string, unknown>) : null);

        if (!customer) return { customer: null, orders: [], addresses: [] };

        upsertProjectedCustomer(customer);

        const [ordersRes, addressesRes] = await Promise.all([
          flintFetch(`/customers/${customer.id}/orders`),
          flintFetch(`/customers/${customer.id}/addresses`),
        ]);

        let orders: FlintOrder[] = [];
        if (ordersRes.ok) {
          const ordersRaw = await ordersRes.json() as { data?: unknown[] } | unknown[];
          const orderRows = Array.isArray(ordersRaw)
            ? ordersRaw
            : ((ordersRaw as { data?: unknown[] }).data ?? []);
          orders = (orderRows as Record<string, unknown>[]).map((row) => normalizeOrder(row));
          for (const order of orders) upsertProjectedOrder(order);
        }

        let addresses: FlintAddress[] = [];
        if (addressesRes.ok) {
          const addressesRaw = await addressesRes.json() as { data?: unknown[] } | unknown[];
          const addressRows = Array.isArray(addressesRaw)
            ? addressesRaw
            : ((addressesRaw as { data?: unknown[] }).data ?? []);
          addresses = (addressRows as Record<string, unknown>[]).map((row) => normalizeAddress(row));
          replaceProjectedCustomerAddresses(customer.id, addresses);
        }

        return { customer, orders, addresses };
      });
      return true;
    }

    // List customers (with optional email/search filter) — used by FlintOrderSearchTile
    if (path === '/api/flint/customers' && method === 'GET') {
      await ctx.route(res, async () => {
        const email  = _url.searchParams.get('email');
        const search = _url.searchParams.get('search') ?? email ?? '';
        const local = getProjectedCustomers();
        if (local.length > 0) {
          if (!search) return local;
          const q = search.toLowerCase();
          return local
            .filter((c) => c.email.toLowerCase().includes(q) || c.name.toLowerCase().includes(q))
            .slice(0, 5);
        }

        const params = search ? `?search=${encodeURIComponent(search)}&page=1&pageSize=5` : '?page=1&pageSize=200';
        const r = await flintFetch(`/customers${params}`);
        if (!r.ok) throw new Error(`FLINT ${r.status}`);
        const raw = await r.json() as { data?: unknown[] } | unknown[];
        const rows = Array.isArray(raw)
          ? raw
          : ((raw as { data?: unknown[] }).data ?? []);
        const customers = (rows as Record<string, unknown>[]).map((row) => normalizeCustomer(row));
        if (customers.length > 0 && !search) replaceProjectedCustomers(customers);
        return search ? customers.slice(0, 5) : customers;
      });
      return true;
    }

    if (customerSubMatch && method === 'GET') {
      await ctx.route(res, async () => {
        const customerId = customerSubMatch[1];
        const sub = customerSubMatch[2];
        if (sub === 'orders') {
          const local = getProjectedCustomerOrders(customerId);
          if (local.length > 0) return local;

          const r = await flintFetch(`/customers/${customerId}/orders`);
          if (!r.ok) throw new Error(`FLINT ${r.status}`);
          const raw = await r.json() as { data?: unknown[] } | unknown[];
          const rows = Array.isArray(raw)
            ? raw
            : ((raw as { data?: unknown[] }).data ?? []);
          const orders = (rows as Record<string, unknown>[]).map((row) => normalizeOrder(row));
          for (const order of orders) upsertProjectedOrder(order);
          return orders;
        }

        const local = getProjectedCustomerAddresses(customerId);
        if (local.length > 0) return local;

        const r = await flintFetch(`/customers/${customerId}/addresses`);
        if (!r.ok) throw new Error(`FLINT ${r.status}`);
        const raw = await r.json() as { data?: unknown[] } | unknown[];
        const rows = Array.isArray(raw)
          ? raw
          : ((raw as { data?: unknown[] }).data ?? []);
        const addresses = (rows as Record<string, unknown>[]).map((row) => normalizeAddress(row));
        if (addresses.length > 0) replaceProjectedCustomerAddresses(customerId, addresses);
        return addresses;
      });
      return true;
    }

    if (customerIdMatch && method === 'GET') {
      await ctx.route(res, async () => {
        const customerId = customerIdMatch[1];
        const local = getProjectedCustomerById(customerId);
        if (local) return local;

        const r = await flintFetch(`/customers/${customerId}`);
        if (!r.ok) throw new Error(`FLINT ${r.status}`);
        const raw = await r.json() as Record<string, unknown> | { data?: Record<string, unknown> };
        const body = (raw as { data?: Record<string, unknown> }).data ?? (raw as Record<string, unknown>);
        const customer = normalizeCustomer(body);
        upsertProjectedCustomer(customer);
        return customer;
      });
      return true;
    }

    if (customerIdMatch && method === 'PUT') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/customers/${customerIdMatch[1]}`, { method: 'PUT', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-customers')?.();
        return result;
      });
      return true;
    }

    // ── Tracking (unauthenticated) ────────────────────────────────────────────

    const trackingMatch = path.match(/^\/api\/flint\/tracking\/([^/]+)$/);
    if (trackingMatch && method === 'GET') {
      await ctx.route(res, async () => {
        const r = await fetch(`${flintUrl()}/logistics/tracking/${trackingMatch[1]}`);
        if (!r.ok) throw new Error(`FLINT ${r.status}`);
        return r.json();
      });
      return true;
    }

    // ── Shipments ────────────────────────────────────────────────────────────

    const shipmentIdMatch = path.match(/^\/api\/flint\/shipments\/([^/]+)$/);

    if (path === '/api/flint/shipments' && method === 'POST') {
      await ctx.route(res, async () => {
        const r = await flintFetch('/logistics/shipments', { method: 'POST', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-shipments')?.();
        void ctx.refreshRegistry.get('flint-orders')?.();
        return result;
      });
      return true;
    }

    if (shipmentIdMatch && method === 'PUT') {
      await ctx.route(res, async () => {
        const r = await flintFetch(`/logistics/shipments/${shipmentIdMatch[1]}`, { method: 'PUT', body });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-shipments')?.();
        return result;
      });
      return true;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    if (path === '/api/flint/admin/sync-stripe' && method === 'POST') {
      await ctx.route(res, async () => {
        // Phase can come from query string (tile) or body (MCP / API clients)
        const phase = _url.searchParams.get('phase')
          ?? (body ? (JSON.parse(body) as { phase?: string }).phase : undefined)
          ?? 'all';
        const r = await flintFetch(`/admin/sync/stripe?phase=${phase}`, { method: 'POST', body: '{}' });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-orders')?.();
        return result;
      });
      return true;
    }

    if (path.startsWith('/api/flint/admin/data-health') && method === 'POST') {
      await ctx.route(res, async () => {
        const urlObj = new URL(`http://localhost${path}`);
        const action = urlObj.searchParams.get('action');
        const urlPath = action ? `/admin/data-health?action=${action}` : '/admin/data-health';
        const r = await flintFetch(urlPath, { method: 'POST', body: body || '{}' });
        if (!r.ok) throw new Error(`FLINT ${r.status}: ${await r.text()}`);
        const result = await r.json();
        void ctx.refreshRegistry.get('flint-data-health')?.();
        return result;
      });
      return true;
    }

    if (path === '/api/flint/sales-range' && method === 'POST') {
      await ctx.route(res, async () => {
        const bodyObj = JSON.parse(body) as { from?: string; to?: string };
        if (bodyObj.from) _salesFrom = bodyObj.from;
        if (bodyObj.to)   _salesTo   = bodyObj.to;
        const data = await dataFlintSales();
        broadcastResource('flint-sales', data);
        // Return the data array so FlintSalesChartTile can update rangeData directly
        return data;
      });
      return true;
    }

    // ── Queue status (admin / debugging) ──────────────────────────────────────

    if (path === '/api/flint/queue/status' && method === 'GET') {
      ctx.json(res, 200, getQueueStatus());
      return true;
    }

    // Unknown /api/flint/* route
    ctx.json(res, 404, { error: `Unknown FLINT route: ${path}` });
    return true;
  };
}
