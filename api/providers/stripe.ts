import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Database } from 'bun:sqlite';
import Stripe from 'stripe';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Order workflow status types & store ───────────────────────────────────────

/** Allowed progression states for an order in the TWM fulfillment workflow. */
export type OrderWorkflowStatus = 'new' | 'processing' | 'packing' | 'shipped' | 'done';

/** Persisted record for a single order's workflow state (stored in SQLite). */
export interface OrderStatusEntry { status: OrderWorkflowStatus; updatedAt: number; note?: string }

const db = new Database(join(__dirname, '..', 'order-statuses.db'), { create: true });
db.run(`CREATE TABLE IF NOT EXISTS order_statuses (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  note TEXT
)`);

const stmtGet = db.prepare<{ id: string; status: string; updated_at: number; note: string | null }, []>(
  'SELECT id, status, updated_at, note FROM order_statuses'
);
const stmtUpsert = db.prepare<void, [string, string, number, string | null]>(
  'INSERT INTO order_statuses (id, status, updated_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, note=excluded.note'
);

function readStatuses(): Record<string, OrderStatusEntry> {
  const rows = stmtGet.all();
  const out: Record<string, OrderStatusEntry> = {};
  for (const r of rows) {
    out[r.id] = { status: r.status as OrderWorkflowStatus, updatedAt: r.updated_at, ...(r.note ? { note: r.note } : {}) };
  }
  return out;
}

function writeStatus(id: string, entry: OrderStatusEntry): void {
  stmtUpsert.run(id, entry.status, entry.updatedAt, entry.note ?? null);
}

// ── Local json helper (mirrors server.ts json with CORS headers) ───────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

// ── Stripe client (lazy) ──────────────────────────────────────────────────────
/**
 * Construct a `Stripe` SDK client using the `STRIPE_SECRET_KEY` environment
 * variable. Returns `null` when the key is absent or is the placeholder value,
 * so callers can gate Stripe-dependent routes without throwing.
 *
 * When `stripeApiUrl` differs from the default `https://api.stripe.com` the
 * client is reconfigured to hit that host instead — useful for pointing at a
 * local Stripe mock server (`stripe-mock`) during tests.
 *
 * @param stripeApiUrl - Optional base URL override. Defaults to `https://api.stripe.com`.
 * @returns A configured `Stripe` instance, or `null` if the secret key is missing.
 */
export function getStripe(stripeApiUrl?: string): Stripe | null {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key || key.startsWith('sk_test_your')) return null;
  const base = stripeApiUrl || 'https://api.stripe.com';
  const cfg: Stripe.StripeConfig = { apiVersion: '2026-02-25.clover' };
  if (base !== 'https://api.stripe.com') {
    const u = new URL(base);
    cfg.host     = u.hostname;
    cfg.protocol = (u.protocol === 'https:' ? 'https' : 'http') as 'https' | 'http';
    if (u.port) cfg.port = parseInt(u.port, 10);
  }
  return new Stripe(key, cfg);
}

/**
 * Write a `503 Service Unavailable` JSON response indicating that Stripe has
 * not been configured. Route handlers call this when `getStripe()` returns
 * `null` so the client receives a clear error instead of a silent failure.
 *
 * @param res - The active HTTP response object.
 */
export function noStripe(res: ServerResponse): void {
  json(res, 503, { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' });
}

// ── Webhook SSE clients (legacy stream) ───────────────────────────────────────
const webhookClients = new Set<ServerResponse>();

// ── Route: GET /api/stripe/payments ──────────────────────────────────────────
async function getPayments(stripe: Stripe, res: ServerResponse): Promise<void> {
  const charges = await stripe.charges.list({ limit: 50 });
  json(res, 200, charges.data.map((c) => ({
    id: c.id, amount: c.amount, currency: c.currency, status: c.status,
    description: c.description, customer: c.customer, created: c.created,
    receiptEmail: c.receipt_email,
  })));
}

// ── Route: GET /api/stripe/payments/:id ──────────────────────────────────────
async function getPayment(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const c = await stripe.charges.retrieve(id, { expand: ['customer', 'payment_intent'] });
  json(res, 200, {
    id: c.id, amount: c.amount, currency: c.currency, status: c.status,
    description: c.description, customer: c.customer, created: c.created,
    receiptEmail: c.receipt_email, receiptUrl: c.receipt_url,
    refunded: c.refunded, amountRefunded: c.amount_refunded,
    captured: c.captured, disputed: c.disputed,
    failureCode: c.failure_code, failureMessage: c.failure_message,
    paymentIntent: typeof c.payment_intent === 'string' ? c.payment_intent : c.payment_intent?.id,
    billingDetails: c.billing_details,
    outcome: c.outcome,
  });
}

// ── Route: POST /api/stripe/payments/:id/refund ───────────────────────────────
async function refundPayment(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as { amount?: number; reason?: string };
  const refund = await stripe.refunds.create({
    charge: id,
    ...(params.amount ? { amount: params.amount } : {}),
    ...(params.reason ? { reason: params.reason as Stripe.RefundCreateParams['reason'] } : {}),
  });
  json(res, 200, { id: refund.id, amount: refund.amount, status: refund.status, reason: refund.reason });
}

// ── Route: POST /api/stripe/payments/:id/capture ──────────────────────────────
async function capturePayment(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  try {
    const pi = await stripe.paymentIntents.capture(id);
    json(res, 200, { id: pi.id, status: pi.status });
  } catch {
    const c = await stripe.charges.capture(id);
    json(res, 200, { id: c.id, status: c.status });
  }
}

// ── Route: POST /api/stripe/payments/:id/cancel ───────────────────────────────
async function cancelPayment(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const pi = await stripe.paymentIntents.cancel(id);
  json(res, 200, { id: pi.id, status: pi.status });
}

// ── Route: GET /api/stripe/products ──────────────────────────────────────────
async function getProducts(stripe: Stripe, res: ServerResponse): Promise<void> {
  const [products, prices] = await Promise.all([
    stripe.products.list({ limit: 50 }),
    stripe.prices.list({ limit: 100, active: true }),
  ]);
  const priceMap = new Map(prices.data.map((p) => [p.product as string, p]));
  json(res, 200, products.data.map((p) => ({
    id: p.id, name: p.name, description: p.description, active: p.active,
    images: p.images, created: p.created, updated: p.updated,
    price: priceMap.get(p.id)
      ? { amount: priceMap.get(p.id)!.unit_amount, currency: priceMap.get(p.id)!.currency, interval: priceMap.get(p.id)!.recurring?.interval }
      : null,
  })));
}

// ── Route: GET /api/stripe/products/:id ──────────────────────────────────────
async function getProduct(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const p = await stripe.products.retrieve(id);
  json(res, 200, {
    id: p.id, name: p.name, description: p.description, active: p.active,
    images: p.images, created: p.created, updated: p.updated, metadata: p.metadata,
  });
}

// ── Route: PATCH /api/stripe/products/:id ────────────────────────────────────
async function updateProduct(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.ProductUpdateParams;
  const p = await stripe.products.update(id, params);
  json(res, 200, { id: p.id, name: p.name, description: p.description, active: p.active });
}

// ── Route: POST /api/stripe/products ─────────────────────────────────────────
async function createProduct(stripe: Stripe, res: ServerResponse, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.ProductCreateParams;
  const p = await stripe.products.create(params);
  json(res, 200, { id: p.id, name: p.name, description: p.description, active: p.active });
}

// ── Route: DELETE /api/stripe/products/:id ───────────────────────────────────
async function deleteProduct(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const result = await stripe.products.del(id);
  json(res, 200, { id: result.id, deleted: result.deleted });
}

// ── Route: GET /api/stripe/products/:id/prices ───────────────────────────────
async function getProductPrices(stripe: Stripe, res: ServerResponse, productId: string): Promise<void> {
  const prices = await stripe.prices.list({ product: productId, limit: 20 });
  json(res, 200, prices.data.map((p) => ({
    id: p.id, active: p.active, currency: p.currency,
    unitAmount: p.unit_amount, nickname: p.nickname,
    recurring: p.recurring ? { interval: p.recurring.interval, intervalCount: p.recurring.interval_count } : null,
    type: p.type, created: p.created,
  })));
}

// ── Route: POST /api/stripe/prices ───────────────────────────────────────────
async function createPrice(stripe: Stripe, res: ServerResponse, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.PriceCreateParams;
  const p = await stripe.prices.create(params);
  json(res, 200, { id: p.id, active: p.active, currency: p.currency, unitAmount: p.unit_amount, type: p.type });
}

// ── Route: PATCH /api/stripe/prices/:id ──────────────────────────────────────
async function updatePrice(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.PriceUpdateParams;
  const p = await stripe.prices.update(id, params);
  json(res, 200, { id: p.id, active: p.active, nickname: p.nickname });
}

// ── Route: GET /api/stripe/subscriptions ─────────────────────────────────────
async function getSubscriptions(stripe: Stripe, res: ServerResponse): Promise<void> {
  const subs = await stripe.subscriptions.list({ limit: 50 });
  json(res, 200, subs.data.map((s) => {
    const sub = s as any;
    return {
      id: s.id, status: s.status, customer: s.customer,
      currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end,
      items: s.items.data.map((i) => ({ priceId: i.price.id, quantity: i.quantity })),
      created: s.created,
    };
  }));
}

// ── Route: GET /api/stripe/subscriptions/:id ─────────────────────────────────
async function getSubscription(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const s = await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice', 'customer', 'default_payment_method'] });
  const sv = s as any;
  json(res, 200, {
    id: s.id, status: s.status, customer: s.customer,
    currentPeriodStart: sv.current_period_start, currentPeriodEnd: sv.current_period_end,
    cancelAtPeriodEnd: sv.cancel_at_period_end, cancelAt: s.cancel_at, canceledAt: s.canceled_at,
    trialStart: s.trial_start, trialEnd: s.trial_end,
    items: s.items.data.map((i) => ({ id: i.id, priceId: i.price.id, quantity: i.quantity, priceNickname: i.price.nickname, unitAmount: i.price.unit_amount, currency: i.price.currency, interval: i.price.recurring?.interval })),
    created: s.created, description: s.description,
    latestInvoice: typeof s.latest_invoice === 'string' ? s.latest_invoice : s.latest_invoice?.id,
    metadata: s.metadata,
  });
}

// ── Route: PATCH /api/stripe/subscriptions/:id ───────────────────────────────
async function updateSubscription(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.SubscriptionUpdateParams;
  const s = await stripe.subscriptions.update(id, params);
  json(res, 200, { id: s.id, status: s.status, cancelAtPeriodEnd: (s as any).cancel_at_period_end });
}

// ── Route: DELETE /api/stripe/subscriptions/:id ──────────────────────────────
async function cancelSubscription(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as { invoice_now?: boolean; prorate?: boolean };
  const s = await stripe.subscriptions.cancel(id, params);
  json(res, 200, { id: s.id, status: s.status, canceledAt: s.canceled_at });
}

// ── Route: POST /api/stripe/subscriptions/:id/resume ─────────────────────────
async function resumeSubscription(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const s = await stripe.subscriptions.resume(id, { billing_cycle_anchor: 'now' });
  json(res, 200, { id: s.id, status: s.status });
}

// ── Route: GET /api/stripe/customers ─────────────────────────────────────────
async function getCustomers(stripe: Stripe, res: ServerResponse): Promise<void> {
  const customers = await stripe.customers.list({ limit: 50 });
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - 30 * 86400;
  json(res, 200, {
    total: customers.data.length,
    newThisMonth: customers.data.filter((c) => c.created > thirtyDaysAgo).length,
    list: customers.data.map((c) => ({
      id: c.id, email: c.email, name: c.name, created: c.created, currency: c.currency,
    })),
  });
}

// ── Route: GET /api/stripe/customers/list ────────────────────────────────────
async function getCustomerList(stripe: Stripe, res: ServerResponse): Promise<void> {
  const customers = await stripe.customers.list({ limit: 100 });
  json(res, 200, customers.data.map((c) => ({
    id: c.id, email: c.email, name: c.name, created: c.created, currency: c.currency,
    balance: c.balance, delinquent: c.delinquent, description: c.description,
  })));
}

// ── Route: GET /api/stripe/customers/:id ─────────────────────────────────────
async function getCustomer(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const c = await stripe.customers.retrieve(id) as Stripe.Customer;
  json(res, 200, {
    id: c.id, email: c.email, name: c.name, phone: c.phone, created: c.created,
    currency: c.currency, balance: c.balance, delinquent: c.delinquent,
    description: c.description, metadata: c.metadata,
    address: c.address,
  });
}

// ── Route: PATCH /api/stripe/customers/:id ───────────────────────────────────
async function updateCustomer(stripe: Stripe, res: ServerResponse, id: string, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as Stripe.CustomerUpdateParams;
  const c = await stripe.customers.update(id, params);
  json(res, 200, { id: c.id, email: c.email, name: c.name, description: c.description });
}

// ── Route: DELETE /api/stripe/customers/:id ──────────────────────────────────
async function deleteCustomer(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const result = await stripe.customers.del(id);
  json(res, 200, { id: result.id, deleted: result.deleted });
}

// ── Route: GET /api/stripe/invoices ──────────────────────────────────────────
async function getInvoices(stripe: Stripe, res: ServerResponse): Promise<void> {
  const invoices = await stripe.invoices.list({ limit: 50 });
  json(res, 200, invoices.data.map((inv) => {
    const i = inv as any;
    return {
      id: inv.id, status: inv.status, customer: inv.customer, subscription: i.subscription,
      amountDue: inv.amount_due, amountPaid: inv.amount_paid, total: inv.total,
      currency: inv.currency, created: inv.created, dueDate: inv.due_date,
      hostedInvoiceUrl: inv.hosted_invoice_url, invoicePdf: inv.invoice_pdf,
      number: inv.number, attemptCount: inv.attempt_count,
    };
  }));
}

// ── Route: GET /api/stripe/invoices/:id ──────────────────────────────────────
async function getInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.retrieve(id, { expand: ['customer'] });
  json(res, 200, {
    id: inv.id, status: inv.status, customer: inv.customer, subscription: (inv as any).subscription,
    amountDue: inv.amount_due, amountPaid: inv.amount_paid, amountRemaining: inv.amount_remaining,
    total: inv.total, subtotal: inv.subtotal, currency: inv.currency,
    created: inv.created, dueDate: inv.due_date, periodStart: inv.period_start, periodEnd: inv.period_end,
    hostedInvoiceUrl: inv.hosted_invoice_url, invoicePdf: inv.invoice_pdf,
    number: inv.number, attemptCount: inv.attempt_count, nextPaymentAttempt: inv.next_payment_attempt,
    lines: inv.lines.data.map((l) => ({
      id: l.id, description: l.description, amount: l.amount, currency: l.currency,
      quantity: l.quantity, period: l.period,
    })),
    metadata: inv.metadata,
  });
}

// ── Route: POST /api/stripe/invoices/:id/finalize ────────────────────────────
async function finalizeInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.finalizeInvoice(id);
  json(res, 200, { id: inv.id, status: inv.status, hostedInvoiceUrl: inv.hosted_invoice_url });
}

// ── Route: POST /api/stripe/invoices/:id/pay ─────────────────────────────────
async function payInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.pay(id);
  json(res, 200, { id: inv.id, status: inv.status });
}

// ── Route: POST /api/stripe/invoices/:id/void ────────────────────────────────
async function voidInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.voidInvoice(id);
  json(res, 200, { id: inv.id, status: inv.status });
}

// ── Route: POST /api/stripe/invoices/:id/send ────────────────────────────────
async function sendInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.sendInvoice(id);
  json(res, 200, { id: inv.id, status: inv.status });
}

// ── Route: GET /api/stripe/refunds ───────────────────────────────────────────
async function getRefunds(stripe: Stripe, res: ServerResponse): Promise<void> {
  const refunds = await stripe.refunds.list({ limit: 50 });
  json(res, 200, refunds.data.map((r) => ({
    id: r.id, amount: r.amount, currency: r.currency, status: r.status,
    reason: r.reason, charge: r.charge, paymentIntent: r.payment_intent,
    created: r.created, description: r.description,
  })));
}

// ── Route: POST /api/stripe/refunds ──────────────────────────────────────────
async function createRefund(stripe: Stripe, res: ServerResponse, body: string): Promise<void> {
  const params = JSON.parse(body || '{}') as { charge?: string; payment_intent?: string; amount?: number; reason?: string };
  const refund = await stripe.refunds.create({
    ...(params.charge ? { charge: params.charge } : {}),
    ...(params.payment_intent ? { payment_intent: params.payment_intent } : {}),
    ...(params.amount ? { amount: params.amount } : {}),
    ...(params.reason ? { reason: params.reason as Stripe.RefundCreateParams['reason'] } : {}),
  });
  json(res, 200, { id: refund.id, amount: refund.amount, currency: refund.currency, status: refund.status, reason: refund.reason });
}

// ── Legacy list handlers (kept for existing tiles) ───────────────────────────
async function getWebhookEvents(stripe: Stripe, res: ServerResponse): Promise<void> {
  const events = await stripe.events.list({ limit: 25 });
  json(res, 200, events.data.map((e) => ({
    id: e.id, type: e.type, created: e.created, livemode: e.livemode, apiVersion: e.api_version,
  })));
}

async function getRevenue(stripe: Stripe, res: ServerResponse): Promise<void> {
  const from = Math.floor(Date.now() / 1000) - 30 * 86400;
  const charges = await stripe.charges.list({ limit: 100, created: { gte: from } });
  const buckets: Record<string, number> = {};
  for (const c of charges.data) {
    if (c.status !== 'succeeded') continue;
    const day = new Date(c.created * 1000).toISOString().slice(0, 10);
    buckets[day] = (buckets[day] ?? 0) + c.amount;
  }
  json(res, 200, Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount })));
}

// ── Data-only fetchers (pure: return data or throw, no res writing) ───────────

export async function dataPayments(stripe: Stripe): Promise<unknown> {
  const charges = await stripe.charges.list({ limit: 50 });
  return charges.data.map((c) => ({
    id: c.id, amount: c.amount, currency: c.currency, status: c.status,
    description: c.description, customer: c.customer, created: c.created,
    receiptEmail: c.receipt_email,
  }));
}

export async function dataProducts(stripe: Stripe): Promise<unknown> {
  const [products, prices] = await Promise.all([
    stripe.products.list({ limit: 50 }),
    stripe.prices.list({ limit: 100, active: true }),
  ]);
  const priceMap = new Map(prices.data.map((p) => [p.product as string, p]));
  return products.data.map((p) => ({
    id: p.id, name: p.name, description: p.description, active: p.active,
    images: p.images, created: p.created, updated: p.updated,
    price: priceMap.get(p.id)
      ? { amount: priceMap.get(p.id)!.unit_amount, currency: priceMap.get(p.id)!.currency, interval: priceMap.get(p.id)!.recurring?.interval }
      : null,
  }));
}

export async function dataSubscriptions(stripe: Stripe): Promise<unknown> {
  const subs = await stripe.subscriptions.list({ limit: 50 });
  return subs.data.map((s) => {
    const sub = s as any;
    return {
      id: s.id, status: s.status, customer: s.customer,
      currentPeriodEnd: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end,
      items: s.items.data.map((i) => ({ priceId: i.price.id, quantity: i.quantity })),
      created: s.created,
    };
  });
}

export async function dataCustomerList(stripe: Stripe): Promise<unknown> {
  const customers = await stripe.customers.list({ limit: 100 });
  return customers.data.map((c) => ({
    id: c.id, email: c.email, name: c.name, created: c.created, currency: c.currency,
    balance: c.balance, delinquent: c.delinquent, description: c.description,
  }));
}

export async function dataInvoices(stripe: Stripe): Promise<unknown> {
  const invoices = await stripe.invoices.list({ limit: 50 });
  return invoices.data.map((inv) => {
    const i = inv as any;
    return {
      id: inv.id, status: inv.status, customer: inv.customer, subscription: i.subscription,
      amountDue: inv.amount_due, amountPaid: inv.amount_paid, total: inv.total,
      currency: inv.currency, created: inv.created, dueDate: inv.due_date,
      hostedInvoiceUrl: inv.hosted_invoice_url, invoicePdf: inv.invoice_pdf,
      number: inv.number, attemptCount: inv.attempt_count,
    };
  });
}

export async function dataRefunds(stripe: Stripe): Promise<unknown> {
  const refunds = await stripe.refunds.list({ limit: 50 });
  return refunds.data.map((r) => ({
    id: r.id, amount: r.amount, currency: r.currency, status: r.status,
    reason: r.reason, charge: r.charge, paymentIntent: r.payment_intent,
    created: r.created, description: r.description,
  }));
}

export async function dataWebhooks(stripe: Stripe): Promise<unknown> {
  const events = await stripe.events.list({ limit: 25 });
  return events.data.map((e) => ({
    id: e.id, type: e.type, created: e.created, livemode: e.livemode, apiVersion: e.api_version,
  }));
}

export async function dataRevenue(stripe: Stripe): Promise<unknown> {
  const from = Math.floor(Date.now() / 1000) - 30 * 86400;
  const charges = await stripe.charges.list({ limit: 100, created: { gte: from } });
  const buckets: Record<string, number> = {};
  for (const c of charges.data) {
    if (c.status !== 'succeeded') continue;
    const day = new Date(c.created * 1000).toISOString().slice(0, 10);
    buckets[day] = (buckets[day] ?? 0) + c.amount;
  }
  return Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b)).map(([date, amount]) => ({ date, amount }));
}

// ── register ──────────────────────────────────────────────────────────────────

/**
 * Register the Stripe provider with the TWM API server.
 *
 * Called once at server startup by `startPollers()` in `server.ts`. It:
 * 1. Constructs a `Stripe` SDK client (no-op when `STRIPE_SECRET_KEY` is absent).
 * 2. Registers recurring pollers via `ctx.poll()` for each Stripe SSE channel
 *    (`stripe-payments`, `stripe-products`, `stripe-subscriptions`, etc.).
 * 3. Returns a {@link ProviderRouteHandler} that handles all `/api/stripe/*`
 *    REST routes and the `/api/webhooks/stripe` inbound webhook endpoint.
 *
 * **Poll intervals** (env vars, milliseconds):
 * - `STRIPE_POLL_MS` (default 30 000) — payments, refunds, webhooks
 * - `STRIPE_SLOW_POLL_MS` (default 60 000) — products, subscriptions, customers, invoices
 * - `STRIPE_REVENUE_POLL_MS` (default 300 000) — revenue chart data
 *
 * **Webhook mode**: when `STRIPE_WEBHOOK_SECRET` is set the server auto-detects
 * webhook delivery; periodic polling for the affected channels is suspended and
 * an incoming `POST /api/webhooks/stripe` triggers an immediate re-fetch instead.
 *
 * @param ctx - The shared {@link ServerContext} injected by `server.ts`.
 * @returns A route handler that claims all `path.startsWith('/api/stripe/')` requests
 *          plus the unified `POST /api/webhooks/stripe` endpoint.
 */
export function register(ctx: ServerContext): ProviderRouteHandler {
  const stripe = getStripe(ctx.STRIPE_API_URL || 'https://api.stripe.com');

  if (stripe) {
    const SP = parseInt(process.env['STRIPE_POLL_MS']         ?? '30000',  10);
    const SL = parseInt(process.env['STRIPE_SLOW_POLL_MS']    ?? '60000',  10);
    const SR = parseInt(process.env['STRIPE_REVENUE_POLL_MS'] ?? '300000', 10);
    ctx.poll('stripe-payments',      SP, () => dataPayments(stripe));
    ctx.poll('stripe-products',      SL, () => dataProducts(stripe));
    ctx.poll('stripe-subscriptions', SL, () => dataSubscriptions(stripe));
    ctx.poll('stripe-customers',     SL, () => dataCustomerList(stripe));
    ctx.poll('stripe-invoices',      SL, () => dataInvoices(stripe));
    ctx.poll('stripe-refunds',       SP, () => dataRefunds(stripe));
    ctx.poll('stripe-revenue',       SR, () => dataRevenue(stripe));
    ctx.poll('stripe-webhooks',      SP, () => dataWebhooks(stripe));
  }

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, body: string): Promise<boolean> => {
    // ── Webhook receive: POST /api/webhooks/stripe ────────────────────────────
    if (path === '/api/webhooks/stripe' && method === 'POST') {
      const secret = process.env['STRIPE_WEBHOOK_SECRET'];
      const sig    = req.headers['stripe-signature'] as string | undefined;
      let eventType = 'unknown';
      try {
        const s = getStripe(ctx.STRIPE_API_URL || 'https://api.stripe.com');
        if (s && secret && sig) {
          const evt = s.webhooks.constructEvent(body, sig, secret);
          eventType = evt.type;
        } else if (secret && sig) {
          const { createHmac } = await import('node:crypto');
          const ts = sig.split(',').find(p => p.startsWith('t='))?.slice(2) ?? '';
          const v1 = sig.split(',').find(p => p.startsWith('v1='))?.slice(3) ?? '';
          const expected = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
          if (expected !== v1) { ctx.json(res, 400, { error: 'Invalid Stripe signature' }); return true; }
          eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
        } else {
          eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
        }
      } catch {
        ctx.json(res, 400, { error: 'Invalid Stripe webhook payload' });
        return true;
      }
      console.log(`  [webhook] stripe  event=${eventType}`);
      const triggerRefresh = (channel: string) => {
        const fn = ctx.refreshRegistry.get(channel);
        if (fn) { console.log(`  [webhook] trigger refresh  ${channel}`); void fn(); }
      };
      if (eventType.startsWith('customer.subscription')) {
        triggerRefresh('stripe-subscriptions');
      } else if (
        eventType.startsWith('payment_intent') ||
        eventType.startsWith('charge') ||
        eventType.startsWith('checkout.session')
      ) {
        triggerRefresh('stripe-payments');
      } else {
        triggerRefresh('stripe-payments');
        triggerRefresh('stripe-subscriptions');
      }
      triggerRefresh('stripe-webhooks');
      ctx.json(res, 200, { received: true });
      return true;
    }

    // ── Legacy webhook SSE stream ─────────────────────────────────────────────
    if (path === '/api/stripe/webhooks/stream' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...CORS });
      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
      webhookClients.add(res);
      req.on('close', () => webhookClients.delete(res));
      return true;
    }

    // ── Legacy webhook ingest ─────────────────────────────────────────────────
    if (path === '/api/stripe/webhooks/ingest' && method === 'POST') {
      const secret = process.env['STRIPE_WEBHOOK_SECRET'];
      const sig    = req.headers['stripe-signature'] as string | undefined;
      let event: Stripe.Event;
      try {
        const s = getStripe(ctx.STRIPE_API_URL || 'https://api.stripe.com');
        if (s && secret && sig) {
          event = s.webhooks.constructEvent(body, sig, secret);
        } else {
          event = JSON.parse(body) as Stripe.Event;
        }
      } catch {
        ctx.json(res, 400, { error: 'Invalid webhook payload' });
        return true;
      }
      const payload = JSON.stringify({ type: 'stripe-event', event });
      for (const client of webhookClients) client.write(`data: ${payload}\n\n`);
      ctx.json(res, 200, { received: true });
      return true;
    }

    if (!path.startsWith('/api/stripe/')) return false;

    // ── Order workflow statuses (local, no Stripe needed) ────────────────────
    if (path === '/api/stripe/orders/statuses' && method === 'GET') {
      ctx.json(res, 200, readStatuses()); return true;
    }
    if (path.startsWith('/api/stripe/orders/') && path.endsWith('/status') && method === 'PATCH') {
      const orderId = path.slice('/api/stripe/orders/'.length, -'/status'.length);
      const { status, note } = JSON.parse(body || '{}') as { status?: OrderWorkflowStatus; note?: string };
      const valid: OrderWorkflowStatus[] = ['new', 'processing', 'packing', 'shipped', 'done'];
      if (!status || !valid.includes(status)) { ctx.json(res, 400, { error: 'Invalid status' }); return true; }
      const entry: OrderStatusEntry = { status, updatedAt: Math.floor(Date.now() / 1000), ...(note !== undefined ? { note } : {}) };
      writeStatus(orderId, entry);
      ctx.json(res, 200, entry); return true;
    }

    const s = getStripe(ctx.STRIPE_API_URL || 'https://api.stripe.com');
    if (!s) { noStripe(res); return true; }

    // Parse path: /api/stripe/<resource>[/<id>[/<action>]]
    const rest = path.slice('/api/stripe/'.length);
    const parts = rest.split('/').filter(Boolean);
    const [resource, id, action] = parts;

    try {
      // ── payments ─────────────────────────────────────────────────────────────
      if (resource === 'payments') {
        if (!id && method === 'GET') { await getPayments(s, res); return true; }
        if (id && !action && method === 'GET') { await getPayment(s, res, id); return true; }
        if (id && action === 'refund' && method === 'POST') { await refundPayment(s, res, id, body); return true; }
        if (id && action === 'capture' && method === 'POST') { await capturePayment(s, res, id); return true; }
        if (id && action === 'cancel' && method === 'POST') { await cancelPayment(s, res, id); return true; }
      }

      // ── products ─────────────────────────────────────────────────────────────
      if (resource === 'products') {
        if (!id && method === 'GET') { await getProducts(s, res); return true; }
        if (!id && method === 'POST') { await createProduct(s, res, body); return true; }
        if (id && !action && method === 'GET') { await getProduct(s, res, id); return true; }
        if (id && !action && method === 'PATCH') { await updateProduct(s, res, id, body); return true; }
        if (id && !action && method === 'DELETE') { await deleteProduct(s, res, id); return true; }
        if (id && action === 'prices' && method === 'GET') { await getProductPrices(s, res, id); return true; }
      }

      // ── prices ───────────────────────────────────────────────────────────────
      if (resource === 'prices') {
        if (!id && method === 'POST') { await createPrice(s, res, body); return true; }
        if (id && method === 'PATCH') { await updatePrice(s, res, id, body); return true; }
      }

      // ── subscriptions ─────────────────────────────────────────────────────────
      if (resource === 'subscriptions') {
        if (!id && method === 'GET') { await getSubscriptions(s, res); return true; }
        if (id && !action && method === 'GET') { await getSubscription(s, res, id); return true; }
        if (id && !action && method === 'PATCH') { await updateSubscription(s, res, id, body); return true; }
        if (id && !action && method === 'DELETE') { await cancelSubscription(s, res, id, body); return true; }
        if (id && action === 'resume' && method === 'POST') { await resumeSubscription(s, res, id); return true; }
      }

      // ── customers ─────────────────────────────────────────────────────────────
      if (resource === 'customers') {
        if (!id && method === 'GET') { await getCustomers(s, res); return true; }
        if (id === 'list' && method === 'GET') { await getCustomerList(s, res); return true; }
        if (id && id !== 'list' && !action && method === 'GET') { await getCustomer(s, res, id); return true; }
        if (id && !action && method === 'PATCH') { await updateCustomer(s, res, id, body); return true; }
        if (id && !action && method === 'DELETE') { await deleteCustomer(s, res, id); return true; }
      }

      // ── invoices ──────────────────────────────────────────────────────────────
      if (resource === 'invoices') {
        if (!id && method === 'GET') { await getInvoices(s, res); return true; }
        if (id && !action && method === 'GET') { await getInvoice(s, res, id); return true; }
        if (id && action === 'finalize' && method === 'POST') { await finalizeInvoice(s, res, id); return true; }
        if (id && action === 'pay' && method === 'POST') { await payInvoice(s, res, id); return true; }
        if (id && action === 'void' && method === 'POST') { await voidInvoice(s, res, id); return true; }
        if (id && action === 'send' && method === 'POST') { await sendInvoice(s, res, id); return true; }
      }

      // ── refunds ───────────────────────────────────────────────────────────────
      if (resource === 'refunds') {
        if (!id && method === 'GET') { await getRefunds(s, res); return true; }
        if (!id && method === 'POST') { await createRefund(s, res, body); return true; }
      }

      // ── legacy list routes for existing tiles ─────────────────────────────────
      if (resource === 'webhooks' && !id && method === 'GET') { await getWebhookEvents(s, res); return true; }
      if (resource === 'revenue' && method === 'GET') { await getRevenue(s, res); return true; }

      ctx.json(res, 404, { error: `Unknown route: ${method} /api/stripe/${rest}` });
    } catch (err) {
      ctx.json(res, 500, { error: err instanceof Error ? err.message : 'Unknown error' });
    }
    return true;
  };
}
