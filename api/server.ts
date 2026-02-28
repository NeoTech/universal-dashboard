/**
 * TWM API Server — Stripe proxy + GitHub Actions + Cloudflare + PayPal
 * Run: bun run api
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GITHUB_TOKEN, CF_API_TOKEN, CF_ACCOUNT_ID,
 *      PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV, API_PORT (default 3001)
 */

import { createServer as httpCreateServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHmac, randomBytes, pbkdf2Sync } from 'node:crypto';
import { Database } from 'bun:sqlite';
import Stripe from 'stripe';

// ── Order workflow status store (SQLite via bun:sqlite) ───────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));

// ── .env file paths ───────────────────────────────────────────────────────────
const ENV_PATH          = join(__dirname, '..', '.env');
const POLL_SETTINGS_PATH = join(__dirname, '..', 'poll-settings.json');
const AUTH_DB_PATH       = join(__dirname, '..', 'auth.db');

/** Parse an env file string into a key→value record (comments/blanks ignored). */
function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1); // preserve leading spaces in value
    if (key) vars[key] = val;
  }
  return vars;
}

/**
 * Write updated vars back into an existing env file string.
 * Preserves all comment lines and structure; replaces values in-place.
 * Keys not found in the original are appended at the end.
 * Also un-comments a commented-out key if it exists in updates.
 */
function patchEnvFile(existing: string, updates: Record<string, string>): string {
  const handled = new Set<string>();
  const lines = existing.split('\n').map(line => {
    const trimmed = line.trim();
    // Active assignment: KEY=value
    if (trimmed && !trimmed.startsWith('#')) {
      const eq = trimmed.indexOf('=');
      if (eq >= 0) {
        const key = trimmed.slice(0, eq).trim();
        if (key && key in updates) {
          handled.add(key);
          return `${key}=${updates[key]}`;
        }
      }
    }
    // Commented-out assignment: # KEY=value  → un-comment if user provided a value
    if (trimmed.startsWith('#')) {
      const rest = trimmed.slice(1).trim();
      const eq = rest.indexOf('=');
      if (eq >= 0) {
        const key = rest.slice(0, eq).trim();
        if (key && key in updates && updates[key] !== '') {
          handled.add(key);
          return `${key}=${updates[key]}`;
        }
      }
    }
    return line;
  });
  // Append keys that weren't in the file at all
  for (const [key, val] of Object.entries(updates)) {
    if (!handled.has(key) && val !== '') lines.push(`${key}=${val}`);
  }
  return lines.join('\n');
}


type OrderWorkflowStatus = 'new' | 'processing' | 'packing' | 'shipped' | 'done';
interface OrderStatusEntry { status: OrderWorkflowStatus; updatedAt: number; note?: string }

const db = new Database(join(__dirname, 'order-statuses.db'), { create: true });
db.run(`CREATE TABLE IF NOT EXISTS order_statuses (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  note TEXT
)`);

const stmtGet  = db.prepare<{ id: string; status: string; updated_at: number; note: string | null }, []>(
  'SELECT id, status, updated_at, note FROM order_statuses'
);
const stmtUpsert = db.prepare<void, [string, string, number, string | null]>(
  'INSERT INTO order_statuses (id, status, updated_at, note) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at, note=excluded.note'
);

// ── Auth database ──────────────────────────────────────────────────────────────
const authDb = new Database(AUTH_DB_PATH, { create: true });
authDb.run(`CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT    UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
)`);
authDb.run(`CREATE TABLE IF NOT EXISTS tile_layouts (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace    TEXT    NOT NULL,
  tiles_json   TEXT    NOT NULL,
  updated_at   INTEGER NOT NULL,
  PRIMARY KEY (user_id, workspace)
)`);

// JWT secret: stable across restarts only if JWT_SECRET is in .env.
const JWT_SECRET: string = process.env['JWT_SECRET'] ?? (() => {
  const s = randomBytes(32).toString('hex');
  console.warn('  [auth] WARNING: JWT_SECRET not in .env — ephemeral secret generated. All tokens invalidated on restart. Add JWT_SECRET to .env to persist sessions.');
  return s;
})();

/** Whether login is required. Set AUTH_ENABLED=true in .env to enable. */
const AUTH_ENABLED: boolean = process.env['AUTH_ENABLED'] === 'true';

interface JwtPayload { sub: number; username: string; iat: number; exp: number; }
const JWT_EXPIRY_S = 30 * 86400; // 30 days

function signJwt(sub: number, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JwtPayload = { sub, username, iat: now, exp: now + JWT_EXPIRY_S };
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const s = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
  return `${h}.${b}.${s}`;
}

function verifyJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts as [string, string, string];
    const expected = createHmac('sha256', JWT_SECRET).update(`${h}.${b}`).digest('base64url');
    if (s !== expected) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) as JwtPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function extractToken(req: IncomingMessage): JwtPayload | null {
  const auth = req.headers.authorization ?? '';
  if (auth.startsWith('Bearer ')) return verifyJwt(auth.slice(7));
  // EventSource cannot set headers — accept token as query param for SSE
  const qs = new URL(req.url ?? '/', 'http://localhost').searchParams;
  const t = qs.get('token');
  return t ? verifyJwt(t) : null;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const idx = stored.indexOf(':');
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const hash = stored.slice(idx + 1);
  const attempt = pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return attempt === hash;
}

// Prepared auth statements
const stmtFindUser    = authDb.prepare<{ id: number; username: string; password_hash: string }, [string]>('SELECT id, username, password_hash FROM users WHERE username = ? COLLATE NOCASE');
const stmtInsertUser  = authDb.prepare<{ id: number }, [string, string]>('INSERT INTO users (username, password_hash) VALUES (?, ?) RETURNING id');
const stmtGetLayout   = authDb.prepare<{ tiles_json: string }, [number, string]>('SELECT tiles_json FROM tile_layouts WHERE user_id = ? AND workspace = ?');
const stmtUpsertLayout = authDb.prepare<void, [number, string, string, number]>('INSERT INTO tile_layouts (user_id, workspace, tiles_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, workspace) DO UPDATE SET tiles_json=excluded.tiles_json, updated_at=excluded.updated_at');

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

// ── Stripe client (lazy) ──────────────────────────────────────────────────────
function getStripe(): Stripe | null {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key || key.startsWith('sk_test_your')) return null;
  return new Stripe(key, { apiVersion: '2025-01-27.acacia' });
}

// ── CORS ──────────────────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', ...CORS });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', () => resolve(body));
  });
}

function noStripe(res: ServerResponse): void {
  json(res, 503, { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env' });
}

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
  // id here could be a charge or a payment_intent — try PaymentIntent first
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
  json(res, 200, subs.data.map((s) => ({
    id: s.id, status: s.status, customer: s.customer,
    currentPeriodEnd: s.current_period_end, cancelAtPeriodEnd: s.cancel_at_period_end,
    items: s.items.data.map((i) => ({ priceId: i.price.id, quantity: i.quantity })),
    created: s.created,
  })));
}

// ── Route: GET /api/stripe/subscriptions/:id ─────────────────────────────────
async function getSubscription(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const s = await stripe.subscriptions.retrieve(id, { expand: ['latest_invoice', 'customer', 'default_payment_method'] });
  json(res, 200, {
    id: s.id, status: s.status, customer: s.customer,
    currentPeriodStart: s.current_period_start, currentPeriodEnd: s.current_period_end,
    cancelAtPeriodEnd: s.cancel_at_period_end, cancelAt: s.cancel_at, canceledAt: s.canceled_at,
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
  json(res, 200, { id: s.id, status: s.status, cancelAtPeriodEnd: s.cancel_at_period_end });
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
  json(res, 200, invoices.data.map((inv) => ({
    id: inv.id, status: inv.status, customer: inv.customer, subscription: inv.subscription,
    amountDue: inv.amount_due, amountPaid: inv.amount_paid, total: inv.total,
    currency: inv.currency, created: inv.created, dueDate: inv.due_date,
    hostedInvoiceUrl: inv.hosted_invoice_url, invoicePdf: inv.invoice_pdf,
    number: inv.number, attemptCount: inv.attempt_count,
  })));
}

// ── Route: GET /api/stripe/invoices/:id ──────────────────────────────────────
async function getInvoice(stripe: Stripe, res: ServerResponse, id: string): Promise<void> {
  const inv = await stripe.invoices.retrieve(id, { expand: ['customer'] });
  json(res, 200, {
    id: inv.id, status: inv.status, customer: inv.customer, subscription: inv.subscription,
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

// ── Webhook SSE ───────────────────────────────────────────────────────────────
const webhookClients = new Set<ServerResponse>();

// ── Shared SSE broadcast infrastructure ──────────────────────────────────────
const sseClients = new Set<ServerResponse>();
const resourceCache = new Map<string, unknown>();

/**
 * Registry of on-demand refresh functions keyed by SSE event name.
 * Populated by poll() so that POST /api/refresh/:event can trigger an
 * immediate re-fetch + broadcast without waiting for the next interval.
 */
const refreshRegistry = new Map<string, () => Promise<void>>();

/** Stored setInterval handles so intervals can be cancelled and replaced. */
const pollerIntervals = new Map<string, ReturnType<typeof setInterval>>();

/** Stored run functions so set-interval can restart with a new period. */
const pollerRunFns = new Map<string, () => Promise<void>>();

interface PollSettings {
  paused: string[];
  intervals: Record<string, number>; // event → ms override
}

function loadPollSettings(): PollSettings {
  try {
    if (existsSync(POLL_SETTINGS_PATH)) {
      const s = JSON.parse(readFileSync(POLL_SETTINGS_PATH, 'utf8')) as PollSettings;
      const pausedList = s.paused ?? [];
      const intervalKeys = Object.keys(s.intervals ?? {});
      if (pausedList.length || intervalKeys.length) {
        console.log('  [poll] restored settings from poll-settings.json');
        for (const ch of pausedList)
          console.log(`  [poll]   paused:   ${ch}`);
        for (const [ch, ms] of Object.entries(s.intervals ?? {}))
          console.log(`  [poll]   interval: ${ch.padEnd(32)}  ${fmtMs(ms)}`);
      }
      return s;
    }
  } catch { /* corrupt file — ignore */ }
  return { paused: [], intervals: {} };
}

function fmtMs(ms: number): string {
  return ms >= 3_600_000 ? `${ms / 3_600_000}h`
       : ms >= 60_000   ? `${ms / 60_000}m`
       :                   `${ms / 1000}s`;
}

function savePollSettings(): void {
  const settings: PollSettings = {
    paused: [...pausedPollers],
    intervals: Object.fromEntries(pollerCustomIntervals),
  };
  try { writeFileSync(POLL_SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf8'); } catch { /* ignore */ }
}

const _savedSettings = loadPollSettings();

/**
 * Channels paused by the client (refreshInterval = 0).
 * Persisted to poll-settings.json so restarts respect the paused state.
 */
const pausedPollers = new Set<string>(_savedSettings.paused);

/**
 * Client-specified poll intervals (ms) that override the .env defaults.
 * Persisted to poll-settings.json.
 */
const pollerCustomIntervals = new Map<string, number>(Object.entries(_savedSettings.intervals));

function broadcastSse(event: string, data: unknown): void {
  resourceCache.set(event, data);
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of [...sseClients]) {
    try { client.write(chunk); } catch { sseClients.delete(client); }
  }
}

function handleSseStream(req: IncomingMessage, res: ServerResponse): void {
  const clientIp = req.socket.remoteAddress ?? 'unknown';
  console.log(`  [sse]  client connected   ip=${clientIp}  total=${sseClients.size + 1}`);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...CORS,
  });
  // Send current cached data immediately so tiles populate without waiting
  let replayed = 0;
  for (const [ev, data] of resourceCache) {
    res.write(`event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`);
    replayed++;
  }
  console.log(`  [sse]  replayed ${replayed} cached events to new client`);
  res.write(': connected\n\n');
  sseClients.add(res);
  req.on('close', () => {
    sseClients.delete(res);
    console.log(`  [sse]  client disconnected ip=${clientIp}  total=${sseClients.size}`);
  });
}

function handleWebhookStream(req: IncomingMessage, res: ServerResponse): void {
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', ...CORS });
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  webhookClients.add(res);
  req.on('close', () => webhookClients.delete(res));
}

async function handleWebhookIngest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  const secret = process.env['STRIPE_WEBHOOK_SECRET'];
  const sig = req.headers['stripe-signature'] as string | undefined;
  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    if (stripe && secret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, secret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch {
    json(res, 400, { error: 'Invalid webhook payload' });
    return;
  }
  const payload = JSON.stringify({ type: 'stripe-event', event });
  for (const client of webhookClients) client.write(`data: ${payload}\n\n`);
  json(res, 200, { received: true });
}

// ── GitHub Actions handlers ───────────────────────────────────────────────────

interface GHApiRun {
  id: number; name: string; head_branch: string; head_sha: string;
  run_number: number; event: string; status: string; conclusion: string | null;
  html_url: string; created_at: string; updated_at: string; display_title?: string;
  repository: { full_name: string };
}

function normalizeGHRun(r: GHApiRun) {
  return {
    id: r.id, name: r.display_title ?? r.name, workflow_name: r.name,
    head_branch: r.head_branch, head_sha: r.head_sha, run_number: r.run_number,
    event: r.event, status: r.status, conclusion: r.conclusion,
    repository: r.repository.full_name, html_url: r.html_url,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

async function getGitHubRuns(res: ServerResponse): Promise<void> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token || token.startsWith('ghp_your')) { json(res, 503, { error: 'GITHUB_TOKEN not configured' }); return; }
  const org  = process.env['GITHUB_ORG'];
  const user = process.env['GITHUB_USER'];
  if (!org && !user) { json(res, 503, { error: 'Set GITHUB_ORG or GITHUB_USER in .env' }); return; }
  try {
    // Delegate to dataGithubRuns so both paths share caching + rate-limit logic.
    const runs = await dataGithubRuns();
    json(res, 200, runs);
  } catch (err) {
    json(res, 503, { error: err instanceof Error ? err.message : String(err) });
  }
}

// ── Cloudflare handlers ───────────────────────────────────────────────────────

function cfHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env['CF_API_TOKEN'] ?? ''}`, 'Content-Type': 'application/json' };
}

async function cfFetch(path: string): Promise<unknown> {
  const accountId = process.env['CF_ACCOUNT_ID'] ?? '';
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${path}`, { headers: cfHeaders() });
  const data = await r.json() as { success: boolean; result: unknown; errors: { message: string }[] };
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Cloudflare API error');
  return data.result;
}

async function getCFPages(res: ServerResponse): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const projects = await cfFetch('/pages/projects');
    json(res, 200, projects);
  } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

async function getCFPageDeployments(res: ServerResponse, projectName: string): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const deployments = await cfFetch(`/pages/projects/${projectName}/deployments`);
    json(res, 200, deployments);
  } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

async function getCFWorkers(res: ServerResponse): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const scripts = await cfFetch('/workers/scripts');
    json(res, 200, scripts);
  } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

// ── PayPal handlers ───────────────────────────────────────────────────────────

let _ppToken: { access_token: string; expiresAt: number } | null = null;

async function getPayPalToken(): Promise<string | null> {
  const clientId     = process.env['PAYPAL_CLIENT_ID'];
  const clientSecret = process.env['PAYPAL_CLIENT_SECRET'];
  if (!clientId || !clientSecret) return null;
  if (_ppToken && Date.now() < _ppToken.expiresAt) return _ppToken.access_token;
  const env = process.env['PAYPAL_ENV'] ?? 'sandbox';
  const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) return null;
  const data = await r.json() as { access_token: string; expires_in: number };
  _ppToken = { access_token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return _ppToken.access_token;
}

async function paypalFetch(path: string, token: string): Promise<unknown> {
  const env = process.env['PAYPAL_ENV'] ?? 'sandbox';
  const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!r.ok) { const err = await r.text(); throw new Error(err); }
  return r.json();
}

async function getPayPalTransactions(res: ServerResponse): Promise<void> {
  const token = await getPayPalToken();
  if (!token) { json(res, 503, { error: 'PayPal credentials not configured' }); return; }
  try {
    const end   = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt   = (d: Date) => d.toISOString().slice(0, 19) + '+0000'; // PayPal requires this format
    const data  = await paypalFetch(
      `/v1/reporting/transactions?start_date=${fmt(start)}&end_date=${fmt(end)}&fields=all&page_size=100`,
      token,
    );
    json(res, 200, data);
  } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

async function getPayPalBalance(res: ServerResponse): Promise<void> {
  const token = await getPayPalToken();
  if (!token) { json(res, 503, { error: 'PayPal credentials not configured' }); return; }
  try {
    const data = await paypalFetch('/v1/reporting/balances', token);
    json(res, 200, data);
  } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

// ── Data-only fetchers (pure: return data or throw, no res writing) ───────────

async function dataPayments(stripe: Stripe): Promise<unknown> {
  const charges = await stripe.charges.list({ limit: 50 });
  return charges.data.map((c) => ({
    id: c.id, amount: c.amount, currency: c.currency, status: c.status,
    description: c.description, customer: c.customer, created: c.created,
    receiptEmail: c.receipt_email,
  }));
}

async function dataProducts(stripe: Stripe): Promise<unknown> {
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

async function dataSubscriptions(stripe: Stripe): Promise<unknown> {
  const subs = await stripe.subscriptions.list({ limit: 50 });
  return subs.data.map((s) => ({
    id: s.id, status: s.status, customer: s.customer,
    currentPeriodEnd: s.current_period_end, cancelAtPeriodEnd: s.cancel_at_period_end,
    items: s.items.data.map((i) => ({ priceId: i.price.id, quantity: i.quantity })),
    created: s.created,
  }));
}

async function dataCustomerList(stripe: Stripe): Promise<unknown> {
  const customers = await stripe.customers.list({ limit: 100 });
  return customers.data.map((c) => ({
    id: c.id, email: c.email, name: c.name, created: c.created, currency: c.currency,
    balance: c.balance, delinquent: c.delinquent, description: c.description,
  }));
}

async function dataInvoices(stripe: Stripe): Promise<unknown> {
  const invoices = await stripe.invoices.list({ limit: 50 });
  return invoices.data.map((inv) => ({
    id: inv.id, status: inv.status, customer: inv.customer, subscription: inv.subscription,
    amountDue: inv.amount_due, amountPaid: inv.amount_paid, total: inv.total,
    currency: inv.currency, created: inv.created, dueDate: inv.due_date,
    hostedInvoiceUrl: inv.hosted_invoice_url, invoicePdf: inv.invoice_pdf,
    number: inv.number, attemptCount: inv.attempt_count,
  }));
}

async function dataRefunds(stripe: Stripe): Promise<unknown> {
  const refunds = await stripe.refunds.list({ limit: 50 });
  return refunds.data.map((r) => ({
    id: r.id, amount: r.amount, currency: r.currency, status: r.status,
    reason: r.reason, charge: r.charge, paymentIntent: r.payment_intent,
    created: r.created, description: r.description,
  }));
}

async function dataWebhooks(stripe: Stripe): Promise<unknown> {
  const events = await stripe.events.list({ limit: 25 });
  return events.data.map((e) => ({
    id: e.id, type: e.type, created: e.created, livemode: e.livemode, apiVersion: e.api_version,
  }));
}

async function dataRevenue(stripe: Stripe): Promise<unknown> {
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

// ── GitHub helpers ───────────────────────────────────────────────────────────

/** Last successful github-runs payload — served stale on rate-limit errors. */
let _ghRunsCache: unknown = null;
/** Epoch ms when the GitHub rate limit resets; 0 = not known / not limited. */
let _ghRateLimitResetAt = 0;

/**
 * Run `tasks` in batches of `concurrency` at a time, in order.
 * Avoids blasting the GitHub API with 100 simultaneous requests.
 */
async function batchConcurrent<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const slice = tasks.slice(i, i + concurrency).map((fn) => fn());
    results.push(...await Promise.all(slice));
  }
  return results;
}

async function fetchGithubRunsForUser(token: string, user: string): Promise<GHApiRun[]> {
  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'TWM-API/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  const reposRes = await fetch(`https://api.github.com/users/${user}/repos?type=owner&per_page=100`, { headers: ghHeaders });
  if (!reposRes.ok) {
    if (reposRes.status === 403 || reposRes.status === 429) {
      const reset = Number(reposRes.headers.get('x-ratelimit-reset') ?? '0');
      if (reset) _ghRateLimitResetAt = reset * 1000;
      throw new Error(`GitHub rate limit (repos list) — resets at ${new Date(_ghRateLimitResetAt).toISOString()}`);
    }
    throw new Error(await reposRes.text());
  }
  // Track remaining quota from headers.
  const remaining = Number(reposRes.headers.get('x-ratelimit-remaining') ?? '-1');
  const reset = Number(reposRes.headers.get('x-ratelimit-reset') ?? '0');
  if (reset) _ghRateLimitResetAt = reset * 1000;

  const repos = await reposRes.json() as { full_name: string }[];
  const capped = repos.slice(0, 50); // cap at 50 repos to preserve quota

  // Warn early if we're close to the limit before firing per-repo requests.
  if (remaining >= 0 && remaining < capped.length + 10) {
    console.warn(`  [github] only ${remaining} API calls remaining — skipping per-repo run fetches to avoid rate limit`);
    return [];
  }

  const tasks = capped.map((repo) => async () => {
    const r = await fetch(`https://api.github.com/repos/${repo.full_name}/actions/runs?per_page=10`, { headers: ghHeaders });
    if (!r.ok) {
      if (r.status === 403 || r.status === 429) {
        const rs = Number(r.headers.get('x-ratelimit-reset') ?? '0');
        if (rs) _ghRateLimitResetAt = rs * 1000;
        throw new Error(`GitHub rate limit hit on ${repo.full_name}`);
      }
      return [] as GHApiRun[];
    }
    const body = await r.json() as { workflow_runs?: GHApiRun[] };
    return body.workflow_runs ?? [] as GHApiRun[];
  });

  // Fetch 5 repos at a time to stay well within burst limits.
  const runArrays = await batchConcurrent(tasks, 5);
  return runArrays.flat().sort((a, b) => b.run_number - a.run_number).slice(0, 50);
}

async function dataGithubRuns(): Promise<unknown> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token || token.startsWith('ghp_your')) throw new Error('GITHUB_TOKEN not configured');
  const org  = process.env['GITHUB_ORG'];
  const user = process.env['GITHUB_USER'];
  if (!org && !user) throw new Error('Set GITHUB_ORG or GITHUB_USER in .env');

  // If we know the rate limit hasn't reset yet, return cached data immediately.
  if (_ghRateLimitResetAt > 0 && Date.now() < _ghRateLimitResetAt) {
    const waitSec = Math.ceil((_ghRateLimitResetAt - Date.now()) / 1000);
    console.warn(`  [github] rate-limited — skipping fetch, resets in ${waitSec}s  (serving cached data)`);
    if (_ghRunsCache) return _ghRunsCache;
    throw new Error(`GitHub rate limit active, resets in ${waitSec}s`);
  }

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'TWM-API/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    let runs: unknown;
    if (org) {
      const apiUrl = `https://api.github.com/orgs/${org}/actions/runs?per_page=50`;
      const ghRes = await fetch(apiUrl, { headers: ghHeaders });
      if (!ghRes.ok) {
        if (ghRes.status === 403 || ghRes.status === 429) {
          const reset = Number(ghRes.headers.get('x-ratelimit-reset') ?? '0');
          if (reset) _ghRateLimitResetAt = reset * 1000;
          const waitSec = reset ? Math.ceil((reset * 1000 - Date.now()) / 1000) : '?';
          console.warn(`  [github] rate limit hit (org runs) — resets in ${waitSec}s`);
          if (_ghRunsCache) { console.warn('  [github] serving stale cache'); return _ghRunsCache; }
        }
        throw new Error(await ghRes.text());
      }
      const body = await ghRes.json() as { workflow_runs: GHApiRun[] };
      runs = (body.workflow_runs ?? []).map(normalizeGHRun);
    } else {
      const rawRuns = await fetchGithubRunsForUser(token, user!);
      runs = rawRuns.map(normalizeGHRun);
    }
    _ghRunsCache = runs; // update cache on success
    _ghRateLimitResetAt = 0; // clear any previous rate-limit timer
    return runs;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((msg.includes('rate limit') || msg.includes('403')) && _ghRunsCache) {
      console.warn(`  [github] error — ${msg}  (serving stale cache)`);
      return _ghRunsCache;
    }
    throw e;
  }
}

async function dataCFPages(): Promise<unknown> {
  if (!process.env['CF_API_TOKEN']) throw new Error('CF_API_TOKEN not configured');
  return cfFetch('/pages/projects');
}

async function dataCFWorkers(): Promise<unknown> {
  if (!process.env['CF_API_TOKEN']) throw new Error('CF_API_TOKEN not configured');
  return cfFetch('/workers/scripts');
}

async function dataPayPal(): Promise<unknown> {
  const token = await getPayPalToken();
  if (!token) throw new Error('PayPal credentials not configured');
  const end   = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt   = (d: Date) => d.toISOString().slice(0, 19) + '+0000';
  const [txData, balData] = await Promise.all([
    paypalFetch(`/v1/reporting/transactions?start_date=${fmt(start)}&end_date=${fmt(end)}&fields=all&page_size=100`, token),
    paypalFetch('/v1/reporting/balances', token),
  ]);
  return {
    transactions: (txData as { transaction_details?: unknown[] }).transaction_details ?? [],
    balances:     (balData  as { balances?: unknown[] }).balances ?? [],
  };
}

// ── Vercel ────────────────────────────────────────────────────────────────────
async function dataVercelDeployments(): Promise<unknown> {
  const token = process.env['VERCEL_TOKEN'];
  if (!token) throw new Error('VERCEL_TOKEN not configured');
  const teamQuery = process.env['VERCEL_TEAM_ID'] ? `&teamId=${process.env['VERCEL_TEAM_ID']}` : '';
  const r = await fetch(`https://api.vercel.com/v6/deployments?limit=20${teamQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json() as { deployments?: unknown[] };
  return data.deployments ?? [];
}

async function getVercelDeployments(res: ServerResponse): Promise<void> {
  const token = process.env['VERCEL_TOKEN'];
  if (!token) { json(res, 503, { error: 'VERCEL_TOKEN not set' }); return; }
  try {
    const data = await dataVercelDeployments();
    json(res, 200, data);
  } catch (e) {
    json(res, 502, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

// ── Netlify ───────────────────────────────────────────────────────────────────
async function dataNetlifyDeployments(): Promise<unknown> {
  const token = process.env['NETLIFY_TOKEN'];
  if (!token) throw new Error('NETLIFY_TOKEN not configured');
  const headers = { Authorization: `Bearer ${token}` };
  const sitesRes = await fetch('https://api.netlify.com/api/v1/sites?per_page=10', { headers });
  const sites = await sitesRes.json() as Array<{ id: string }>;
  const deployArrays = await Promise.all(
    sites.slice(0, 5).map(s =>
      fetch(`https://api.netlify.com/api/v1/sites/${s.id}/deploys?per_page=5`, { headers })
        .then(r => r.json())
    )
  );
  return (deployArrays as unknown[][]).flat();
}

async function getNetlifyDeployments(res: ServerResponse): Promise<void> {
  const token = process.env['NETLIFY_TOKEN'];
  if (!token) { json(res, 503, { error: 'NETLIFY_TOKEN not set' }); return; }
  try {
    const data = await dataNetlifyDeployments();
    json(res, 200, data);
  } catch (e) {
    json(res, 502, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

// ── CircleCI ──────────────────────────────────────────────────────────────────
async function dataCircleCIPipelines(): Promise<unknown> {
  const token = process.env['CIRCLECI_TOKEN'];
  const orgSlug = process.env['CIRCLECI_ORG_SLUG'];
  if (!token || !orgSlug) throw new Error('CIRCLECI_TOKEN or CIRCLECI_ORG_SLUG not configured');
  const r = await fetch(`https://circleci.com/api/v2/pipeline?org-slug=${orgSlug}&mine=false`, {
    headers: { 'Circle-Token': token },
  });
  const data = await r.json() as { items?: unknown[] };
  const pipelines = data.items ?? [];
  const workflowResults = await Promise.all(
    (pipelines as Array<{ id: string }>).slice(0, 10).map(p =>
      fetch(`https://circleci.com/api/v2/pipeline/${p.id}/workflow`, { headers: { 'Circle-Token': token } })
        .then(r2 => r2.json())
        .then((d: { items?: unknown[] }) => d.items ?? [])
    )
  );
  return { pipelines, workflows: workflowResults.flat() };
}

async function dataCircleCIInsights(): Promise<unknown> {
  const token = process.env['CIRCLECI_TOKEN'];
  const orgSlug = process.env['CIRCLECI_ORG_SLUG'];
  if (!token || !orgSlug) throw new Error('CIRCLECI_TOKEN or CIRCLECI_ORG_SLUG not configured');
  const r = await fetch(`https://circleci.com/api/v2/insights/${orgSlug}/workflows?reporting-window=last-30-days`, {
    headers: { 'Circle-Token': token },
  });
  const data = await r.json() as { items?: unknown[] };
  return { insights: data.items ?? [] };
}

// ── Travis CI ─────────────────────────────────────────────────────────────────
async function dataTravisBuilds(): Promise<unknown> {
  const token = process.env['TRAVIS_TOKEN'];
  const org = process.env['TRAVIS_ORG'];
  if (!token || !org) throw new Error('TRAVIS_TOKEN or TRAVIS_ORG not configured');
  const r = await fetch(`https://api.travis-ci.com/v3/owner/${org}/builds?limit=25&include=build.repository,build.branch,build.commit`, {
    headers: { 'Travis-API-Version': '3', 'Authorization': `token ${token}` },
  });
  const data = await r.json() as { builds?: unknown[] };
  return { builds: data.builds ?? [] };
}

// ── Bitrise ───────────────────────────────────────────────────────────────────
async function dataBitriseBuilds(): Promise<unknown> {
  const token = process.env['BITRISE_TOKEN'];
  if (!token) throw new Error('BITRISE_TOKEN not configured');
  const headers = { Authorization: `token ${token}` };
  const appsRes = await fetch('https://api.bitrise.io/v0.1/apps?limit=10', { headers });
  const appsData = await appsRes.json() as { data?: Array<{ slug: string }> };
  const apps = appsData.data ?? [];
  if (!apps.length) return { builds: [], apps: [] };
  const buildArrays = await Promise.all(
    apps.slice(0, 3).map(app =>
      fetch(`https://api.bitrise.io/v0.1/apps/${app.slug}/builds?limit=10`, { headers })
        .then(r => r.json())
        .then((d: { data?: unknown[] }) => d.data ?? [])
    )
  );
  return { builds: (buildArrays as unknown[][]).flat(), apps };
}

// ── Docker Hub ────────────────────────────────────────────────────────────────
async function dataDockerHubRepos(): Promise<unknown> {
  const username = process.env['DOCKERHUB_USERNAME'];
  if (!username) throw new Error('DOCKERHUB_USERNAME not configured');
  const token = process.env['DOCKERHUB_TOKEN'];
  const headers: Record<string, string> = {};
  if (token) {
    // Get JWT via login
    const loginRes = await fetch('https://hub.docker.com/v2/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: token }),
    });
    const loginData = await loginRes.json() as { token?: string };
    if (loginData.token) headers['Authorization'] = `Bearer ${loginData.token}`;
  }
  const r = await fetch(`https://hub.docker.com/v2/repositories/${username}/?page_size=25`, { headers });
  const data = await r.json() as { results?: unknown[] };
  return { repos: data.results ?? [] };
}

// ── SonarQube ─────────────────────────────────────────────────────────────────
async function dataSonarQubeQuality(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const projectsRes = await fetch(`${url}/api/projects/search?ps=50`, { headers });
  const projectsData = await projectsRes.json() as { components?: Array<{ key: string; name: string }> };
  const projects = projectsData.components ?? [];
  const gates = await Promise.all(
    projects.slice(0, 20).map(async p => {
      const gateRes = await fetch(`${url}/api/qualitygates/project_status?projectKey=${p.key}`, { headers });
      const gateData = await gateRes.json() as { projectStatus?: { status: string; conditions?: unknown[] } };
      return {
        projectKey: p.key,
        projectName: p.name,
        status: gateData.projectStatus?.status ?? 'NONE',
        conditions: gateData.projectStatus?.conditions ?? [],
      };
    })
  );
  return { gates };
}

async function dataSonarQubeMeasures(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const metrics = 'bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density';
  const projectsRes = await fetch(`${url}/api/projects/search?ps=10`, { headers });
  const projectsData = await projectsRes.json() as { components?: Array<{ key: string }> };
  const projects = projectsData.components ?? [];
  const measures = await Promise.all(
    projects.slice(0, 5).map(async p => {
      const r = await fetch(`${url}/api/measures/component?component=${p.key}&metricKeys=${metrics}`, { headers });
      const d = await r.json() as { component?: { measures?: unknown[] } };
      return { component: p.key, measures: d.component?.measures ?? [] };
    })
  );
  return { measures };
}

async function dataSonarQubeIssues(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const r = await fetch(`${url}/api/issues/search?ps=50&statuses=OPEN,CONFIRMED&severities=BLOCKER,CRITICAL,MAJOR`, { headers });
  const d = await r.json() as { issues?: unknown[]; total?: number };
  return { issues: d.issues ?? [], total: d.total ?? 0 };
}

// ── Azure DevOps ──────────────────────────────────────────────────────────────
async function dataAzurePipelines(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token) throw new Error('AZURE_DEVOPS_ORG or AZURE_DEVOPS_TOKEN not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const proj = project ? `${project}/` : '';
  const r = await fetch(`https://dev.azure.com/${org}/${proj}_apis/pipelines/runs?api-version=7.0&$top=25`, { headers });
  const d = await r.json() as { value?: unknown[] };
  const runs = (d.value ?? []) as Array<Record<string, unknown>>;
  return { runs: runs.map(run => ({ ...run, project: project ?? org })) };
}

async function dataAzureReleases(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token || !project) throw new Error('AZURE_DEVOPS_ORG, AZURE_DEVOPS_TOKEN, or AZURE_DEVOPS_PROJECT not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const r = await fetch(`https://vsrm.dev.azure.com/${org}/${project}/_apis/release/releases?api-version=7.0&$top=25`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as { value?: unknown[] };
  return { releases: (d.value ?? []).map((rel: unknown) => ({ ...(rel as Record<string, unknown>), project })) };
}

async function dataAzureWorkItems(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token || !project) throw new Error('AZURE_DEVOPS_ORG, AZURE_DEVOPS_TOKEN, or AZURE_DEVOPS_PROJECT not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  const wiqlRes = await fetch(`https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] != 'Closed' ORDER BY [System.ChangedDate] DESC" }),
  });
  const wiqlData = await wiqlRes.json() as { workItems?: Array<{ id: number }> };
  const ids = (wiqlData.workItems ?? []).slice(0, 25).map(w => w.id);
  if (!ids.length) return { workItems: [] };
  const batchRes = await fetch(`https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.0`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids, fields: ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate'] }),
  });
  const batchData = await batchRes.json() as { value?: unknown[] };
  return { workItems: batchData.value ?? [] };
}

// ── npm ───────────────────────────────────────────────────────────────────────
async function dataNpmDownloads(): Promise<unknown> {
  const pkgsEnv = process.env['NPM_PACKAGES'];
  if (!pkgsEnv) throw new Error('NPM_PACKAGES not configured');
  const packages = pkgsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(
    packages.map(async pkg => {
      const r = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`);
      const d = await r.json() as { downloads?: number; package?: string; start?: string; end?: string; error?: string };
      if (d.error) return { package: pkg, downloads: 0, period: 'last-month', start: '', end: '' };
      return { package: d.package ?? pkg, downloads: d.downloads ?? 0, period: 'last-month', start: d.start ?? '', end: d.end ?? '' };
    })
  );
  return { packages: results };
}

// ── jsDelivr ──────────────────────────────────────────────────────────────────
async function dataJsDelivrStats(): Promise<unknown> {
  const pkgsEnv = process.env['JSDELIVR_PACKAGES'];
  if (!pkgsEnv) throw new Error('JSDELIVR_PACKAGES not configured');
  const packages = pkgsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(
    packages.map(async pkg => {
      const [type, name] = pkg.startsWith('gh/') ? ['gh', pkg.slice(3)] : ['npm', pkg];
      const r = await fetch(`https://data.jsdelivr.com/v1/stats/packages/${type}/${encodeURIComponent(name)}/year`);
      const d = await r.json() as { hits?: { total?: number; dates?: Record<string, number> }; bandwidth?: { total?: number; dates?: Record<string, number> } };
      return {
        name,
        type,
        hits: { total: d.hits?.total ?? 0, dates: d.hits?.dates ?? {} },
        bandwidth: { total: d.bandwidth?.total ?? 0, dates: d.bandwidth?.dates ?? {} },
      };
    })
  );
  return { packages: results };
}

// ── WakaTime ──────────────────────────────────────────────────────────────────
async function dataWakaTimeSummary(): Promise<unknown> {
  const apiKey = process.env['WAKATIME_API_KEY'];
  if (!apiKey) throw new Error('WAKATIME_API_KEY not configured');
  const auth = Buffer.from(apiKey).toString('base64');
  const r = await fetch('https://wakatime.com/api/v1/users/current/summaries?range=last_7_days', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as { data?: unknown[] };
  return { data: d.data ?? [] };
}

// ── Clockify ──────────────────────────────────────────────────────────────────
async function dataClockifyTimeEntries(): Promise<unknown> {
  const apiKey = process.env['CLOCKIFY_API_KEY'];
  const workspaceId = process.env['CLOCKIFY_WORKSPACE_ID'];
  const userId = process.env['CLOCKIFY_USER_ID'];
  if (!apiKey || !workspaceId) throw new Error('CLOCKIFY_API_KEY or CLOCKIFY_WORKSPACE_ID not configured');
  const headers = { 'X-Api-Key': apiKey };
  let uid = userId;
  if (!uid) {
    const meRes = await fetch('https://api.clockify.me/api/v1/user', { headers });
    const me = await meRes.json() as { id: string };
    uid = me.id;
  }
  const r = await fetch(`https://api.clockify.me/api/v1/workspaces/${workspaceId}/user/${uid}/time-entries?page-size=50`, { headers });
  const entries = await r.json() as unknown[];
  const projectNames = new Map<string, string>();
  const entriesWithNames = await Promise.all(
    (entries as Array<Record<string, unknown>>).slice(0, 20).map(async e => {
      const projId = e['projectId'] as string | undefined;
      if (projId && !projectNames.has(projId)) {
        try {
          const proj = await fetch(`https://api.clockify.me/api/v1/workspaces/${workspaceId}/projects/${projId}`, { headers });
          const projData = await proj.json() as { name: string };
          projectNames.set(projId, projData.name);
        } catch { /* skip */ }
      }
      return { ...e, projectName: projId ? projectNames.get(projId) : undefined };
    })
  );
  return { entries: entriesWithNames };
}

// ── Linear ────────────────────────────────────────────────────────────────────
async function dataLinearIssues(): Promise<unknown> {
  const apiKey = process.env['LINEAR_API_KEY'];
  if (!apiKey) throw new Error('LINEAR_API_KEY not configured');
  const query = `
    query {
      issues(first: 50, orderBy: updatedAt, filter: { state: { type: { nin: ["completed", "cancelled"] } } }) {
        nodes {
          id identifier title priority
          state { id name type color }
          assignee { id name email }
          team { id name key }
          createdAt updatedAt url
          labels { nodes { id name color } }
        }
      }
    }
  `;
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json() as { data?: { issues?: { nodes?: unknown[] } } };
  const raw = d.data?.issues?.nodes ?? [];
  const issues = (raw as Array<Record<string, unknown>>).map(i => ({
    ...i,
    labels: ((i['labels'] as { nodes?: unknown[] } | undefined)?.nodes ?? []),
  }));
  return { issues };
}

// ── Jira ──────────────────────────────────────────────────────────────────────
async function dataJiraIssues(): Promise<unknown> {
  const host = process.env['JIRA_HOST'];
  const email = process.env['JIRA_EMAIL'];
  const token = process.env['JIRA_API_TOKEN'];
  const jql = process.env['JIRA_JQL'] ?? 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  if (!host || !email || !token) throw new Error('JIRA_HOST, JIRA_EMAIL, or JIRA_API_TOKEN not configured');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const r = await fetch(`https://${host}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority,issuetype,assignee,reporter,created,updated,labels,fixVersions`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  const d = await r.json() as { issues?: unknown[]; total?: number };
  const issues = ((d.issues ?? []) as Array<Record<string, unknown>>).map(issue => ({
    ...issue,
    browseUrl: `https://${host}/browse/${issue['key'] as string}`,
  }));
  return { issues, total: d.total ?? 0 };
}

// ── Slack ─────────────────────────────────────────────────────────────────────
async function dataSlackMessages(): Promise<unknown> {
  const token = process.env['SLACK_BOT_TOKEN'];
  const channelsEnv = process.env['SLACK_CHANNELS'];
  if (!token) throw new Error('SLACK_BOT_TOKEN not configured');
  const headers = { Authorization: `Bearer ${token}` };
  const channels = channelsEnv ? channelsEnv.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!channels.length) {
    const listRes = await fetch('https://slack.com/api/conversations.list?limit=5&types=public_channel', { headers });
    const listData = await listRes.json() as { channels?: Array<{ id: string; name: string }> };
    const chans = listData.channels ?? [];
    channels.push(...chans.slice(0, 3).map(c => c.id));
  }
  const allMessages: unknown[] = [];
  for (const channel of channels.slice(0, 3)) {
    const r = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=20`, { headers });
    const d = await r.json() as { messages?: Array<Record<string, unknown>>; ok?: boolean };
    if (d.ok && d.messages) {
      allMessages.push(...d.messages.slice(0, 10).map(m => ({ ...m, channel })));
    }
  }
  return { messages: allMessages.slice(0, 30) };
}

// ── Discord ───────────────────────────────────────────────────────────────────
async function dataDiscordServerStats(): Promise<unknown> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const guildIds = process.env['DISCORD_GUILD_IDS'];
  if (!token) throw new Error('DISCORD_BOT_TOKEN not configured');
  const headers = { Authorization: `Bot ${token}` };
  const ids = guildIds ? guildIds.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!ids.length) {
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers });
    const guilds = await guildsRes.json() as Array<{ id: string }>;
    ids.push(...guilds.slice(0, 5).map(g => g.id));
  }
  const guilds = await Promise.all(
    ids.slice(0, 5).map(id =>
      fetch(`https://discord.com/api/v10/guilds/${id}?with_counts=true`, { headers }).then(r => r.json())
    )
  );
  return { guilds };
}

// ── Mailchimp ─────────────────────────────────────────────────────────────────
async function dataMailchimpCampaigns(): Promise<unknown> {
  const apiKey = process.env['MAILCHIMP_API_KEY'];
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY not configured');
  const server = apiKey.split('-').pop() ?? 'us1';
  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const r = await fetch(`https://${server}.api.mailchimp.com/3.0/campaigns?count=25&sort_field=send_time&sort_dir=DESC`, { headers });
  const d = await r.json() as { campaigns?: unknown[]; total_items?: number };
  return { campaigns: d.campaigns ?? [], total_items: d.total_items ?? 0 };
}

// ── GA4 ───────────────────────────────────────────────────────────────────────
let _ga4TokenCache: { token: string; expiry: number } | null = null;

async function getGA4AccessToken(): Promise<string> {
  if (_ga4TokenCache && Date.now() < _ga4TokenCache.expiry) return _ga4TokenCache.token;
  const serviceAccountJson = process.env['GA4_SERVICE_ACCOUNT_JSON'];
  if (!serviceAccountJson) throw new Error('GA4_SERVICE_ACCOUNT_JSON not configured');
  const sa = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const sigInput = `${headerB64}.${payloadB64}`;
  const keyPem = sa.private_key.replace(/\\n/g, '\n');
  const keyBuffer = Buffer.from(
    keyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''),
    'base64'
  );
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(sigInput));
  const sigB64 = Buffer.from(sig).toString('base64url');
  const jwt = `${sigInput}.${sigB64}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw new Error('Failed to get GA4 access token');
  _ga4TokenCache = { token: tokenData.access_token, expiry: Date.now() + (tokenData.expires_in ?? 3600) * 1000 - 60000 };
  return tokenData.access_token;
}

async function dataGA4Sessions(): Promise<unknown> {
  const propertyId = process.env['GA4_PROPERTY_ID'];
  if (!propertyId) throw new Error('GA4_PROPERTY_ID not configured');
  const token = await getGA4AccessToken();
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
    }),
  });
  const d = await r.json() as { rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> };
  const rows = d.rows ?? [];
  const sorted = rows.sort((a, b) => a.dimensionValues[0].value.localeCompare(b.dimensionValues[0].value));
  const dates = sorted.map(r => r.dimensionValues[0].value);
  const sessions = sorted.map(r => parseInt(r.metricValues[0].value));
  const users = sorted.map(r => parseInt(r.metricValues[1].value));
  const pageviews = sorted.map(r => parseInt(r.metricValues[2].value));
  const totals = {
    sessions: sessions.reduce((a, b) => a + b, 0),
    users: users.reduce((a, b) => a + b, 0),
    pageviews: pageviews.reduce((a, b) => a + b, 0),
  };
  return { trend: { dates, sessions, users, pageviews }, totals };
}

// ── Instatus ──────────────────────────────────────────────────────────────────
async function dataInstatusOverview(): Promise<unknown> {
  const pageId = process.env['INSTATUS_PAGE_ID'];
  const apiKey = process.env['INSTATUS_API_KEY'];
  if (!pageId) throw new Error('INSTATUS_PAGE_ID not configured');
  if (apiKey) {
    // Authenticated API
    const headers = { Authorization: `Bearer ${apiKey}` };
    const [pageRes, componentsRes, incidentsRes] = await Promise.all([
      fetch(`https://api.instatus.com/v1/${pageId}`, { headers }),
      fetch(`https://api.instatus.com/v1/${pageId}/components`, { headers }),
      fetch(`https://api.instatus.com/v1/${pageId}/incidents?status=INVESTIGATING,IDENTIFIED,MONITORING,IN_PROGRESS`, { headers }),
    ]);
    const [page, { components }, { incidents }] = await Promise.all([
      pageRes.json() as Promise<{ id: string; name: string; url: string; status: string }>,
      componentsRes.json() as Promise<{ components?: unknown[] }>,
      incidentsRes.json() as Promise<{ incidents?: unknown[] }>,
    ]);
    return {
      page: { id: page.id, name: page.name, url: page.url, status: page.status },
      components: components ?? [],
      activeIncidents: incidents ?? [],
      activeMaintenances: [],
    };
  } else {
    // Public summary.json
    const r = await fetch(`https://${pageId}.instatus.com/summary.json`);
    const d = await r.json() as {
      page?: { id: string; name: string; url: string; status: { indicator: string } };
      components?: unknown[];
      incidents?: unknown[];
    };
    return {
      page: { id: d.page?.id ?? '', name: d.page?.name ?? '', url: d.page?.url ?? '', status: d.page?.status.indicator ?? 'operational' },
      components: d.components ?? [],
      activeIncidents: d.incidents ?? [],
      activeMaintenances: [],
    };
  }
}

// ── HackerNews ────────────────────────────────────────────────────────────────
async function dataHNTopStories(): Promise<unknown> {
  const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const ids = await r.json() as number[];
  const top = ids.slice(0, 30);
  const stories = await Promise.all(
    top.map((id, rank) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r2 => r2.json())
        .then((s: unknown) => ({ ...(s as Record<string, unknown>), rank: rank + 1 }))
    )
  );
  return { stories };
}

// ── RSS Feed ─────────────────────────────────────────────────────────────────
const _rssCache = new Map<string, { data: unknown; ts: number }>();
const RSS_CACHE_MS = 5 * 60 * 1000;

function _rssTag(tag: string, chunk: string): string {
  const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

async function dataRssFeed(feedUrl: string, maxItems = 50): Promise<unknown> {
  const cacheKey = `${feedUrl}::${maxItems}`;
  const cached = _rssCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RSS_CACHE_MS) return cached.data;

  const r = await fetch(feedUrl, { headers: { 'User-Agent': 'TWM-Dashboard/1.0' } });
  if (!r.ok) throw new Error(`RSS fetch failed: ${r.status} ${r.statusText}`);
  const xml = await r.text();

  const isAtom = /<feed\b/i.test(xml);
  const itemTag = isAtom ? 'entry' : 'item';
  const feedTitle = _rssTag('title', xml.split(new RegExp(`<${itemTag}[\\s>]`))[0] ?? xml);

  const parts = xml.split(new RegExp(`<${itemTag}[\\s>]`)).slice(1);
  const clampedMax = Math.max(1, Math.min(200, maxItems));
  const items = parts.slice(0, clampedMax).map(part => {
    const chunk = `<${itemTag} ` + part;
    const title = _rssTag('title', chunk);
    // Atom uses <link href="..."/>, RSS uses <link>url</link>
    const linkHref = chunk.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? '';
    const linkText = _rssTag('link', chunk);
    const link = linkHref || linkText;
    const pubDate = _rssTag(isAtom ? 'published' : 'pubDate', chunk) || _rssTag('updated', chunk);
    const summary = _rssTag(isAtom ? 'summary' : 'description', chunk)
      .replace(/<[^>]+>/g, '').trim().slice(0, 220);
    return { title, link, pubDate, summary };
  }).filter(i => i.title);

  const data = { feedTitle: feedTitle || feedUrl, url: feedUrl, items, fetchedAt: new Date().toISOString() };
  _rssCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// ── Alpha Vantage ─────────────────────────────────────────────────────────────
let _avCache: unknown = null;
let _avCacheTime = 0;
let _avSparkCache: unknown = null;
let _avSparkCacheTime = 0;
let _avMktStatusCache: unknown = null;
let _avMktStatusCacheTime = 0;
let _avMoversCache: unknown = null;
let _avMoversCacheTime = 0;
let _avNewsCache: unknown = null;
let _avNewsCacheTime = 0;
let _avEarningsCache: unknown = null;
let _avEarningsCacheTime = 0;

async function dataAlphaVantageQuotes(): Promise<unknown> {
  const now = Date.now();
  if (_avCache && now - _avCacheTime < 3600000) return _avCache; // 1h cache
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const stocks: unknown[] = [];
  let rateLimit = false;
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // 12s delay (5/min limit)
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { rateLimit = true; continue; }
    const q = d['Global Quote'] as Record<string, string> | undefined;
    if (q) {
      stocks.push({
        symbol,
        quote: {
          symbol: q['01. symbol'],
          open: q['02. open'],
          high: q['03. high'],
          low: q['04. low'],
          price: q['05. price'],
          volume: q['06. volume'],
          latestTradingDay: q['07. latest trading day'],
          previousClose: q['08. previous close'],
          change: q['09. change'],
          changePercent: q['10. change percent'],
        },
        timeSeries: [],
      });
    }
  }
  const result = { stocks, rateLimit };
  _avCache = result;
  _avCacheTime = now;
  return result;
}

async function dataAvSparklines(): Promise<unknown> {
  const now = Date.now();
  if (_avSparkCache && now - _avSparkCacheTime < 3600000) return _avSparkCache; // 1h cache
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const sparklines: unknown[] = [];
  let rateLimit = false;
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // 12s delay (5/min limit)
    const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { rateLimit = true; continue; }
    const ts = d['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!ts) continue;
    const entries = Object.entries(ts)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([date, v]) => ({ date, close: parseFloat(v['4. close']) }));
    const latestPrice = entries[0]?.close ?? 0;
    const prevDay = entries[1]?.close ?? latestPrice;
    const prevWeek = entries[6]?.close ?? latestPrice;
    const change1d = prevDay !== 0 ? ((latestPrice - prevDay) / prevDay) * 100 : 0;
    const change1w = prevWeek !== 0 ? ((latestPrice - prevWeek) / prevWeek) * 100 : 0;
    sparklines.push({ symbol, series: entries, change1d, change1w, latestPrice });
  }
  const result = { sparklines, rateLimit };
  _avSparkCache = result;
  _avSparkCacheTime = now;
  return result;
}

async function dataAvMarketStatus(): Promise<unknown> {
  const now = Date.now();
  if (_avMktStatusCache && now - _avMktStatusCacheTime < 900000) return _avMktStatusCache; // 15m
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avMktStatusCache) return _avMktStatusCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = { markets: (d['markets'] as unknown[]) ?? [] };
  _avMktStatusCache = result;
  _avMktStatusCacheTime = now;
  return result;
}

async function dataAvMarketMovers(): Promise<unknown> {
  const now = Date.now();
  if (_avMoversCache && now - _avMoversCacheTime < 900000) return _avMoversCache; // 15m
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avMoversCache) return _avMoversCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = {
    last_updated: d['last_updated'] ?? '',
    top_gainers: (d['top_gainers'] as unknown[]) ?? [],
    top_losers: (d['top_losers'] as unknown[]) ?? [],
    most_actively_traded: (d['most_actively_traded'] as unknown[]) ?? [],
  };
  _avMoversCache = result;
  _avMoversCacheTime = now;
  return result;
}

async function dataAvNewsSentiment(): Promise<unknown> {
  const now = Date.now();
  if (_avNewsCache && now - _avNewsCacheTime < 3600000) return _avNewsCache; // 1h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const tickers = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).join(',');
  const tickerParam = tickers ? `&tickers=${tickers}` : '';
  const r = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT${tickerParam}&limit=20&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avNewsCache) return _avNewsCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = { feed: (d['feed'] as unknown[]) ?? [], sentiment_score_definition: d['sentiment_score_definition'] };
  _avNewsCache = result;
  _avNewsCacheTime = now;
  return result;
}

async function dataAvEarnings(): Promise<unknown> {
  const now = Date.now();
  if (_avEarningsCache && now - _avEarningsCacheTime < 21600000) return _avEarningsCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // rate limit
    const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { continue; }
    results.push({
      symbol,
      annualEarnings: ((d['annualEarnings'] as unknown[]) ?? []).slice(0, 5),
      quarterlyEarnings: ((d['quarterlyEarnings'] as unknown[]) ?? []).slice(0, 8),
    });
  }
  const result = { earnings: results };
  _avEarningsCache = result;
  _avEarningsCacheTime = now;
  return result;
}

let _avCalendarCache: unknown = null;
let _avCalendarCacheTime = 0;

async function dataAvEarningsCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_avCalendarCache && now - _avCalendarCacheTime < 86400000) return _avCalendarCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`);
  if (!r.ok) throw new Error(`AV earnings calendar error: ${r.status}`);
  const text = await r.text();
  // Parse CSV: first line is header, remaining lines are data
  const lines = text.trim().split('\n');
  const headers = lines[0]!.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const events = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  }).filter(e => e['symbol'] || e['name']);
  const result = { events: events.slice(0, 50) };
  _avCalendarCache = result;
  _avCalendarCacheTime = now;
  return result;
}

let _avFundaCache: unknown = null;
let _avFundaCacheTime = 0;

async function dataAvFundamentals(): Promise<unknown> {
  const now = Date.now();
  if (_avFundaCache && now - _avFundaCacheTime < 21600000) return _avFundaCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000));
    const r = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information'] || !d['Symbol']) continue;
    results.push({
      symbol,
      name: d['Name'],
      sector: d['Sector'],
      industry: d['Industry'],
      exchange: d['Exchange'],
      marketCap: d['MarketCapitalization'],
      peRatio: d['PERatio'],
      eps: d['EPS'],
      dividendYield: d['DividendYield'],
      week52High: d['52WeekHigh'],
      week52Low: d['52WeekLow'],
      analystTargetPrice: d['AnalystTargetPrice'],
      beta: d['Beta'],
      profitMargin: d['ProfitMargin'],
    });
  }
  const result = { companies: results };
  _avFundaCache = result;
  _avFundaCacheTime = now;
  return result;
}

let _avForexCache: unknown = null;
let _avForexCacheTime = 0;

async function dataAvForexRates(): Promise<unknown> {
  const now = Date.now();
  if (_avForexCache && now - _avForexCacheTime < 3600000) return _avForexCache; // 1h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const pairsEnv = process.env['AV_FOREX_PAIRS'] ?? 'EUR/USD,GBP/USD,USD/JPY';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const pairs = pairsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const pair of pairs) {
    await new Promise(r => setTimeout(r, 12000));
    const [from, to] = pair.split('/');
    if (!from || !to) continue;
    const r = await fetch(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const ts = d['Time Series FX (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!ts) continue;
    const entries = Object.entries(ts)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([date, v]) => ({ date, close: parseFloat(v['4. close'] ?? '0') }));
    const latest = entries[0];
    const prev = entries[1];
    const change = latest && prev ? latest.close - prev.close : 0;
    const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
    results.push({ pair, from, to, series: entries, currentRate: latest?.close ?? 0, change, changePct });
  }
  const result = { rates: results };
  _avForexCache = result;
  _avForexCacheTime = now;
  return result;
}

let _avCommodCache: unknown = null;
let _avCommodCacheTime = 0;

async function dataAvCommodities(): Promise<unknown> {
  const now = Date.now();
  if (_avCommodCache && now - _avCommodCacheTime < 21600000) return _avCommodCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const commodities = [
    { fn: 'WTI', name: 'WTI Crude Oil', unit: 'dollars per barrel' },
    { fn: 'BRENT', name: 'Brent Crude Oil', unit: 'dollars per barrel' },
    { fn: 'NATURAL_GAS', name: 'Natural Gas', unit: 'dollars per million BTU' },
    { fn: 'COPPER', name: 'Copper', unit: 'dollars per metric ton' },
    { fn: 'WHEAT', name: 'Wheat', unit: 'dollars per metric ton' },
  ];
  const results: unknown[] = [];
  for (const c of commodities) {
    await new Promise(r => setTimeout(r, 12000));
    const r = await fetch(`https://www.alphavantage.co/query?function=${c.fn}&interval=monthly&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const data = d['data'] as { date: string; value: string }[] | undefined;
    if (!data || data.length < 2) continue;
    const latest = data[0];
    const prev = data[1];
    const latestVal = parseFloat(latest?.value ?? '0');
    const prevVal = parseFloat(prev?.value ?? '0');
    const change = latestVal - prevVal;
    const changePct = prevVal ? (change / prevVal) * 100 : 0;
    results.push({
      name: c.name,
      unit: d['unit'] ?? c.unit,
      latestDate: latest?.date ?? '',
      latestValue: latestVal,
      prevValue: prevVal,
      change,
      changePct,
    });
  }
  const result = { commodities: results };
  _avCommodCache = result;
  _avCommodCacheTime = now;
  return result;
}

let _avEconCache: unknown = null;
let _avEconCacheTime = 0;

async function dataAvEconomicIndicators(): Promise<unknown> {
  const now = Date.now();
  if (_avEconCache && now - _avEconCacheTime < 86400000) return _avEconCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const indicators = [
    { fn: 'REAL_GDP', params: 'interval=annual', name: 'Real GDP', unit: 'billions of dollars' },
    { fn: 'INFLATION', params: '', name: 'Inflation (CPI YoY)', unit: 'percent' },
    { fn: 'UNEMPLOYMENT', params: '', name: 'Unemployment Rate', unit: 'percent' },
    { fn: 'CPI', params: 'interval=monthly', name: 'Consumer Price Index', unit: 'index' },
  ];
  const results: unknown[] = [];
  for (const ind of indicators) {
    await new Promise(r => setTimeout(r, 12000));
    const params = ind.params ? `&${ind.params}` : '';
    const r = await fetch(`https://www.alphavantage.co/query?function=${ind.fn}${params}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const data = d['data'] as { date: string; value: string }[] | undefined;
    if (!data || data.length < 2) continue;
    const latest = data[0];
    const prev = data[1];
    const latestVal = parseFloat(latest?.value ?? '0');
    const prevVal = parseFloat(prev?.value ?? '0');
    results.push({
      name: ind.name,
      unit: d['unit'] ?? ind.unit,
      interval: d['interval'] ?? '',
      latestDate: latest?.date ?? '',
      latestValue: latestVal,
      prevDate: prev?.date ?? '',
      prevValue: prevVal,
    });
  }
  const result = { indicators: results };
  _avEconCache = result;
  _avEconCacheTime = now;
  return result;
}

let _avInsiderCache: unknown = null;
let _avInsiderCacheTime = 0;

async function dataAvInsiderTransactions(): Promise<unknown> {
  const now = Date.now();
  if (_avInsiderCache && now - _avInsiderCacheTime < 86400000) return _avInsiderCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).join(',');
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=ANALYTICS_FIXED_WINDOW&SYMBOLS=${symbols}&RANGE=6month&OHLC=close&CALCULATIONS=PERCENT_CHANGE&apikey=${apiKey}`);
    if (!r.ok) {
      const result = { transactions: [], note: 'This endpoint requires Alpha Vantage Premium.' };
      _avInsiderCache = result;
      _avInsiderCacheTime = now;
      return result;
    }
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) {
      const result = { transactions: [], note: String(d['Note'] ?? d['Information'] ?? 'Premium endpoint required.') };
      _avInsiderCache = result;
      _avInsiderCacheTime = now;
      return result;
    }
    const payload = d['payload'] as unknown[] | undefined;
    const result = { transactions: payload ?? [], note: '' };
    _avInsiderCache = result;
    _avInsiderCacheTime = now;
    return result;
  } catch {
    return { transactions: [], note: 'Failed to fetch insider data.' };
  }
}

// ── CoinGecko ─────────────────────────────────────────────────────────────────
let _cgCache: unknown = null;
let _cgCacheTime = 0;
let _cgGlobalCache: unknown = null;
let _cgGlobalCacheTime = 0;

async function dataCoinGeckoMarkets(): Promise<unknown> {
  const now = Date.now();
  if (_cgCache && now - _cgCacheTime < 300000) return _cgCache; // 5m cache
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin,ethereum,solana,cardano,polkadot';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).join(',');
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coins}&order=market_cap_desc&per_page=20&page=1&sparkline=false`);
  if (r.status === 429) {
    if (_cgCache) return _cgCache; // fallback to stale cache
    throw new Error('CoinGecko rate limit reached');
  }
  const data = await r.json() as unknown[];
  const result = { coins: data };
  _cgCache = result;
  _cgCacheTime = now;
  return result;
}

async function dataCoinGeckoGlobal(): Promise<unknown> {
  const now = Date.now();
  if (_cgGlobalCache && now - _cgGlobalCacheTime < 600000) return _cgGlobalCache; // 10m cache
  const r = await fetch('https://api.coingecko.com/api/v3/global');
  if (r.status === 429) {
    if (_cgGlobalCache) return _cgGlobalCache;
    throw new Error('CoinGecko rate limit reached');
  }
  const d = await r.json() as { data?: Record<string, unknown> };
  const result = { global: d.data ?? {} };
  _cgGlobalCache = result;
  _cgGlobalCacheTime = now;
  return result;
}

let _cgTrendingCache: unknown = null;
let _cgTrendingCacheTime = 0;

async function dataCoinGeckoTrending(): Promise<unknown> {
  const now = Date.now();
  if (_cgTrendingCache && now - _cgTrendingCacheTime < 900000) return _cgTrendingCache; // 15m
  const r = await fetch('https://api.coingecko.com/api/v3/search/trending');
  if (r.status === 429) {
    if (_cgTrendingCache) return _cgTrendingCache;
    throw new Error('CoinGecko rate limit');
  }
  if (!r.ok) throw new Error(`CoinGecko trending error: ${r.status}`);
  const d = await r.json() as { coins?: { item: Record<string, unknown> }[] };
  const trending = (d.coins ?? []).slice(0, 7).map((c) => c.item);
  const result = { trending };
  _cgTrendingCache = result;
  _cgTrendingCacheTime = now;
  return result;
}

let _cgChartCache: unknown = null;
let _cgChartCacheTime = 0;

async function dataCoinGeckoPriceChart(): Promise<unknown> {
  const now = Date.now();
  if (_cgChartCache && now - _cgChartCacheTime < 600000) return _cgChartCache; // 10m
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin,ethereum';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const charts: unknown[] = [];
  for (const coinId of coins) {
    if (charts.length > 0) await new Promise(r => setTimeout(r, 2000)); // rate limit delay
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
    if (r.status === 429) { if (_cgChartCache) return _cgChartCache; break; }
    if (!r.ok) continue;
    const d = await r.json() as { prices?: [number, number][] };
    const prices = (d.prices ?? []).map(([ts, price]) => ({ ts, price }));
    charts.push({ coinId, prices });
  }
  const result = { charts };
  _cgChartCache = result;
  _cgChartCacheTime = now;
  return result;
}

let _cgDefiCache: unknown = null;
let _cgDefiCacheTime = 0;

async function dataCoinGeckoDefi(): Promise<unknown> {
  const now = Date.now();
  if (_cgDefiCache && now - _cgDefiCacheTime < 600000) return _cgDefiCache; // 10m
  const r = await fetch('https://api.coingecko.com/api/v3/global/decentralized_finance_defi');
  if (r.status === 429) { if (_cgDefiCache) return _cgDefiCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko DeFi error: ${r.status}`);
  const d = await r.json() as { data?: Record<string, unknown> };
  const result = { defi: d.data ?? {} };
  _cgDefiCache = result;
  _cgDefiCacheTime = now;
  return result;
}

let _cgCatCache: unknown = null;
let _cgCatCacheTime = 0;

async function dataCoinGeckoCategories(): Promise<unknown> {
  const now = Date.now();
  if (_cgCatCache && now - _cgCatCacheTime < 1800000) return _cgCatCache; // 30m
  const r = await fetch('https://api.coingecko.com/api/v3/coins/categories?order=market_cap_desc');
  if (r.status === 429) { if (_cgCatCache) return _cgCatCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko categories error: ${r.status}`);
  const d = await r.json() as unknown[];
  const result = { categories: d.slice(0, 20) };
  _cgCatCache = result;
  _cgCatCacheTime = now;
  return result;
}

let _cgExchCache: unknown = null;
let _cgExchCacheTime = 0;

async function dataCoinGeckoExchanges(): Promise<unknown> {
  const now = Date.now();
  if (_cgExchCache && now - _cgExchCacheTime < 1800000) return _cgExchCache; // 30m
  const r = await fetch('https://api.coingecko.com/api/v3/exchanges?per_page=10&page=1');
  if (r.status === 429) { if (_cgExchCache) return _cgExchCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko exchanges error: ${r.status}`);
  const d = await r.json() as unknown[];
  const result = { exchanges: d.slice(0, 10) };
  _cgExchCache = result;
  _cgExchCacheTime = now;
  return result;
}

let _cgDetailCache: unknown = null;
let _cgDetailCacheTime = 0;

async function dataCoinGeckoCoinDetail(): Promise<unknown> {
  const now = Date.now();
  if (_cgDetailCache && now - _cgDetailCacheTime < 300000) return _cgDetailCache; // 5m
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const details: unknown[] = [];
  for (const coinId of coins) {
    if (details.length > 0) await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`);
    if (r.status === 429) { if (_cgDetailCache) return _cgDetailCache; break; }
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    const mktData = d['market_data'] as Record<string, unknown> | undefined;
    details.push({
      id: d['id'],
      name: d['name'],
      symbol: d['symbol'],
      description: (d['description'] as Record<string, string> | undefined)?.['en']?.slice(0, 200) ?? '',
      image: (d['image'] as Record<string, string> | undefined)?.['small'] ?? '',
      currentPrice: (mktData?.['current_price'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      marketCap: (mktData?.['market_cap'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      priceChange24h: mktData?.['price_change_percentage_24h'] ?? 0,
      high24h: (mktData?.['high_24h'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      low24h: (mktData?.['low_24h'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      ath: (mktData?.['ath'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      athDate: (mktData?.['ath_date'] as Record<string, string> | undefined)?.['usd'] ?? '',
      rank: d['market_cap_rank'] ?? 0,
    });
  }
  const result = { details };
  _cgDetailCache = result;
  _cgDetailCacheTime = now;
  return result;
}

// ── Finnhub ───────────────────────────────────────────────────────────────────
async function dataFinnhubQuotes(): Promise<unknown> {
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  const quotes = await Promise.all(
    symbols.map(symbol =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`)
        .then(r => r.json())
        .then((q: unknown) => ({ ...(q as Record<string, unknown>), symbol }))
    )
  );
  return { quotes };
}

async function dataFinnhubNews(): Promise<unknown> {
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const category = process.env['FH_NEWS_CATEGORY'] ?? 'general';
  const r = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub news error: ${r.status}`);
  const items = await r.json() as unknown[];
  return { news: (items as unknown[]).slice(0, 30) };
}

let _fhCompanyNewsCache: unknown = null;
let _fhCompanyNewsCacheTime = 0;

async function dataFinnhubCompanyNews(): Promise<unknown> {
  const now = Date.now();
  if (_fhCompanyNewsCache && now - _fhCompanyNewsCacheTime < 300000) return _fhCompanyNewsCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const allNews: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${token}`);
    if (!r.ok) continue;
    const news = await r.json() as unknown[];
    allNews.push(...news.slice(0, 5));
  }
  allNews.sort((a, b) => ((b as Record<string, number>)['datetime'] ?? 0) - ((a as Record<string, number>)['datetime'] ?? 0));
  const result = { news: allNews.slice(0, 30) };
  _fhCompanyNewsCache = result;
  _fhCompanyNewsCacheTime = now;
  return result;
}

let _fhMktNewsCache: unknown = null;
let _fhMktNewsCacheTime = 0;

async function dataFinnhubMarketNews(): Promise<unknown> {
  const now = Date.now();
  if (_fhMktNewsCache && now - _fhMktNewsCacheTime < 300000) return _fhMktNewsCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const categories = ['general', 'forex', 'crypto'];
  const byCategory: Record<string, unknown[]> = {};
  for (const cat of categories) {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=${cat}&minId=0&token=${token}`);
    if (!r.ok) continue;
    const news = await r.json() as unknown[];
    byCategory[cat] = news.slice(0, 10);
  }
  const result = { byCategory };
  _fhMktNewsCache = result;
  _fhMktNewsCacheTime = now;
  return result;
}

let _fhEarnCalCache: unknown = null;
let _fhEarnCalCacheTime = 0;

async function dataFinnhubEarningsCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_fhEarnCalCache && now - _fhEarnCalCacheTime < 3600000) return _fhEarnCalCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${nextMonth}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub earnings calendar error: ${r.status}`);
  const d = await r.json() as { earningsCalendar?: unknown[] };
  const result = { calendar: (d.earningsCalendar ?? []).slice(0, 30) };
  _fhEarnCalCache = result;
  _fhEarnCalCacheTime = now;
  return result;
}

let _fhEarnSurpCache: unknown = null;
let _fhEarnSurpCacheTime = 0;

async function dataFinnhubEarningsSurprises(): Promise<unknown> {
  const now = Date.now();
  if (_fhEarnSurpCache && now - _fhEarnSurpCacheTime < 3600000) return _fhEarnSurpCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=4&token=${token}`);
    if (!r.ok) continue;
    const data = await r.json() as unknown[];
    if (Array.isArray(data) && data.length > 0) results.push({ symbol, quarters: data.slice(0, 4) });
  }
  const result = { surprises: results };
  _fhEarnSurpCache = result;
  _fhEarnSurpCacheTime = now;
  return result;
}

let _fhAnalysisCache: unknown = null;
let _fhAnalysisCacheTime = 0;

async function dataFinnhubAnalystConsensus(): Promise<unknown> {
  const now = Date.now();
  if (_fhAnalysisCache && now - _fhAnalysisCacheTime < 3600000) return _fhAnalysisCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const data = await r.json() as unknown[];
    if (Array.isArray(data) && data.length > 0) results.push({ symbol, recommendation: data[0] });
  }
  const result = { consensus: results };
  _fhAnalysisCache = result;
  _fhAnalysisCacheTime = now;
  return result;
}

let _fhFundaCache: unknown = null;
let _fhFundaCacheTime = 0;

async function dataFinnhubFundamentals(): Promise<unknown> {
  const now = Date.now();
  if (_fhFundaCache && now - _fhFundaCacheTime < 3600000) return _fhFundaCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { metric?: Record<string, unknown> };
    if (d.metric) {
      const m = d.metric;
      results.push({
        symbol,
        peNormalizedAnnual: m['peNormalizedAnnual'] ?? null,
        pbAnnual: m['pbAnnual'] ?? null,
        psTTM: m['psTTM'] ?? null,
        epsBasicExclExtraItemsAnnual: m['epsBasicExclExtraItemsAnnual'] ?? null,
        roaRfy: m['roaRfy'] ?? null,
        roeRfy: m['roeRfy'] ?? null,
        debtEquityAnnual: m['debtEquityAnnual'] ?? null,
        dividendYieldIndicatedAnnual: m['dividendYieldIndicatedAnnual'] ?? null,
        '52WeekHigh': m['52WeekHigh'] ?? null,
        '52WeekLow': m['52WeekLow'] ?? null,
        beta: m['beta'] ?? null,
        marketCapitalization: m['marketCapitalization'] ?? null,
      });
    }
  }
  const result = { fundamentals: results };
  _fhFundaCache = result;
  _fhFundaCacheTime = now;
  return result;
}

let _fhMktStatusCache: unknown = null;
let _fhMktStatusCacheTime = 0;

async function dataFinnhubMarketStatus(): Promise<unknown> {
  const now = Date.now();
  if (_fhMktStatusCache && now - _fhMktStatusCacheTime < 300000) return _fhMktStatusCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const exchanges = ['US', 'LSE', 'TSX', 'EURONEXT'];
  const statuses: unknown[] = [];
  for (const exchange of exchanges) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=${exchange}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    statuses.push({ exchange, ...d });
  }
  const result = { statuses };
  _fhMktStatusCache = result;
  _fhMktStatusCacheTime = now;
  return result;
}

let _fhInsiderTxCache: unknown = null;
let _fhInsiderTxCacheTime = 0;

async function dataFinnhubInsiderTransactions(): Promise<unknown> {
  const now = Date.now();
  if (_fhInsiderTxCache && now - _fhInsiderTxCacheTime < 3600000) return _fhInsiderTxCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { data?: unknown[] };
    const txList = (d.data ?? []).slice(0, 10);
    results.push({ symbol, transactions: txList });
  }
  const result = { symbols: results };
  _fhInsiderTxCache = result;
  _fhInsiderTxCacheTime = now;
  return result;
}

let _fhInsiderSentCache: unknown = null;
let _fhInsiderSentCacheTime = 0;

async function dataFinnhubInsiderSentiment(): Promise<unknown> {
  const now = Date.now();
  if (_fhInsiderSentCache && now - _fhInsiderSentCacheTime < 3600000) return _fhInsiderSentCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = new Date().toISOString().slice(0, 10);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { data?: unknown[]; symbol?: string };
    const dataArr = d.data ?? [];
    const latest = dataArr.length > 0 ? dataArr[dataArr.length - 1] : null;
    results.push({ symbol, data: dataArr, latest });
  }
  const result = { sentiments: results };
  _fhInsiderSentCache = result;
  _fhInsiderSentCacheTime = now;
  return result;
}

let _fhIpoCache: unknown = null;
let _fhIpoCacheTime = 0;

async function dataFinnhubIpoCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_fhIpoCache && now - _fhIpoCacheTime < 3600000) return _fhIpoCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${today}&to=${nextMonth}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub IPO calendar error: ${r.status}`);
  const d = await r.json() as { ipoCalendar?: unknown[] };
  const result = { ipos: (d.ipoCalendar ?? []).slice(0, 20) };
  _fhIpoCache = result;
  _fhIpoCacheTime = now;
  return result;
}

let _fhFilingsCache: unknown = null;
let _fhFilingsCacheTime = 0;

async function dataFinnhubSecFilings(): Promise<unknown> {
  const now = Date.now();
  if (_fhFilingsCache && now - _fhFilingsCacheTime < 3600000) return _fhFilingsCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-K,10-Q,8-K&limit=5&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as unknown[];
    results.push({ symbol, filings: d.slice(0, 5) });
  }
  const result = { symbols: results };
  _fhFilingsCache = result;
  _fhFilingsCacheTime = now;
  return result;
}

let _fhProfileCache: unknown = null;
let _fhProfileCacheTime = 0;

async function dataFinnhubCompanyProfile(): Promise<unknown> {
  const now = Date.now();
  if (_fhProfileCache && now - _fhProfileCacheTime < 21600000) return _fhProfileCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    if (d['ticker']) results.push(d);
  }
  const result = { profiles: results };
  _fhProfileCache = result;
  _fhProfileCacheTime = now;
  return result;
}

// ── Plaid ─────────────────────────────────────────────────────────────────────
async function dataPlaidAccounts(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/accounts/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { accounts?: unknown[] };
  return { accounts: d.accounts ?? [] };
}

async function dataPlaidTransactions(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken, start_date: startDate, end_date: endDate, options: { count: 50, offset: 0 } }),
  });
  const d = await r.json() as { transactions?: unknown[] };
  return { transactions: d.transactions ?? [] };
}

// ── Plaid Extended ────────────────────────────────────────────────────────────
let _plaidHoldingsCache: { data: unknown; ts: number } | null = null;
async function dataPlaidInvestmentPortfolio(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidHoldingsCache && Date.now() - _plaidHoldingsCache.ts < 600_000) return _plaidHoldingsCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/investments/holdings/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { holdings?: { account_id: string; security_id: string; quantity: number; institution_price: number; institution_value: number; cost_basis?: number }[]; securities?: { security_id: string; name: string; ticker_symbol?: string; type?: string; close_price?: number }[]; accounts?: unknown[] };
  const holdings = d.holdings ?? [];
  const securitiesMap = new Map((d.securities ?? []).map(s => [s.security_id, s]));
  const enriched = holdings.map(h => {
    const sec = securitiesMap.get(h.security_id);
    return {
      account_id: h.account_id,
      security_id: h.security_id,
      name: sec?.name ?? h.security_id,
      ticker_symbol: sec?.ticker_symbol ?? '',
      type: sec?.type ?? '',
      quantity: h.quantity,
      institution_price: h.institution_price,
      institution_value: h.institution_value,
      cost_basis: h.cost_basis ?? 0,
      unrealized_gain: h.institution_value - (h.cost_basis ?? 0),
    };
  }).sort((a, b) => b.institution_value - a.institution_value);
  const data = { holdings: enriched };
  _plaidHoldingsCache = { data, ts: Date.now() };
  return data;
}

let _plaidInvTxCache: { data: unknown; ts: number } | null = null;
async function dataPlaidInvestmentTransactions(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidInvTxCache && Date.now() - _plaidInvTxCache.ts < 600_000) return _plaidInvTxCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/investments/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken, start_date: startDate, end_date: endDate }),
  });
  const d = await r.json() as { investment_transactions?: { investment_transaction_id: string; account_id: string; security_id?: string; date: string; name: string; quantity: number; amount: number; fees?: number; type: string; subtype: string }[]; securities?: { security_id: string; name: string; ticker_symbol?: string }[] };
  const securitiesMap = new Map((d.securities ?? []).map(s => [s.security_id, s]));
  const txs = (d.investment_transactions ?? []).map(tx => ({
    ...tx,
    ticker_symbol: securitiesMap.get(tx.security_id ?? '')?.ticker_symbol ?? '',
  })).sort((a, b) => b.date.localeCompare(a.date));
  const data = { transactions: txs };
  _plaidInvTxCache = { data, ts: Date.now() };
  return data;
}

let _plaidLiabCache: { data: unknown; ts: number } | null = null;
async function dataPlaidLiabilities(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidLiabCache && Date.now() - _plaidLiabCache.ts < 1_800_000) return _plaidLiabCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { credit?: { account_id: string; balances?: { current?: number } }[]; mortgage?: { account_id: string; balances?: { current?: number } }[]; student?: { account_id: string; balances?: { current?: number } }[] }; accounts?: { account_id: string; name: string; balances?: { current?: number; limit?: number } }[] };
  const liab = d.liabilities ?? {};
  const creditTotal = (liab.credit ?? []).reduce((s, c) => s + (c.balances?.current ?? 0), 0);
  const mortgageTotal = (liab.mortgage ?? []).reduce((s, m) => s + (m.balances?.current ?? 0), 0);
  const studentTotal = (liab.student ?? []).reduce((s, st) => s + (st.balances?.current ?? 0), 0);
  const totalOwed = creditTotal + mortgageTotal + studentTotal;
  const accounts = (d.accounts ?? []).map(a => ({ account_id: a.account_id, name: a.name, balance: a.balances?.current ?? 0 }));
  const data = { totalOwed, byType: { credit: creditTotal, mortgage: mortgageTotal, student: studentTotal }, accounts };
  _plaidLiabCache = { data, ts: Date.now() };
  return data;
}

let _plaidCCCache: { data: unknown; ts: number } | null = null;
async function dataPlaidCreditCards(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidCCCache && Date.now() - _plaidCCCache.ts < 1_800_000) return _plaidCCCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { credit?: { account_id: string; balances?: { current?: number; limit?: number }; last_statement_balance?: number; last_payment_date?: string; last_payment_amount?: number; minimum_payment_amount?: number; next_payment_due_date?: string; is_overdue?: boolean }[] }; accounts?: { account_id: string; name: string }[] };
  const accountNames = new Map((d.accounts ?? []).map(a => [a.account_id, a.name]));
  const cards = (d.liabilities?.credit ?? []).map(cc => {
    const current = cc.balances?.current ?? 0;
    const limit = cc.balances?.limit ?? 0;
    const utilization = limit > 0 ? Math.round((current / limit) * 100) : 0;
    return {
      account_id: cc.account_id,
      name: accountNames.get(cc.account_id) ?? cc.account_id,
      current,
      limit,
      utilization,
      last_statement_balance: cc.last_statement_balance ?? 0,
      last_payment_date: cc.last_payment_date ?? '',
      last_payment_amount: cc.last_payment_amount ?? 0,
      minimum_payment_amount: cc.minimum_payment_amount ?? 0,
      next_payment_due_date: cc.next_payment_due_date ?? '',
      is_overdue: cc.is_overdue ?? false,
    };
  });
  const data = { cards };
  _plaidCCCache = { data, ts: Date.now() };
  return data;
}

let _plaidMortgCache: { data: unknown; ts: number } | null = null;
async function dataPlaidMortgage(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidMortgCache && Date.now() - _plaidMortgCache.ts < 3_600_000) return _plaidMortgCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { mortgage?: { account_id: string; origination_principal_amount?: number; outstanding_principal_balance?: number; last_payment_amount?: number; last_payment_date?: string; current_late_fee?: number; maturity_date?: string; interest_rate?: { percentage?: number; type?: string }; next_payment_due_date?: string; next_monthly_payment?: number; property_address?: { city?: string; state?: string } }[] } };
  const mortgages = (d.liabilities?.mortgage ?? []).map(m => ({
    account_id: m.account_id,
    origination_principal_amount: m.origination_principal_amount ?? 0,
    outstanding_principal_balance: m.outstanding_principal_balance ?? 0,
    last_payment_amount: m.last_payment_amount ?? 0,
    last_payment_date: m.last_payment_date ?? '',
    current_late_fee: m.current_late_fee ?? 0,
    maturity_date: m.maturity_date ?? '',
    interest_rate_percentage: m.interest_rate?.percentage ?? 0,
    interest_rate_type: m.interest_rate?.type ?? '',
    next_payment_due_date: m.next_payment_due_date ?? '',
    next_monthly_payment: m.next_monthly_payment ?? 0,
    city: m.property_address?.city ?? '',
    state: m.property_address?.state ?? '',
  }));
  const data = { mortgages };
  _plaidMortgCache = { data, ts: Date.now() };
  return data;
}

let _plaidStmtCache: { data: unknown; ts: number } | null = null;
async function dataPlaidStatements(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidStmtCache && Date.now() - _plaidStmtCache.ts < 3_600_000) return _plaidStmtCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  try {
    const r = await fetch(`${baseUrl}/statements/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    });
    if (!r.ok) {
      const data = { accounts: [], note: 'Statements not available in this Plaid environment.' };
      _plaidStmtCache = { data, ts: Date.now() };
      return data;
    }
    const d = await r.json() as { accounts?: { account_id: string; account_name: string; statements?: { statement_id: string; month: number; year: number; pdf_url?: string }[] }[] };
    const data = { accounts: d.accounts ?? [], note: '' };
    _plaidStmtCache = { data, ts: Date.now() };
    return data;
  } catch {
    const data = { accounts: [], note: 'Statements not available in sandbox mode.' };
    _plaidStmtCache = { data, ts: Date.now() };
    return data;
  }
}

// ── HIBP ──────────────────────────────────────────────────────────────────────
async function dataHibpBreaches(): Promise<unknown> {
  const apiKey = process.env['HIBP_API_KEY'];
  const emailsEnv = process.env['HIBP_EMAILS'];
  if (!apiKey || !emailsEnv) throw new Error('HIBP_API_KEY or HIBP_EMAILS not configured');
  const emails = emailsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results: unknown[] = [];
  for (const email of emails) {
    await new Promise(r => setTimeout(r, 1600)); // 1.6s between requests
    const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: { 'hibp-api-key': apiKey, 'User-Agent': 'TWM-Dashboard' },
    });
    if (r.status === 404) { results.push({ email, breaches: [] }); continue; }
    if (!r.ok) continue;
    const breaches = await r.json() as unknown[];
    results.push({ email, breaches });
  }
  return { results };
}

// ── VirusTotal ────────────────────────────────────────────────────────────────
async function dataVirusTotalAnalyses(): Promise<unknown> {
  const apiKey = process.env['VIRUSTOTAL_API_KEY'];
  const domainsEnv = process.env['VT_DOMAINS'];
  if (!apiKey || !domainsEnv) throw new Error('VIRUSTOTAL_API_KEY or VT_DOMAINS not configured');
  const domains = domainsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results: unknown[] = [];
  for (const domain of domains) {
    await new Promise(r => setTimeout(r, 15000)); // 15s between requests (4/min limit)
    const r = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': apiKey },
    });
    if (!r.ok) continue;
    const d = await r.json() as { data?: { attributes?: Record<string, unknown> } };
    const attrs = d.data?.attributes ?? {};
    results.push({
      domain,
      stats: attrs['last_analysis_stats'] ?? { harmless: 0, malicious: 0, suspicious: 0, undetected: 0, timeout: 0 },
      reputation: attrs['reputation'] ?? 0,
      last_analysis_date: attrs['last_analysis_date'] ?? 0,
      categories: attrs['categories'],
      country: attrs['country'],
    });
  }
  return { results };
}

// ── Shodan ────────────────────────────────────────────────────────────────────
async function dataShodanSearch(): Promise<unknown> {
  const apiKey = process.env['SHODAN_API_KEY'];
  const query = process.env['SHODAN_QUERY'] ?? 'apache';
  if (!apiKey) throw new Error('SHODAN_API_KEY not configured');
  const r = await fetch(`https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(query)}&minify=true`);
  const d = await r.json() as { matches?: unknown[]; total?: number };
  return { results: { matches: d.matches ?? [], total: d.total ?? 0 } };
}

// ── WooCommerce ───────────────────────────────────────────────────────────────
async function dataWooCommerceOrders(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/orders?per_page=25&orderby=date&order=desc`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const orders = await r.json() as unknown[];
  return { orders };
}

async function dataWooSalesSummary(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/reports/sales?date_min=${startDate}&date_max=${endDate}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as unknown[];
  return { summary: Array.isArray(d) ? (d[0] ?? {}) : {} };
}

async function dataWooTopSellers(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/reports/top_sellers?period=month&number=20`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as unknown[];
  return { sellers: Array.isArray(d) ? d : [] };
}

// ── Shopify ───────────────────────────────────────────────────────────────────
async function dataShopifyOrders(): Promise<unknown> {
  const shop = process.env['SHOPIFY_SHOP'];
  const accessToken = process.env['SHOPIFY_ACCESS_TOKEN'];
  if (!shop || !accessToken) throw new Error('SHOPIFY_SHOP or SHOPIFY_ACCESS_TOKEN not configured');
  const r = await fetch(`https://${shop}/admin/api/2024-07/orders.json?limit=25&status=any`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  const d = await r.json() as { orders?: unknown[] };
  return { orders: d.orders ?? [] };
}

async function dataShopifyProducts(): Promise<unknown> {
  const shop = process.env['SHOPIFY_SHOP'];
  const accessToken = process.env['SHOPIFY_ACCESS_TOKEN'];
  if (!shop || !accessToken) throw new Error('SHOPIFY_SHOP or SHOPIFY_ACCESS_TOKEN not configured');
  const r = await fetch(`https://${shop}/admin/api/2024-07/products.json?limit=25&status=active`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  const d = await r.json() as { products?: unknown[] };
  return { products: d.products ?? [] };
}

// ── Reddit ────────────────────────────────────────────────────────────────────
async function dataRedditPosts(): Promise<unknown> {
  const subredditsEnv = process.env['REDDIT_SUBREDDITS'];
  const keywordsEnv = process.env['REDDIT_KEYWORDS'];
  if (!subredditsEnv && !keywordsEnv) throw new Error('REDDIT_SUBREDDITS or REDDIT_KEYWORDS not configured');
  const headers = { 'User-Agent': 'TWM-Dashboard/1.0' };
  const allPosts: unknown[] = [];
  if (subredditsEnv) {
    const subreddits = subredditsEnv.split(',').map(s => s.trim()).filter(Boolean);
    for (const sub of subreddits.slice(0, 3)) {
      const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, { headers });
      const d = await r.json() as { data?: { children?: Array<{ data: unknown }> } };
      allPosts.push(...(d.data?.children ?? []).map(c => c.data));
      await new Promise(r2 => setTimeout(r2, 1000));
    }
  }
  return { posts: allPosts.slice(0, 40) };
}

// ── Product Hunt ──────────────────────────────────────────────────────────────
async function dataProductHuntLaunches(): Promise<unknown> {
  const token = process.env['PRODUCTHUNT_API_TOKEN'];
  if (!token) throw new Error('PRODUCTHUNT_API_TOKEN not configured');
  const query = `
    query {
      posts(order: VOTES, first: 20) {
        edges {
          node {
            id name tagline description votesCount commentsCount
            createdAt featuredAt url website
            thumbnail { url }
            topics { edges { node { name } } }
            user { name username }
          }
        }
      }
    }
  `;
  const r = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json() as { data?: { posts?: { edges?: Array<{ node: unknown }> } } };
  const posts = (d.data?.posts?.edges ?? []).map(e => e.node);
  return { posts };
}

// ── Server-side resource pollers ──────────────────────────────────────────────

/**
 * Maps every SSE channel name to the env vars required to enable it.
 * Used at startup to broadcast `env-status` so tiles can show a friendly
 * "missing configuration" banner instead of a perpetual loading state.
 */
const CHANNEL_ENV_MAP: Record<string, string[]> = {
  // Payments
  'stripe-payments':       ['STRIPE_SECRET_KEY'],
  'stripe-orders':         ['STRIPE_SECRET_KEY'],
  'stripe-products':       ['STRIPE_SECRET_KEY'],
  'stripe-subscriptions':  ['STRIPE_SECRET_KEY'],
  'stripe-customers':      ['STRIPE_SECRET_KEY'],
  'stripe-invoices':       ['STRIPE_SECRET_KEY'],
  'stripe-refunds':        ['STRIPE_SECRET_KEY'],
  'stripe-revenue':        ['STRIPE_SECRET_KEY'],
  'stripe-webhooks':       ['STRIPE_SECRET_KEY'],
  'paypal-data':           ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'],
  // Deployments
  'vercel-deployments':    ['VERCEL_TOKEN'],
  'netlify-deployments':   ['NETLIFY_TOKEN'],
  // CI
  'github-runs':           ['GITHUB_TOKEN', 'GITHUB_ORG or GITHUB_USER'],
  'circleci-pipelines':    ['CIRCLECI_TOKEN', 'CIRCLECI_ORG_SLUG'],
  'circleci-insights':     ['CIRCLECI_TOKEN', 'CIRCLECI_ORG_SLUG'],
  'travis-builds':         ['TRAVIS_TOKEN', 'TRAVIS_ORG'],
  'bitrise-builds':        ['BITRISE_TOKEN'],
  'dockerhub-repositories':['DOCKERHUB_USERNAME'],
  'sonarqube-quality':     ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'sonarqube-measures':    ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'sonarqube-issues':      ['SONARQUBE_URL', 'SONARQUBE_TOKEN'],
  'azuredevops-pipelines': ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN'],
  'azuredevops-releases':  ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PROJECT'],
  'azuredevops-workitems': ['AZURE_DEVOPS_ORG', 'AZURE_DEVOPS_TOKEN', 'AZURE_DEVOPS_PROJECT'],
  'cf-pages':              ['CF_API_TOKEN', 'CF_ACCOUNT_ID'],
  'cf-workers':            ['CF_API_TOKEN', 'CF_ACCOUNT_ID'],
  // Packages
  'npm-downloads':         ['NPM_PACKAGES'],
  'jsdelivr-hits':         ['JSDELIVR_PACKAGES'],
  // Productivity
  'wakatime-summary':      ['WAKATIME_API_KEY'],
  'wakatime-languages':    ['WAKATIME_API_KEY'],
  'wakatime-projects':     ['WAKATIME_API_KEY'],
  'clockify-time-entries': ['CLOCKIFY_API_KEY', 'CLOCKIFY_WORKSPACE_ID'],
  'clockify-projects':     ['CLOCKIFY_API_KEY', 'CLOCKIFY_WORKSPACE_ID'],
  'linear-issues':         ['LINEAR_API_KEY'],
  'linear-cycles':         ['LINEAR_API_KEY'],
  'linear-teams':          ['LINEAR_API_KEY'],
  'jira-issues':           ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  'jira-sprint':           ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  'jira-projects':         ['JIRA_HOST', 'JIRA_EMAIL', 'JIRA_API_TOKEN'],
  // Comms
  'slack-messages':        ['SLACK_BOT_TOKEN'],
  'slack-workspace-stats': ['SLACK_BOT_TOKEN'],
  'discord-server-stats':  ['DISCORD_BOT_TOKEN'],
  'discord-channels':      ['DISCORD_BOT_TOKEN'],
  'mailchimp-campaigns':   ['MAILCHIMP_API_KEY'],
  'mailchimp-audience':    ['MAILCHIMP_API_KEY'],
  // Analytics
  'ga4-sessions-trend':    ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'ga4-top-pages':         ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'ga4-traffic-sources':   ['GA4_SERVICE_ACCOUNT_JSON', 'GA4_PROPERTY_ID'],
  'instatus-overview':     ['INSTATUS_PAGE_ID'],
  'instatus-incidents':    ['INSTATUS_PAGE_ID'],
  // Finance
  'alphavantage-quotes':              ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-sparklines':          ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-market-status':       ['ALPHA_VANTAGE_KEY'],
  'alphavantage-market-movers':       ['ALPHA_VANTAGE_KEY'],
  'alphavantage-news-sentiment':      ['ALPHA_VANTAGE_KEY'],
  'alphavantage-earnings':            ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-earnings-calendar':   ['ALPHA_VANTAGE_KEY'],
  'alphavantage-fundamentals':        ['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'alphavantage-forex-rates':         ['ALPHA_VANTAGE_KEY', 'AV_FOREX_PAIRS'],
  'alphavantage-commodities':         ['ALPHA_VANTAGE_KEY'],
  'alphavantage-economic-indicators': ['ALPHA_VANTAGE_KEY'],
  'alphavantage-insider-transactions':['ALPHA_VANTAGE_KEY', 'AV_SYMBOLS'],
  'coingecko-markets':                ['COINGECKO_COINS'],
  'coingecko-prices':                 ['COINGECKO_COINS'],
  'coingecko-price-chart':            ['COINGECKO_COINS'],
  'coingecko-coin-detail':            ['COINGECKO_COINS'],
  'finnhub-quotes':                   ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-news':                     ['FINNHUB_TOKEN'],
  'finnhub-company-news':             ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-market-news':              ['FINNHUB_TOKEN'],
  'finnhub-earnings-calendar':        ['FINNHUB_TOKEN'],
  'finnhub-earnings-surprises':       ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-analyst-consensus':        ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-fundamentals':             ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-market-status':            ['FINNHUB_TOKEN'],
  'finnhub-insider-transactions':     ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-insider-sentiment':        ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-ipo-calendar':             ['FINNHUB_TOKEN'],
  'finnhub-sec-filings':              ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'finnhub-company-profile':          ['FINNHUB_TOKEN', 'FH_SYMBOLS'],
  'plaid-accounts':                   ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-balances':                   ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-transactions':               ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-investment-portfolio':       ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-investment-transactions':    ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-liabilities-overview':       ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-credit-card-details':        ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-mortgage-tracker':           ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  'plaid-statements':                 ['PLAID_ACCESS_TOKEN', 'PLAID_CLIENT_ID', 'PLAID_SECRET'],
  // Security
  'hibp-breaches':                    ['HIBP_API_KEY', 'HIBP_EMAILS'],
  'virustotal-analyses':              ['VIRUSTOTAL_API_KEY', 'VT_DOMAINS'],
  'shodan-search':                    ['SHODAN_API_KEY'],
  // E-commerce
  'woocommerce-orders':               ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'woocommerce-sales-summary':        ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'woocommerce-top-sellers':          ['WC_BASE_URL', 'WC_CONSUMER_KEY', 'WC_CONSUMER_SECRET'],
  'shopify-orders':                   ['SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN'],
  'shopify-products':                 ['SHOPIFY_SHOP', 'SHOPIFY_ACCESS_TOKEN'],
  // Social
  'reddit-posts':                     ['REDDIT_SUBREDDITS or REDDIT_KEYWORDS'],
  // Note: reddit-hot-posts and reddit-keyword-monitor are UI aliases for
  // reddit-posts via TILE_SSE_CHANNEL — they share the same poller and
  // env-status lookup, so they do not need separate entries here.
  'producthunt-top-launches':         ['PRODUCTHUNT_API_TOKEN'],
};

function startPollers(): void {
  const ts = () => new Date().toISOString().replace('T', ' ').slice(0, 23);

  function poll(event: string, ms: number, fn: () => Promise<unknown>): void {
    const effectiveMs = pollerCustomIntervals.get(event) ?? ms;

    console.log(`  [poll] registered  ${event.padEnd(32)}  every ${fmtMs(effectiveMs)}${pausedPollers.has(event) ? '  (PAUSED)' : ''}`);

    const run = () => {
      const t0 = Date.now();
      console.log(`  [poll] fetching    ${event}`);
      return fn()
        .then((d) => {
          const elapsed = Date.now() - t0;
          const size = JSON.stringify(d).length;
          console.log(`  [poll] ✓ done      ${event.padEnd(32)}  ${elapsed}ms  ~${(size / 1024).toFixed(1)} KB  ${ts()}`);
          broadcastSse(event, d);
        })
        .catch((e: unknown) => {
          const elapsed = Date.now() - t0;
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`  [poll] ✗ error     ${event.padEnd(32)}  ${elapsed}ms  ${msg}  ${ts()}`);
          broadcastSse(event, { error: msg });
        });
    };

    if (!pausedPollers.has(event)) void run(); // skip initial fetch if paused at startup
    pollerIntervals.set(event, setInterval(() => { if (!pausedPollers.has(event)) void run(); }, effectiveMs));
    pollerRunFns.set(event, () => run() as Promise<void>);
    refreshRegistry.set(event, () => run() as Promise<void>);
  }

  let pollerCount = 0;
  const skip = (label: string) => console.log(`  [poll] skipped     ${label} (not configured)`);
  const group = (label: string) => console.log(`\n  ── ${label}`);

  group('Payments & Billing');
  const stripe = getStripe();
  if (stripe) {
    const SP = parseInt(process.env['STRIPE_POLL_MS']         ?? '30000',  10);
    const SL = parseInt(process.env['STRIPE_SLOW_POLL_MS']    ?? '60000',  10);
    const SR = parseInt(process.env['STRIPE_REVENUE_POLL_MS'] ?? '300000', 10);
    poll('stripe-payments',      SP, () => dataPayments(stripe));      pollerCount++;
    poll('stripe-products',      SL, () => dataProducts(stripe));      pollerCount++;
    poll('stripe-subscriptions', SL, () => dataSubscriptions(stripe)); pollerCount++;
    poll('stripe-customers',     SL, () => dataCustomerList(stripe));  pollerCount++;
    poll('stripe-invoices',      SL, () => dataInvoices(stripe));      pollerCount++;
    poll('stripe-refunds',       SP, () => dataRefunds(stripe));       pollerCount++;
    poll('stripe-revenue',       SR, () => dataRevenue(stripe));       pollerCount++;
    poll('stripe-webhooks',      SP, () => dataWebhooks(stripe));      pollerCount++;
  } else { skip('Stripe'); }
  if (process.env['PAYPAL_CLIENT_ID'] && process.env['PAYPAL_CLIENT_SECRET']) {
    poll('paypal-data', parseInt(process.env['PAYPAL_POLL_MS'] ?? '60000', 10), dataPayPal); pollerCount++;
  } else { skip('PayPal'); }

  group('Deployments');
  if (process.env['VERCEL_TOKEN']) {
    poll('vercel-deployments', parseInt(process.env['VERCEL_POLL_MS'] ?? '30000', 10), dataVercelDeployments); pollerCount++;
  } else { skip('Vercel'); }
  if (process.env['NETLIFY_TOKEN']) {
    poll('netlify-deployments', parseInt(process.env['NETLIFY_POLL_MS'] ?? '30000', 10), dataNetlifyDeployments); pollerCount++;
  } else { skip('Netlify'); }

  group('CI / Build');
  if (process.env['GITHUB_TOKEN'] && (process.env['GITHUB_ORG'] || process.env['GITHUB_USER'])) {
    poll('github-runs', parseInt(process.env['GITHUB_POLL_MS'] ?? '30000', 10), dataGithubRuns); pollerCount++;
  } else { skip('GitHub'); }
  if (process.env['CIRCLECI_TOKEN'] && process.env['CIRCLECI_ORG_SLUG']) {
    poll('circleci-pipelines', parseInt(process.env['CIRCLECI_POLL_MS'] ?? '60000', 10), dataCircleCIPipelines); pollerCount++;
    poll('circleci-insights',  parseInt(process.env['CIRCLECI_POLL_MS'] ?? '60000', 10), dataCircleCIInsights);  pollerCount++;
  } else { skip('CircleCI'); }
  if (process.env['TRAVIS_TOKEN'] && process.env['TRAVIS_ORG']) {
    poll('travis-builds', parseInt(process.env['TRAVIS_POLL_MS'] ?? '60000', 10), dataTravisBuilds); pollerCount++;
  } else { skip('Travis CI'); }
  if (process.env['BITRISE_TOKEN']) {
    poll('bitrise-builds', parseInt(process.env['BITRISE_POLL_MS'] ?? '60000', 10), dataBitriseBuilds); pollerCount++;
  } else { skip('Bitrise'); }
  if (process.env['DOCKERHUB_USERNAME']) {
    poll('dockerhub-repositories', parseInt(process.env['DOCKERHUB_POLL_MS'] ?? '300000', 10), dataDockerHubRepos); pollerCount++;
  } else { skip('Docker Hub'); }
  if (process.env['SONARQUBE_URL'] && process.env['SONARQUBE_TOKEN']) {
    poll('sonarqube-quality',  parseInt(process.env['SONARQUBE_POLL_MS'] ?? '120000', 10), dataSonarQubeQuality);  pollerCount++;
    poll('sonarqube-measures', parseInt(process.env['SONARQUBE_POLL_MS'] ?? '120000', 10), dataSonarQubeMeasures); pollerCount++;
    poll('sonarqube-issues',   parseInt(process.env['SONARQUBE_POLL_MS'] ?? '120000', 10), dataSonarQubeIssues);   pollerCount++;
  } else { skip('SonarQube'); }
  if (process.env['AZURE_DEVOPS_ORG'] && process.env['AZURE_DEVOPS_TOKEN']) {
    poll('azuredevops-pipelines', parseInt(process.env['AZURE_POLL_MS'] ?? '60000', 10), dataAzurePipelines); pollerCount++;
    if (process.env['AZURE_DEVOPS_PROJECT']) {
      poll('azuredevops-releases',  parseInt(process.env['AZURE_POLL_MS'] ?? '60000', 10),  dataAzureReleases);  pollerCount++;
      poll('azuredevops-workitems', parseInt(process.env['AZURE_POLL_MS'] ?? '120000', 10), dataAzureWorkItems); pollerCount++;
    }
  } else { skip('Azure DevOps'); }
  if (process.env['CF_API_TOKEN'] && process.env['CF_ACCOUNT_ID']) {
    poll('cf-pages',   parseInt(process.env['CF_PAGES_POLL_MS']   ?? '60000',  10), dataCFPages);   pollerCount++;
    poll('cf-workers', parseInt(process.env['CF_WORKERS_POLL_MS'] ?? '120000', 10), dataCFWorkers); pollerCount++;
  } else { skip('Cloudflare'); }

  group('Package / CDN');
  if (process.env['NPM_PACKAGES']) {
    poll('npm-downloads', parseInt(process.env['NPM_POLL_MS'] ?? '3600000', 10), dataNpmDownloads); pollerCount++;
  } else { skip('npm Registry'); }
  if (process.env['JSDELIVR_PACKAGES']) {
    poll('jsdelivr-hits', parseInt(process.env['JSDELIVR_POLL_MS'] ?? '3600000', 10), dataJsDelivrStats); pollerCount++;
  } else { skip('jsDelivr'); }

  group('Productivity');
  if (process.env['WAKATIME_API_KEY']) {
    poll('wakatime-summary', parseInt(process.env['WAKATIME_POLL_MS'] ?? '300000', 10), dataWakaTimeSummary); pollerCount++;
  } else { skip('WakaTime'); }
  if (process.env['CLOCKIFY_API_KEY'] && process.env['CLOCKIFY_WORKSPACE_ID']) {
    poll('clockify-time-entries', parseInt(process.env['CLOCKIFY_POLL_MS'] ?? '300000', 10), dataClockifyTimeEntries); pollerCount++;
  } else { skip('Clockify'); }
  if (process.env['LINEAR_API_KEY']) {
    poll('linear-issues', parseInt(process.env['LINEAR_POLL_MS'] ?? '120000', 10), dataLinearIssues); pollerCount++;
  } else { skip('Linear'); }
  if (process.env['JIRA_HOST'] && process.env['JIRA_EMAIL'] && process.env['JIRA_API_TOKEN']) {
    poll('jira-issues', parseInt(process.env['JIRA_POLL_MS'] ?? '120000', 10), dataJiraIssues); pollerCount++;
  } else { skip('Jira'); }

  group('Comms');
  if (process.env['SLACK_BOT_TOKEN']) {
    poll('slack-messages', parseInt(process.env['SLACK_POLL_MS'] ?? '30000', 10), dataSlackMessages); pollerCount++;
  } else { skip('Slack'); }
  if (process.env['DISCORD_BOT_TOKEN']) {
    poll('discord-server-stats', parseInt(process.env['DISCORD_POLL_MS'] ?? '300000', 10), dataDiscordServerStats); pollerCount++;
  } else { skip('Discord'); }
  if (process.env['MAILCHIMP_API_KEY']) {
    poll('mailchimp-campaigns', parseInt(process.env['MAILCHIMP_POLL_MS'] ?? '300000', 10), dataMailchimpCampaigns); pollerCount++;
  } else { skip('Mailchimp'); }

  group('Analytics');
  if (process.env['GA4_SERVICE_ACCOUNT_JSON'] && process.env['GA4_PROPERTY_ID']) {
    poll('ga4-sessions-trend', parseInt(process.env['GA4_POLL_MS'] ?? '3600000', 10), dataGA4Sessions); pollerCount++;
  } else { skip('GA4'); }
  if (process.env['INSTATUS_PAGE_ID']) {
    poll('instatus-overview', parseInt(process.env['INSTATUS_POLL_MS'] ?? '60000', 10), dataInstatusOverview); pollerCount++;
  } else { skip('Instatus'); }
  poll('hn-top-stories', parseInt(process.env['HN_POLL_MS'] ?? '300000', 10), dataHNTopStories); pollerCount++; // always on

  group('Finance');
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_SYMBOLS']) {
    poll('alphavantage-quotes', parseInt(process.env['AV_POLL_MS'] ?? '3600000', 10), dataAlphaVantageQuotes); pollerCount++;
  } else { skip('Alpha Vantage'); }
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_SYMBOLS']) {
    poll('alphavantage-sparklines', parseInt(process.env['AV_SPARK_POLL_MS'] ?? '3600000', 10), dataAvSparklines); pollerCount++;
  } else { skip('Alpha Vantage Sparklines'); }
  if (process.env['COINGECKO_COINS']) {
    poll('coingecko-markets', parseInt(process.env['CG_POLL_MS'] ?? '300000', 10), dataCoinGeckoMarkets); pollerCount++;
  } else { skip('CoinGecko'); }
  if (process.env['COINGECKO_COINS']) {
    poll('coingecko-global', parseInt(process.env['CG_POLL_MS'] ?? '600000', 10), dataCoinGeckoGlobal); pollerCount++;
  } else { skip('CoinGecko Global'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-quotes', parseInt(process.env['FINNHUB_POLL_MS'] ?? '60000', 10), dataFinnhubQuotes); pollerCount++;
  } else { skip('Finnhub'); }
  if (process.env['FINNHUB_TOKEN']) {
    poll('finnhub-news', parseInt(process.env['FH_NEWS_POLL_MS'] ?? '300000', 10), dataFinnhubNews); pollerCount++;
  } else { skip('Finnhub News'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-accounts', parseInt(process.env['PLAID_POLL_MS'] ?? '300000', 10), dataPlaidAccounts); pollerCount++;
  } else { skip('Plaid'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-transactions', parseInt(process.env['PLAID_POLL_MS'] ?? '300000', 10), dataPlaidTransactions); pollerCount++;
  } else { skip('Plaid Transactions'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-investment-portfolio', parseInt(process.env['PLAID_INV_POLL_MS'] ?? '600000', 10), dataPlaidInvestmentPortfolio); pollerCount++;
  } else { skip('Plaid Investment Portfolio'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-investment-transactions', parseInt(process.env['PLAID_INVTX_POLL_MS'] ?? '600000', 10), dataPlaidInvestmentTransactions); pollerCount++;
  } else { skip('Plaid Investment Transactions'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-liabilities-overview', parseInt(process.env['PLAID_LIAB_POLL_MS'] ?? '1800000', 10), dataPlaidLiabilities); pollerCount++;
  } else { skip('Plaid Liabilities'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-credit-card-details', parseInt(process.env['PLAID_CC_POLL_MS'] ?? '1800000', 10), dataPlaidCreditCards); pollerCount++;
  } else { skip('Plaid Credit Cards'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-mortgage-tracker', parseInt(process.env['PLAID_MORT_POLL_MS'] ?? '3600000', 10), dataPlaidMortgage); pollerCount++;
  } else { skip('Plaid Mortgage'); }
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    poll('plaid-statements', parseInt(process.env['PLAID_STMT_POLL_MS'] ?? '3600000', 10), dataPlaidStatements); pollerCount++;
  } else { skip('Plaid Statements'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-market-status', parseInt(process.env['AV_MKTSTATUS_POLL_MS'] ?? '900000', 10), dataAvMarketStatus); pollerCount++;
  } else { skip('Alpha Vantage Market Status'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-market-movers', parseInt(process.env['AV_MOVERS_POLL_MS'] ?? '900000', 10), dataAvMarketMovers); pollerCount++;
  } else { skip('Alpha Vantage Market Movers'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-news-sentiment', parseInt(process.env['AV_NEWS_POLL_MS'] ?? '3600000', 10), dataAvNewsSentiment); pollerCount++;
  } else { skip('Alpha Vantage News Sentiment'); }
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_SYMBOLS']) {
    poll('alphavantage-earnings', parseInt(process.env['AV_EARNINGS_POLL_MS'] ?? '21600000', 10), dataAvEarnings); pollerCount++;
  } else { skip('Alpha Vantage Earnings'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-earnings-calendar', parseInt(process.env['AV_CALENDAR_POLL_MS'] ?? '86400000', 10), dataAvEarningsCalendar); pollerCount++;
  } else { skip('Alpha Vantage Earnings Calendar'); }
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_SYMBOLS']) {
    poll('alphavantage-fundamentals', parseInt(process.env['AV_FUNDA_POLL_MS'] ?? '21600000', 10), dataAvFundamentals); pollerCount++;
  } else { skip('Alpha Vantage Fundamentals'); }
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_FOREX_PAIRS']) {
    poll('alphavantage-forex-rates', parseInt(process.env['AV_FOREX_POLL_MS'] ?? '3600000', 10), dataAvForexRates); pollerCount++;
  } else { skip('Alpha Vantage Forex Rates'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-commodities', parseInt(process.env['AV_COMMOD_POLL_MS'] ?? '21600000', 10), dataAvCommodities); pollerCount++;
  } else { skip('Alpha Vantage Commodities'); }
  if (process.env['ALPHA_VANTAGE_KEY']) {
    poll('alphavantage-economic-indicators', parseInt(process.env['AV_ECON_POLL_MS'] ?? '86400000', 10), dataAvEconomicIndicators); pollerCount++;
  } else { skip('Alpha Vantage Economic Indicators'); }
  if (process.env['ALPHA_VANTAGE_KEY'] && process.env['AV_SYMBOLS']) {
    poll('alphavantage-insider-transactions', parseInt(process.env['AV_INSIDER_POLL_MS'] ?? '86400000', 10), dataAvInsiderTransactions); pollerCount++;
  } else { skip('Alpha Vantage Insider Transactions'); }

  poll('coingecko-trending', parseInt(process.env['CG_TRENDING_POLL_MS'] ?? '900000', 10), dataCoinGeckoTrending); pollerCount++;
  if (process.env['COINGECKO_COINS']) {
    poll('coingecko-price-chart', parseInt(process.env['CG_CHART_POLL_MS'] ?? '600000', 10), dataCoinGeckoPriceChart); pollerCount++;
  } else { skip('CoinGecko Price Chart'); }
  poll('coingecko-defi-overview', parseInt(process.env['CG_DEFI_POLL_MS'] ?? '600000', 10), dataCoinGeckoDefi); pollerCount++;
  poll('coingecko-categories', parseInt(process.env['CG_CAT_POLL_MS'] ?? '1800000', 10), dataCoinGeckoCategories); pollerCount++;
  poll('coingecko-exchanges', parseInt(process.env['CG_EXCH_POLL_MS'] ?? '1800000', 10), dataCoinGeckoExchanges); pollerCount++;
  if (process.env['COINGECKO_COINS']) {
    poll('coingecko-coin-detail', parseInt(process.env['CG_DETAIL_POLL_MS'] ?? '300000', 10), dataCoinGeckoCoinDetail); pollerCount++;
  } else { skip('CoinGecko Coin Detail'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-company-news', parseInt(process.env['FH_CNEWS_POLL_MS'] ?? '300000', 10), dataFinnhubCompanyNews); pollerCount++;
  } else { skip('Finnhub Company News'); }
  if (process.env['FINNHUB_TOKEN']) {
    poll('finnhub-market-news', parseInt(process.env['FH_MKTNS_POLL_MS'] ?? '300000', 10), dataFinnhubMarketNews); pollerCount++;
  } else { skip('Finnhub Market News'); }
  if (process.env['FINNHUB_TOKEN']) {
    poll('finnhub-earnings-calendar', parseInt(process.env['FH_EARNCAL_POLL_MS'] ?? '3600000', 10), dataFinnhubEarningsCalendar); pollerCount++;
  } else { skip('Finnhub Earnings Calendar'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-earnings-surprises', parseInt(process.env['FH_EARNSU_POLL_MS'] ?? '3600000', 10), dataFinnhubEarningsSurprises); pollerCount++;
  } else { skip('Finnhub Earnings Surprises'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-analyst-consensus', parseInt(process.env['FH_ANALYST_POLL_MS'] ?? '3600000', 10), dataFinnhubAnalystConsensus); pollerCount++;
  } else { skip('Finnhub Analyst Consensus'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-fundamentals', parseInt(process.env['FH_FUNDA_POLL_MS'] ?? '3600000', 10), dataFinnhubFundamentals); pollerCount++;
  } else { skip('Finnhub Fundamentals'); }
  if (process.env['FINNHUB_TOKEN']) {
    poll('finnhub-market-status', parseInt(process.env['FH_MKTSTATUS_POLL_MS'] ?? '300000', 10), dataFinnhubMarketStatus); pollerCount++;
  } else { skip('Finnhub Market Status'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-insider-transactions', parseInt(process.env['FH_INSIDERTX_POLL_MS'] ?? '3600000', 10), dataFinnhubInsiderTransactions); pollerCount++;
  } else { skip('Finnhub Insider Transactions'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-insider-sentiment', parseInt(process.env['FH_INSIDERST_POLL_MS'] ?? '3600000', 10), dataFinnhubInsiderSentiment); pollerCount++;
  } else { skip('Finnhub Insider Sentiment'); }
  if (process.env['FINNHUB_TOKEN']) {
    poll('finnhub-ipo-calendar', parseInt(process.env['FH_IPO_POLL_MS'] ?? '3600000', 10), dataFinnhubIpoCalendar); pollerCount++;
  } else { skip('Finnhub IPO Calendar'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-sec-filings', parseInt(process.env['FH_FILINGS_POLL_MS'] ?? '3600000', 10), dataFinnhubSecFilings); pollerCount++;
  } else { skip('Finnhub SEC Filings'); }
  if (process.env['FINNHUB_TOKEN'] && process.env['FH_SYMBOLS']) {
    poll('finnhub-company-profile', parseInt(process.env['FH_PROFILE_POLL_MS'] ?? '21600000', 10), dataFinnhubCompanyProfile); pollerCount++;
  } else { skip('Finnhub Company Profile'); }

  group('Security');
  if (process.env['HIBP_API_KEY'] && process.env['HIBP_EMAILS']) {
    poll('hibp-breaches', parseInt(process.env['HIBP_POLL_MS'] ?? '21600000', 10), dataHibpBreaches); pollerCount++;
  } else { skip('HIBP'); }
  if (process.env['VIRUSTOTAL_API_KEY'] && process.env['VT_DOMAINS']) {
    poll('virustotal-analyses', parseInt(process.env['VT_POLL_MS'] ?? '86400000', 10), dataVirusTotalAnalyses); pollerCount++;
  } else { skip('VirusTotal'); }
  if (process.env['SHODAN_API_KEY']) {
    poll('shodan-search', parseInt(process.env['SHODAN_POLL_MS'] ?? '3600000', 10), dataShodanSearch); pollerCount++;
  } else { skip('Shodan'); }

  group('E-commerce');
  if (process.env['WC_BASE_URL'] && process.env['WC_CONSUMER_KEY'] && process.env['WC_CONSUMER_SECRET']) {
    poll('woocommerce-orders', parseInt(process.env['WC_POLL_MS'] ?? '120000', 10), dataWooCommerceOrders); pollerCount++;
  } else { skip('WooCommerce'); }
  if (process.env['WC_BASE_URL'] && process.env['WC_CONSUMER_KEY'] && process.env['WC_CONSUMER_SECRET']) {
    poll('woocommerce-sales-summary', parseInt(process.env['WC_POLL_MS'] ?? '600000', 10), dataWooSalesSummary); pollerCount++;
  } else { skip('WooCommerce Sales Summary'); }
  if (process.env['WC_BASE_URL'] && process.env['WC_CONSUMER_KEY'] && process.env['WC_CONSUMER_SECRET']) {
    poll('woocommerce-top-sellers', parseInt(process.env['WC_POLL_MS'] ?? '1800000', 10), dataWooTopSellers); pollerCount++;
  } else { skip('WooCommerce Top Sellers'); }
  if (process.env['SHOPIFY_SHOP'] && process.env['SHOPIFY_ACCESS_TOKEN']) {
    poll('shopify-orders', parseInt(process.env['SHOPIFY_POLL_MS'] ?? '120000', 10), dataShopifyOrders); pollerCount++;
  } else { skip('Shopify'); }
  if (process.env['SHOPIFY_SHOP'] && process.env['SHOPIFY_ACCESS_TOKEN']) {
    poll('shopify-products', parseInt(process.env['SHOPIFY_POLL_MS'] ?? '600000', 10), dataShopifyProducts); pollerCount++;
  } else { skip('Shopify Products'); }

  group('Social');
  if (process.env['REDDIT_SUBREDDITS'] || process.env['REDDIT_KEYWORDS']) {
    poll('reddit-posts', parseInt(process.env['REDDIT_POLL_MS'] ?? '300000', 10), dataRedditPosts); pollerCount++;
  } else { skip('Reddit'); }
  if (process.env['PRODUCTHUNT_API_TOKEN']) {
    poll('producthunt-top-launches', parseInt(process.env['PH_POLL_MS'] ?? '3600000', 10), dataProductHuntLaunches); pollerCount++;
  } else { skip('Product Hunt'); }

  console.log(`\n  ${pollerCount} pollers started — initial fetches running in background...\n`);

  // Broadcast which channels are unconfigured so tiles can render a helpful
  // "missing env vars" banner instead of showing a perpetual loading spinner.
  const missingEnvMap: Record<string, string[]> = {};
  for (const [channel, vars] of Object.entries(CHANNEL_ENV_MAP)) {
    if (!refreshRegistry.has(channel)) {
      missingEnvMap[channel] = vars;
    }
  }
  broadcastSse('env-status', missingEnvMap);
}

// ── Generic API proxy (for Custom API tiles) ────────────────────────────────

async function handleApiProxy(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const bodyText = await readBody(req);
  let payload: { url: string; method?: string; headers?: Record<string, string>; body?: string };
  try { payload = JSON.parse(bodyText) as typeof payload; }
  catch { json(res, 400, { ok: false, error: 'Invalid JSON body' }); return; }

  const { url, method = 'GET', headers = {}, body: reqBody } = payload;
  if (!url || typeof url !== 'string') {
    json(res, 400, { ok: false, error: '"url" is required' }); return;
  }

  const upper = method.toUpperCase();
  const hasBody = !['GET', 'HEAD', 'DELETE'].includes(upper) && reqBody != null;

  try {
    const r = await fetch(url, {
      method: upper,
      headers: hasBody
        ? { 'Content-Type': 'application/json', ...headers }
        : headers,
      body: hasBody ? reqBody : undefined,
      signal: AbortSignal.timeout(15_000),
    });
    const text = await r.text();
    let data: unknown;
    const ct = r.headers.get('content-type') ?? '';
    if (ct.includes('json')) {
      try { data = JSON.parse(text); } catch { data = text; }
    } else {
      data = text;
    }
    json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    json(res, 200, { ok: false, error: msg });
  }
}

// ── Test-connection handler ─────────────────────────────────────────────────

async function handleTestConnection(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  let payload: { type: 'rest' | 'ws' | 'graphql'; url: string; query?: string; headers?: Record<string, string> };
  try { payload = JSON.parse(body) as typeof payload; }
  catch { json(res, 400, { ok: false, error: 'Invalid JSON body' }); return; }

  if (payload.type === 'graphql') {
    try {
      const introspection = payload.query ?? '{__typename}';
      const r = await fetch(payload.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(payload.headers ?? {}),
        },
        body: JSON.stringify({ query: introspection }),
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text().catch(() => '');
      const preview = text.slice(0, 300);
      json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, preview });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  if (payload.type === 'rest') {
    try {
      const headers = payload.headers ?? {};
      const r = await fetch(payload.url, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(10_000),
      });
      const text = await r.text().catch(() => '');
      const preview = text.slice(0, 300);
      json(res, 200, { ok: r.ok, status: r.status, statusText: r.statusText, preview });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  if (payload.type === 'ws') {
    try {
      await new Promise<void>((resolve, reject) => {
        const ws = new WebSocket(payload.url);
        const timer = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timed out after 5 seconds'));
        }, 5000);
        ws.addEventListener('open', () => {
          clearTimeout(timer);
          ws.close();
          resolve();
        });
        ws.addEventListener('error', () => {
          clearTimeout(timer);
          reject(new Error('WebSocket connection failed — check the URL and that the server is reachable'));
        });
      });
      json(res, 200, { ok: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      json(res, 200, { ok: false, error: msg });
    }
    return;
  }

  json(res, 400, { ok: false, error: 'type must be "rest" or "ws"' });
}

// ── Route-handler wrappers (one per endpoint) ─────────────────────────────────
const SLOW_MS = 5000; // warn if a proxy call takes longer than this

async function route<T>(res: ServerResponse, fn: () => Promise<T>): Promise<void> {
  const t0 = Date.now();
  try {
    const data = await fn();
    const elapsed = Date.now() - t0;
    if (elapsed > SLOW_MS) console.warn(`  [api]  ⚠ slow response ${elapsed}ms`);
    json(res, 200, data);
  } catch (e) {
    const elapsed = Date.now() - t0;
    const msg = e instanceof Error ? e.message : 'Unknown error';
    console.error(`  [api]  ✗ error ${elapsed}ms  ${msg}`);
    json(res, 502, { error: msg });
  }
}

// ── Main request router ───────────────────────────────────────────────────────
async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { pathname } = url;
  const method = req.method ?? 'GET';

  if (method === 'OPTIONS') { res.writeHead(204, CORS); res.end(); return; }
  if (pathname === '/health') { json(res, 200, { ok: true, stripe: getStripe() !== null }); return; }

  if (!pathname.startsWith('/api/')) { json(res, 404, { error: 'Not found' }); return; }

  // ── SSE stream ─────────────────────────────────────────────────────────────
  if (pathname === '/api/sse' && method === 'GET') {
    if (AUTH_ENABLED && !extractToken(req)) { json(res, 401, { error: 'Unauthorized' }); return; }
    handleSseStream(req, res); return;
  }

  // ── Auth routes (always public) ────────────────────────────────────────────
  if (pathname === '/api/auth/config' && method === 'GET') {
    json(res, 200, { enabled: AUTH_ENABLED });
    return;
  }
  if (pathname === '/api/auth/register' && method === 'POST') {
    if (!AUTH_ENABLED) { json(res, 403, { error: 'Registration is disabled (AUTH_ENABLED is not set)' }); return; }
    try {
      const body = await readBody(req);
      const { username, password } = JSON.parse(body) as { username?: string; password?: string };
      if (!username || username.trim().length < 2) { json(res, 400, { error: 'Username must be at least 2 characters' }); return; }
      if (!password || password.length < 6) { json(res, 400, { error: 'Password must be at least 6 characters' }); return; }
      const existing = stmtFindUser.get(username.trim());
      if (existing) { json(res, 409, { error: 'Username already taken' }); return; }
      const hash = hashPassword(password);
      const [{ id }] = stmtInsertUser.all(username.trim(), hash);
      const token = signJwt(id, username.trim());
      console.log(`  [auth] registered  user=${username.trim()} id=${id}`);
      json(res, 201, { token, user: { id, username: username.trim() } });
    } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Registration failed' }); }
    return;
  }
  if (pathname === '/api/auth/login' && method === 'POST') {
    try {
      const body = await readBody(req);
      const { username, password } = JSON.parse(body) as { username?: string; password?: string };
      if (!username || !password) { json(res, 400, { error: 'Username and password required' }); return; }
      const user = stmtFindUser.get(username.trim());
      if (!user || !verifyPassword(password, user.password_hash)) {
        json(res, 401, { error: 'Invalid username or password' }); return;
      }
      const token = signJwt(user.id, user.username);
      console.log(`  [auth] login       user=${user.username} id=${user.id}`);
      json(res, 200, { token, user: { id: user.id, username: user.username } });
    } catch (e) { json(res, 500, { error: e instanceof Error ? e.message : 'Login failed' }); }
    return;
  }
  if (pathname === '/api/auth/me' && method === 'GET') {
    const jwtUser = extractToken(req);
    if (!jwtUser) { json(res, 401, { error: 'Unauthorized' }); return; }
    json(res, 200, { id: jwtUser.sub, username: jwtUser.username });
    return;
  }

  // ── Auth middleware — guards all routes below when AUTH_ENABLED ────────────
  if (AUTH_ENABLED && !extractToken(req)) {
    json(res, 401, { error: 'Unauthorized' });
    return;
  }

  // ── Per-user layouts ───────────────────────────────────────────────────────
  if (pathname.startsWith('/api/layout/')) {
    const workspace = decodeURIComponent(pathname.slice('/api/layout/'.length));
    const jwtUser = extractToken(req);
    if (!jwtUser) { json(res, 401, { error: 'Unauthorized' }); return; }
    if (method === 'GET') {
      const row = stmtGetLayout.get(jwtUser.sub, workspace);
      if (!row) { json(res, 200, { tiles: null }); return; }
      json(res, 200, { tiles: JSON.parse(row.tiles_json) });
      return;
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const { tiles } = JSON.parse(body) as { tiles: unknown[] };
        stmtUpsertLayout.run(jwtUser.sub, workspace, JSON.stringify(tiles), Math.floor(Date.now() / 1000));
        json(res, 200, { ok: true });
      } catch (e) { json(res, 400, { error: e instanceof Error ? e.message : 'Bad request' }); }
      return;
    }
  }
  if (pathname === '/api/proxy' && method === 'POST') {
    await handleApiProxy(req, res); return;
  }
  if (pathname === '/api/test-connection' && method === 'POST') {
    await handleTestConnection(req, res); return;
  }

  // ── Server control ────────────────────────────────────────────────────────
  if (pathname === '/api/server/reload-env' && method === 'POST') {
    try {
      const content = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
      const vars = parseEnvFile(content);
      const reloaded: string[] = [];
      for (const [k, v] of Object.entries(vars)) {
        if (process.env[k] !== v) {
          process.env[k] = v;
          reloaded.push(k);
        }
      }
      console.log(`  [env]  reload-env  ${reloaded.length} keys updated: ${reloaded.join(', ') || '(none)'}`);
      json(res, 200, { ok: true, reloaded });
    } catch (e: unknown) {
      json(res, 500, { ok: false, error: e instanceof Error ? e.message : 'Failed to reload .env' });
    }
    return;
  }
  if (pathname === '/api/server/restart' && method === 'POST') {
    console.log('  [server] restarting on user request');
    json(res, 200, { ok: true });
    // Under bun --watch / PM2 / nodemon the supervisor respawns on exit.
    // Do NOT spawn a child — that causes port conflicts when the supervisor
    // also restarts at the same time.
    setTimeout(() => process.exit(0), 200);
    return;
  }

  // ── Env file read / write ──────────────────────────────────────────────────
  if (pathname === '/api/env') {
    if (method === 'GET') {
      try {
        // Read active .env; fall back to .env.example if .env not found
        const content = existsSync(ENV_PATH)
          ? readFileSync(ENV_PATH, 'utf8')
          : '';
        const vars = parseEnvFile(content);
        json(res, 200, { vars });
      } catch (e: unknown) {
        json(res, 500, { error: e instanceof Error ? e.message : 'Failed to read .env' });
      }
      return;
    }
    if (method === 'POST') {
      try {
        const body = await readBody(req);
        const payload = JSON.parse(body) as { vars: Record<string, string> };
        if (!payload.vars || typeof payload.vars !== 'object') {
          json(res, 400, { error: 'Body must be { vars: Record<string, string> }' }); return;
        }
        // Load existing content (or blank) and patch it
        const existing = existsSync(ENV_PATH)
          ? readFileSync(ENV_PATH, 'utf8')
          : '';
        const patched = patchEnvFile(existing, payload.vars);
        writeFileSync(ENV_PATH, patched, 'utf8');
        console.log(`  [env]  wrote ${Object.keys(payload.vars).length} vars → ${ENV_PATH}`);
        json(res, 200, { ok: true });
      } catch (e: unknown) {
        json(res, 500, { error: e instanceof Error ? e.message : 'Failed to write .env' });
      }
      return;
    }
  }

  // ── Poll control ──────────────────────────────────────────────────────────
  // POST /api/poll/sync  — dashboard sends its full tile config on load so the
  // server stays in sync even after a server restart without a settings file.
  if (pathname === '/api/poll/sync' && method === 'POST') {
    const body = await readBody(req);
    const { settings } = JSON.parse(body) as { settings: Array<{ channel: string; ms: number }> };
    console.log(`  [poll] SYNC        from dashboard  (${settings.length} entries)`);
    // Reset all managed state then apply what the client sent.
    pausedPollers.clear();
    pollerCustomIntervals.clear();
    for (const { channel, ms } of settings) {
      if (ms === 0) {
        pausedPollers.add(channel);
        console.log(`  [poll]   pause:    ${channel}`);
      } else {
        pollerCustomIntervals.set(channel, ms);
        console.log(`  [poll]   interval: ${channel.padEnd(32)}  ${fmtMs(ms)}`);
        // Re-schedule the interval if it differs from what's running.
        const old = pollerIntervals.get(channel);
        if (old !== undefined) clearInterval(old);
        const run = pollerRunFns.get(channel);
        if (run) pollerIntervals.set(channel, setInterval(() => { if (!pausedPollers.has(channel)) void run(); }, ms));
      }
    }
    savePollSettings();
    json(res, 200, { ok: true, synced: settings.length });
    return;
  }
  // POST /api/poll/pause/:event  — stops periodic fetches for a channel.
  // POST /api/poll/resume/:event — resumes and immediately re-fetches.
  if (pathname.startsWith('/api/poll/pause/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/pause/'.length);
    console.log(`  [poll] PAUSE       ${channel}  (dashboard request)`);
    pausedPollers.add(channel);
    savePollSettings();
    json(res, 200, { ok: true, channel, paused: true });
    return;
  }
  if (pathname.startsWith('/api/poll/resume/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/resume/'.length);
    const customMs = pollerCustomIntervals.get(channel);
    console.log(`  [poll] RESUME      ${channel}  (dashboard request)${customMs ? `  interval=${fmtMs(customMs)}` : ''}`);
    pausedPollers.delete(channel);
    savePollSettings();
    const fn = refreshRegistry.get(channel);
    if (fn) void fn(); // immediate fetch on resume
    json(res, 200, { ok: true, channel, paused: false });
    return;
  }
  if (pathname.startsWith('/api/poll/set-interval/') && method === 'POST') {
    const channel = pathname.slice('/api/poll/set-interval/'.length);
    const body = await readBody(req);
    const { ms: newMs } = JSON.parse(body) as { ms: number };
    if (!Number.isFinite(newMs) || newMs < 1000) { json(res, 400, { error: 'ms must be >= 1000' }); return; }
    const oldMs = pollerCustomIntervals.get(channel);
    console.log(`  [poll] SET-INTERVAL ${channel.padEnd(31)}  ${oldMs ? fmtMs(oldMs) + ' → ' : ''}${fmtMs(newMs)}  (dashboard request)`);
    pollerCustomIntervals.set(channel, newMs);
    savePollSettings();
    // Cancel old interval and start new one at the custom rate.
    const old = pollerIntervals.get(channel);
    if (old !== undefined) clearInterval(old);
    const run = pollerRunFns.get(channel);
    if (run) {
      pollerIntervals.set(channel, setInterval(() => { if (!pausedPollers.has(channel)) void run(); }, newMs));
    }
    json(res, 200, { ok: true, channel, ms: newMs });
    return;
  }

  // ── On-demand refresh ─────────────────────────────────────────────────────
  // POST /api/refresh/:event  — immediately re-fetches and broadcasts the
  // named SSE event to all connected clients.
  if (pathname.startsWith('/api/refresh/') && method === 'POST') {
    const event = pathname.slice('/api/refresh/'.length);
    const fn = refreshRegistry.get(event);
    if (!fn) { json(res, 404, { error: `No registered poller for event: ${event}` }); return; }
    await fn();
    json(res, 200, { ok: true, event });
    return;
  }

  // ── GitHub Actions ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/github/')) {
    if (pathname === '/api/github/runs' && method === 'GET') { await getGitHubRuns(res); return; }
    json(res, 404, { error: `Unknown GitHub route: ${pathname}` }); return;
  }

  // ── Cloudflare ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/cloudflare/')) {
    if (pathname === '/api/cloudflare/pages' && method === 'GET') { await getCFPages(res); return; }
    if (pathname === '/api/cloudflare/workers' && method === 'GET') { await getCFWorkers(res); return; }
    // /api/cloudflare/pages/{projectName}/deployments
    const cfMatch = pathname.match(/^\/api\/cloudflare\/pages\/([^/]+)\/deployments$/);
    if (cfMatch && method === 'GET') { await getCFPageDeployments(res, cfMatch[1]); return; }
    json(res, 404, { error: `Unknown Cloudflare route: ${pathname}` }); return;
  }

  // ── PayPal ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/paypal/')) {
    if (pathname === '/api/paypal/transactions' && method === 'GET') { await getPayPalTransactions(res); return; }
    if (pathname === '/api/paypal/balance'      && method === 'GET') { await getPayPalBalance(res); return; }
    json(res, 404, { error: `Unknown PayPal route: ${pathname}` }); return;
  }

  // ── Vercel ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/vercel/')) {
    if (pathname === '/api/vercel/deployments' && method === 'GET') { await route(res, dataVercelDeployments); return; }
    json(res, 404, { error: `Unknown Vercel route: ${pathname}` }); return;
  }

  // ── Netlify ────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/netlify/')) {
    if (pathname === '/api/netlify/deployments' && method === 'GET') { await route(res, dataNetlifyDeployments); return; }
    json(res, 404, { error: `Unknown Netlify route: ${pathname}` }); return;
  }

  // ── CircleCI ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/circleci/')) {
    if (pathname === '/api/circleci/pipelines' && method === 'GET') { await route(res, dataCircleCIPipelines); return; }
    if (pathname === '/api/circleci/insights'  && method === 'GET') { await route(res, dataCircleCIInsights); return; }
    json(res, 404, { error: `Unknown CircleCI route: ${pathname}` }); return;
  }

  // ── Travis CI ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/travis/')) {
    if (pathname === '/api/travis/builds' && method === 'GET') { await route(res, dataTravisBuilds); return; }
    json(res, 404, { error: `Unknown Travis route: ${pathname}` }); return;
  }

  // ── Bitrise ────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/bitrise/')) {
    if (pathname === '/api/bitrise/builds' && method === 'GET') { await route(res, dataBitriseBuilds); return; }
    json(res, 404, { error: `Unknown Bitrise route: ${pathname}` }); return;
  }

  // ── Docker Hub ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/dockerhub/')) {
    if (pathname === '/api/dockerhub/repositories' && method === 'GET') { await route(res, dataDockerHubRepos); return; }
    json(res, 404, { error: `Unknown DockerHub route: ${pathname}` }); return;
  }

  // ── SonarQube ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/sonarqube/')) {
    if (pathname === '/api/sonarqube/quality'   && method === 'GET') { await route(res, dataSonarQubeQuality); return; }
    if (pathname === '/api/sonarqube/measures'  && method === 'GET') { await route(res, dataSonarQubeMeasures); return; }
    if (pathname === '/api/sonarqube/issues'    && method === 'GET') { await route(res, dataSonarQubeIssues); return; }
    json(res, 404, { error: `Unknown SonarQube route: ${pathname}` }); return;
  }

  // ── Azure DevOps ───────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/azuredevops/')) {
    if (pathname === '/api/azuredevops/pipelines'  && method === 'GET') { await route(res, dataAzurePipelines); return; }
    if (pathname === '/api/azuredevops/releases'   && method === 'GET') { await route(res, dataAzureReleases); return; }
    if (pathname === '/api/azuredevops/workitems'  && method === 'GET') { await route(res, dataAzureWorkItems); return; }
    json(res, 404, { error: `Unknown Azure DevOps route: ${pathname}` }); return;
  }

  // ── npm ────────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/npm/')) {
    if (pathname === '/api/npm/downloads' && method === 'GET') { await route(res, dataNpmDownloads); return; }
    json(res, 404, { error: `Unknown npm route: ${pathname}` }); return;
  }

  // ── jsDelivr ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/jsdelivr/')) {
    if (pathname === '/api/jsdelivr/hits' && method === 'GET') { await route(res, dataJsDelivrStats); return; }
    json(res, 404, { error: `Unknown jsDelivr route: ${pathname}` }); return;
  }

  // ── WakaTime ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/wakatime/')) {
    if (pathname === '/api/wakatime/summary' && method === 'GET') { await route(res, dataWakaTimeSummary); return; }
    json(res, 404, { error: `Unknown WakaTime route: ${pathname}` }); return;
  }

  // ── Clockify ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/clockify/')) {
    if (pathname === '/api/clockify/time-entries' && method === 'GET') { await route(res, dataClockifyTimeEntries); return; }
    json(res, 404, { error: `Unknown Clockify route: ${pathname}` }); return;
  }

  // ── Linear ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/linear/')) {
    if (pathname === '/api/linear/issues' && method === 'GET') { await route(res, dataLinearIssues); return; }
    json(res, 404, { error: `Unknown Linear route: ${pathname}` }); return;
  }

  // ── Jira ───────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/jira/')) {
    if (pathname === '/api/jira/issues' && method === 'GET') { await route(res, dataJiraIssues); return; }
    json(res, 404, { error: `Unknown Jira route: ${pathname}` }); return;
  }

  // ── Slack ──────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/slack/')) {
    if (pathname === '/api/slack/messages' && method === 'GET') { await route(res, dataSlackMessages); return; }
    json(res, 404, { error: `Unknown Slack route: ${pathname}` }); return;
  }

  // ── Discord ────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/discord/')) {
    if (pathname === '/api/discord/server-stats' && method === 'GET') { await route(res, dataDiscordServerStats); return; }
    json(res, 404, { error: `Unknown Discord route: ${pathname}` }); return;
  }

  // ── Mailchimp ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/mailchimp/')) {
    if (pathname === '/api/mailchimp/campaigns' && method === 'GET') { await route(res, dataMailchimpCampaigns); return; }
    json(res, 404, { error: `Unknown Mailchimp route: ${pathname}` }); return;
  }

  // ── Google Analytics 4 ────────────────────────────────────────────────────
  if (pathname.startsWith('/api/ga4/')) {
    if (pathname === '/api/ga4/sessions' && method === 'GET') { await route(res, dataGA4Sessions); return; }
    json(res, 404, { error: `Unknown GA4 route: ${pathname}` }); return;
  }

  // ── Instatus ───────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/instatus/')) {
    if (pathname === '/api/instatus/overview' && method === 'GET') { await route(res, dataInstatusOverview); return; }
    json(res, 404, { error: `Unknown Instatus route: ${pathname}` }); return;
  }

  // ── RSS Feed ──────────────────────────────────────────────────────────────
  if (pathname === '/api/rss/feed' && method === 'GET') {
    const qs = new URL(`http://x${req.url ?? ''}`).searchParams;
    const feedUrl = qs.get('url');
    if (!feedUrl) { json(res, 400, { error: 'url query param required' }); return; }
    const maxItems = parseInt(qs.get('maxItems') ?? '50', 10) || 50;
    try { json(res, 200, await dataRssFeed(decodeURIComponent(feedUrl), maxItems)); } catch (e) { json(res, 500, { error: String(e) }); }
    return;
  }

  // ── Hacker News ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/hackernews/')) {
    if (pathname === '/api/hackernews/top-stories' && method === 'GET') { await route(res, dataHNTopStories); return; }
    json(res, 404, { error: `Unknown HackerNews route: ${pathname}` }); return;
  }

  // ── Alpha Vantage ──────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/alphavantage/')) {
    if (pathname === '/api/alphavantage/quotes' && method === 'GET') { await route(res, dataAlphaVantageQuotes); return; }
    if (pathname === '/api/alphavantage/sparklines' && method === 'GET') { await route(res, dataAvSparklines); return; }
    if (pathname === '/api/alphavantage/market-status' && method === 'GET') { await route(res, dataAvMarketStatus); return; }
    if (pathname === '/api/alphavantage/market-movers' && method === 'GET') { await route(res, dataAvMarketMovers); return; }
    if (pathname === '/api/alphavantage/news-sentiment' && method === 'GET') { await route(res, dataAvNewsSentiment); return; }
    if (pathname === '/api/alphavantage/earnings' && method === 'GET') { await route(res, dataAvEarnings); return; }
    if (pathname === '/api/alphavantage/earnings-calendar' && method === 'GET') { await route(res, dataAvEarningsCalendar); return; }
    if (pathname === '/api/alphavantage/fundamentals' && method === 'GET') { await route(res, dataAvFundamentals); return; }
    if (pathname === '/api/alphavantage/forex-rates' && method === 'GET') { await route(res, dataAvForexRates); return; }
    if (pathname === '/api/alphavantage/commodities' && method === 'GET') { await route(res, dataAvCommodities); return; }
    if (pathname === '/api/alphavantage/economic-indicators' && method === 'GET') { await route(res, dataAvEconomicIndicators); return; }
    if (pathname === '/api/alphavantage/insider-transactions' && method === 'GET') { await route(res, dataAvInsiderTransactions); return; }
    json(res, 404, { error: `Unknown AlphaVantage route: ${pathname}` }); return;
  }

  // ── CoinGecko ──────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/coingecko/')) {
    if (pathname === '/api/coingecko/markets' && method === 'GET') { await route(res, dataCoinGeckoMarkets); return; }
    if (pathname === '/api/coingecko/global' && method === 'GET') { await route(res, dataCoinGeckoGlobal); return; }
    if (pathname === '/api/coingecko/trending' && method === 'GET') { await route(res, dataCoinGeckoTrending); return; }
    if (pathname === '/api/coingecko/price-chart' && method === 'GET') { await route(res, dataCoinGeckoPriceChart); return; }
    if (pathname === '/api/coingecko/defi' && method === 'GET') { await route(res, dataCoinGeckoDefi); return; }
    if (pathname === '/api/coingecko/categories' && method === 'GET') { await route(res, dataCoinGeckoCategories); return; }
    if (pathname === '/api/coingecko/exchanges' && method === 'GET') { await route(res, dataCoinGeckoExchanges); return; }
    if (pathname === '/api/coingecko/coin-detail' && method === 'GET') { await route(res, dataCoinGeckoCoinDetail); return; }
    json(res, 404, { error: `Unknown CoinGecko route: ${pathname}` }); return;
  }

  // ── Finnhub ────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/finnhub/')) {
    if (pathname === '/api/finnhub/quotes' && method === 'GET') { await route(res, dataFinnhubQuotes); return; }
    if (pathname === '/api/finnhub/news' && method === 'GET') { await route(res, dataFinnhubNews); return; }
    if (pathname === '/api/finnhub/company-news' && method === 'GET') { await route(res, dataFinnhubCompanyNews); return; }
    if (pathname === '/api/finnhub/market-news' && method === 'GET') { await route(res, dataFinnhubMarketNews); return; }
    if (pathname === '/api/finnhub/earnings-calendar' && method === 'GET') { await route(res, dataFinnhubEarningsCalendar); return; }
    if (pathname === '/api/finnhub/earnings-surprises' && method === 'GET') { await route(res, dataFinnhubEarningsSurprises); return; }
    if (pathname === '/api/finnhub/analyst-consensus' && method === 'GET') { await route(res, dataFinnhubAnalystConsensus); return; }
    if (pathname === '/api/finnhub/fundamentals' && method === 'GET') { await route(res, dataFinnhubFundamentals); return; }
    if (pathname === '/api/finnhub/market-status' && method === 'GET') { await route(res, dataFinnhubMarketStatus); return; }
    if (pathname === '/api/finnhub/insider-transactions' && method === 'GET') { await route(res, dataFinnhubInsiderTransactions); return; }
    if (pathname === '/api/finnhub/insider-sentiment' && method === 'GET') { await route(res, dataFinnhubInsiderSentiment); return; }
    if (pathname === '/api/finnhub/ipo-calendar' && method === 'GET') { await route(res, dataFinnhubIpoCalendar); return; }
    if (pathname === '/api/finnhub/sec-filings' && method === 'GET') { await route(res, dataFinnhubSecFilings); return; }
    if (pathname === '/api/finnhub/company-profile' && method === 'GET') { await route(res, dataFinnhubCompanyProfile); return; }
    json(res, 404, { error: `Unknown Finnhub route: ${pathname}` }); return;
  }

  // ── Plaid ──────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/plaid/')) {
    if (pathname === '/api/plaid/accounts' && method === 'GET') { await route(res, dataPlaidAccounts); return; }
    if (pathname === '/api/plaid/transactions' && method === 'GET') { await route(res, dataPlaidTransactions); return; }
    if (pathname === '/api/plaid/investment-portfolio' && method === 'GET') { await route(res, dataPlaidInvestmentPortfolio); return; }
    if (pathname === '/api/plaid/investment-transactions' && method === 'GET') { await route(res, dataPlaidInvestmentTransactions); return; }
    if (pathname === '/api/plaid/liabilities-overview' && method === 'GET') { await route(res, dataPlaidLiabilities); return; }
    if (pathname === '/api/plaid/credit-card-details' && method === 'GET') { await route(res, dataPlaidCreditCards); return; }
    if (pathname === '/api/plaid/mortgage-tracker' && method === 'GET') { await route(res, dataPlaidMortgage); return; }
    if (pathname === '/api/plaid/statements' && method === 'GET') { await route(res, dataPlaidStatements); return; }
    json(res, 404, { error: `Unknown Plaid route: ${pathname}` }); return;
  }

  // ── HaveIBeenPwned ─────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/hibp/')) {
    if (pathname === '/api/hibp/breaches' && method === 'GET') { await route(res, dataHibpBreaches); return; }
    json(res, 404, { error: `Unknown HIBP route: ${pathname}` }); return;
  }

  // ── VirusTotal ─────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/virustotal/')) {
    if (pathname === '/api/virustotal/analyses' && method === 'GET') { await route(res, dataVirusTotalAnalyses); return; }
    json(res, 404, { error: `Unknown VirusTotal route: ${pathname}` }); return;
  }

  // ── Shodan ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/shodan/')) {
    if (pathname === '/api/shodan/search' && method === 'GET') { await route(res, dataShodanSearch); return; }
    json(res, 404, { error: `Unknown Shodan route: ${pathname}` }); return;
  }

  // ── WooCommerce ────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/woocommerce/')) {
    if (pathname === '/api/woocommerce/orders' && method === 'GET') { await route(res, dataWooCommerceOrders); return; }
    if (pathname === '/api/woocommerce/sales-summary' && method === 'GET') { await route(res, dataWooSalesSummary); return; }
    if (pathname === '/api/woocommerce/top-sellers' && method === 'GET') { await route(res, dataWooTopSellers); return; }
    json(res, 404, { error: `Unknown WooCommerce route: ${pathname}` }); return;
  }

  // ── Shopify ────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/shopify/')) {
    if (pathname === '/api/shopify/orders' && method === 'GET') { await route(res, dataShopifyOrders); return; }
    if (pathname === '/api/shopify/products' && method === 'GET') { await route(res, dataShopifyProducts); return; }
    json(res, 404, { error: `Unknown Shopify route: ${pathname}` }); return;
  }

  // ── Reddit ─────────────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/reddit/')) {
    if (pathname === '/api/reddit/posts' && method === 'GET') { await route(res, dataRedditPosts); return; }
    json(res, 404, { error: `Unknown Reddit route: ${pathname}` }); return;
  }

  // ── Product Hunt ───────────────────────────────────────────────────────────
  if (pathname.startsWith('/api/producthunt/')) {
    if (pathname === '/api/producthunt/launches' && method === 'GET') { await route(res, dataProductHuntLaunches); return; }
    json(res, 404, { error: `Unknown ProductHunt route: ${pathname}` }); return;
  }

  if (!pathname.startsWith('/api/stripe/')) { json(res, 404, { error: 'Not found' }); return; }

  // Special SSE / ingest routes
  if (pathname === '/api/stripe/webhooks/stream') { handleWebhookStream(req, res); return; }
  if (pathname === '/api/stripe/webhooks/ingest' && method === 'POST') { await handleWebhookIngest(req, res); return; }

  // ── Order workflow statuses (local, no Stripe needed) ────────────────────
  if (pathname === '/api/stripe/orders/statuses' && method === 'GET') {
    json(res, 200, readStatuses()); return;
  }
  if (pathname.startsWith('/api/stripe/orders/') && pathname.endsWith('/status') && method === 'PATCH') {
    const orderId = pathname.slice('/api/stripe/orders/'.length, -'/status'.length);
    const rawBody = await readBody(req);
    const { status, note } = JSON.parse(rawBody || '{}') as { status?: OrderWorkflowStatus; note?: string };
    const valid: OrderWorkflowStatus[] = ['new', 'processing', 'packing', 'shipped', 'done'];
    if (!status || !valid.includes(status)) { json(res, 400, { error: 'Invalid status' }); return; }
    const entry: OrderStatusEntry = { status, updatedAt: Math.floor(Date.now() / 1000), ...(note !== undefined ? { note } : {}) };
    writeStatus(orderId, entry);
    json(res, 200, entry); return;
  }

  const stripe = getStripe();
  if (!stripe) { noStripe(res); return; }

  // Parse path: /api/stripe/<resource>[/<id>[/<action>]]
  const rest = pathname.slice('/api/stripe/'.length); // e.g. "payments/ch_123/refund"
  const parts = rest.split('/').filter(Boolean);      // ["payments", "ch_123", "refund"]
  const [resource, id, action] = parts;

  const body = (method === 'POST' || method === 'PATCH' || method === 'DELETE')
    ? await readBody(req)
    : '';

  try {
    // ── payments ─────────────────────────────────────────────────────────────
    if (resource === 'payments') {
      if (!id && method === 'GET') { await getPayments(stripe, res); return; }
      if (id && !action && method === 'GET') { await getPayment(stripe, res, id); return; }
      if (id && action === 'refund' && method === 'POST') { await refundPayment(stripe, res, id, body); return; }
      if (id && action === 'capture' && method === 'POST') { await capturePayment(stripe, res, id); return; }
      if (id && action === 'cancel' && method === 'POST') { await cancelPayment(stripe, res, id); return; }
    }

    // ── products ─────────────────────────────────────────────────────────────
    if (resource === 'products') {
      if (!id && method === 'GET') { await getProducts(stripe, res); return; }
      if (!id && method === 'POST') { await createProduct(stripe, res, body); return; }
      if (id && !action && method === 'GET') { await getProduct(stripe, res, id); return; }
      if (id && !action && method === 'PATCH') { await updateProduct(stripe, res, id, body); return; }
      if (id && !action && method === 'DELETE') { await deleteProduct(stripe, res, id); return; }
      if (id && action === 'prices' && method === 'GET') { await getProductPrices(stripe, res, id); return; }
    }

    // ── prices ───────────────────────────────────────────────────────────────
    if (resource === 'prices') {
      if (!id && method === 'POST') { await createPrice(stripe, res, body); return; }
      if (id && method === 'PATCH') { await updatePrice(stripe, res, id, body); return; }
    }

    // ── subscriptions ─────────────────────────────────────────────────────────
    if (resource === 'subscriptions') {
      if (!id && method === 'GET') { await getSubscriptions(stripe, res); return; }
      if (id && !action && method === 'GET') { await getSubscription(stripe, res, id); return; }
      if (id && !action && method === 'PATCH') { await updateSubscription(stripe, res, id, body); return; }
      if (id && !action && method === 'DELETE') { await cancelSubscription(stripe, res, id, body); return; }
      if (id && action === 'resume' && method === 'POST') { await resumeSubscription(stripe, res, id); return; }
    }

    // ── customers ─────────────────────────────────────────────────────────────
    if (resource === 'customers') {
      if (!id && method === 'GET') { await getCustomers(stripe, res); return; }
      if (id === 'list' && method === 'GET') { await getCustomerList(stripe, res); return; }
      if (id && id !== 'list' && !action && method === 'GET') { await getCustomer(stripe, res, id); return; }
      if (id && !action && method === 'PATCH') { await updateCustomer(stripe, res, id, body); return; }
      if (id && !action && method === 'DELETE') { await deleteCustomer(stripe, res, id); return; }
    }

    // ── invoices ──────────────────────────────────────────────────────────────
    if (resource === 'invoices') {
      if (!id && method === 'GET') { await getInvoices(stripe, res); return; }
      if (id && !action && method === 'GET') { await getInvoice(stripe, res, id); return; }
      if (id && action === 'finalize' && method === 'POST') { await finalizeInvoice(stripe, res, id); return; }
      if (id && action === 'pay' && method === 'POST') { await payInvoice(stripe, res, id); return; }
      if (id && action === 'void' && method === 'POST') { await voidInvoice(stripe, res, id); return; }
      if (id && action === 'send' && method === 'POST') { await sendInvoice(stripe, res, id); return; }
    }

    // ── refunds ───────────────────────────────────────────────────────────────
    if (resource === 'refunds') {
      if (!id && method === 'GET') { await getRefunds(stripe, res); return; }
      if (!id && method === 'POST') { await createRefund(stripe, res, body); return; }
    }

    // ── legacy list routes for existing tiles ─────────────────────────────────
    if (resource === 'webhooks' && !id && method === 'GET') { await getWebhookEvents(stripe, res); return; }
    if (resource === 'revenue' && method === 'GET') { await getRevenue(stripe, res); return; }

    json(res, 404, { error: `Unknown route: ${method} /api/stripe/${rest}` });
  } catch (err) {
    json(res, 500, { error: err instanceof Error ? err.message : 'Unknown error' });
  }
}

// ── Entrypoint ────────────────────────────────────────────────────────────────
if ((import.meta as { main?: boolean }).main) {
  const PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
  httpCreateServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error('API error:', err);
      json(res, 500, { error: 'Internal server error' });
    });
  }).listen(PORT, () => {
    startPollers();

    const e = process.env;
    const ok  = (v: boolean, hint: string) => v ? '✓' : `✗  (${hint})`;

    // ── provider flags ────────────────────────────────────────────────────────
    const cfgs: [string, boolean, string][] = [
      // [label, configured, missing-hint]
      ['Stripe',       getStripe() !== null,                                   'STRIPE_SECRET_KEY'],
      ['GitHub',       !!(e['GITHUB_TOKEN'] && e['GITHUB_ORG']),              'GITHUB_TOKEN + GITHUB_ORG'],
      ['Cloudflare',   !!(e['CF_API_TOKEN'] && e['CF_ACCOUNT_ID']),           'CF_API_TOKEN + CF_ACCOUNT_ID'],
      ['PayPal',       !!(e['PAYPAL_CLIENT_ID'] && e['PAYPAL_CLIENT_SECRET']),'PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET'],
      // ── CI / DevOps ──────────────────────────────────────────────────────────
      ['Vercel',       !!(e['VERCEL_TOKEN']),                                  'VERCEL_TOKEN'],
      ['Netlify',      !!(e['NETLIFY_TOKEN']),                                 'NETLIFY_TOKEN'],
      ['CircleCI',     !!(e['CIRCLECI_TOKEN'] && e['CIRCLECI_ORG_SLUG']),     'CIRCLECI_TOKEN + CIRCLECI_ORG_SLUG'],
      ['Travis CI',    !!(e['TRAVIS_TOKEN'] && e['TRAVIS_ORG']),              'TRAVIS_TOKEN + TRAVIS_ORG'],
      ['Bitrise',      !!(e['BITRISE_TOKEN']),                                 'BITRISE_TOKEN'],
      ['Docker Hub',   !!(e['DOCKERHUB_USERNAME']),                            'DOCKERHUB_USERNAME'],
      ['SonarQube',    !!(e['SONARQUBE_URL'] && e['SONARQUBE_TOKEN']),        'SONARQUBE_URL + SONARQUBE_TOKEN'],
      ['Azure DevOps', !!(e['AZURE_DEVOPS_ORG'] && e['AZURE_DEVOPS_TOKEN']), 'AZURE_DEVOPS_ORG + AZURE_DEVOPS_TOKEN'],
      // ── Package / CDN ───────────────────────────────────────────────────────
      ['npm Registry', !!(e['NPM_PACKAGES']),                                  'NPM_PACKAGES'],
      ['jsDelivr',     !!(e['JSDELIVR_PACKAGES']),                             'JSDELIVR_PACKAGES'],
      // ── Productivity ────────────────────────────────────────────────────────
      ['WakaTime',     !!(e['WAKATIME_API_KEY']),                              'WAKATIME_API_KEY'],
      ['Clockify',     !!(e['CLOCKIFY_API_KEY'] && e['CLOCKIFY_WORKSPACE_ID']),'CLOCKIFY_API_KEY + CLOCKIFY_WORKSPACE_ID'],
      ['Linear',       !!(e['LINEAR_API_KEY']),                                'LINEAR_API_KEY'],
      ['Jira',         !!(e['JIRA_HOST'] && e['JIRA_EMAIL'] && e['JIRA_API_TOKEN']), 'JIRA_HOST + JIRA_EMAIL + JIRA_API_TOKEN'],
      // ── Comms ────────────────────────────────────────────────────────────────
      ['Slack',        !!(e['SLACK_BOT_TOKEN']),                               'SLACK_BOT_TOKEN'],
      ['Discord',      !!(e['DISCORD_BOT_TOKEN']),                             'DISCORD_BOT_TOKEN'],
      ['Mailchimp',    !!(e['MAILCHIMP_API_KEY']),                             'MAILCHIMP_API_KEY'],
      // ── Analytics ────────────────────────────────────────────────────────────
      ['GA4',          !!(e['GA4_PROPERTY_ID'] && e['GA4_SERVICE_ACCOUNT_JSON']), 'GA4_PROPERTY_ID + GA4_SERVICE_ACCOUNT_JSON'],
      ['Instatus',     !!(e['INSTATUS_PAGE_ID']),                              'INSTATUS_PAGE_ID'],
      ['Hacker News',  true,                                                   ''],   // always on — public API
      // ── Finance ──────────────────────────────────────────────────────────────
      ['Alpha Vantage', !!(e['ALPHA_VANTAGE_KEY'] && e['AV_SYMBOLS']),        'ALPHA_VANTAGE_KEY + AV_SYMBOLS'],
      ['CoinGecko',    !!(e['COINGECKO_COINS']),                               'COINGECKO_COINS'],
      ['Finnhub',      !!(e['FINNHUB_TOKEN'] && e['FH_SYMBOLS']),             'FINNHUB_TOKEN + FH_SYMBOLS'],
      ['Plaid',        !!(e['PLAID_ACCESS_TOKEN'] && e['PLAID_CLIENT_ID'] && e['PLAID_SECRET']), 'PLAID_ACCESS_TOKEN + PLAID_CLIENT_ID + PLAID_SECRET'],
      // ── Security ─────────────────────────────────────────────────────────────
      ['HIBP',         !!(e['HIBP_API_KEY'] && e['HIBP_EMAILS']),             'HIBP_API_KEY + HIBP_EMAILS'],
      ['VirusTotal',   !!(e['VIRUSTOTAL_API_KEY'] && e['VT_DOMAINS']),        'VIRUSTOTAL_API_KEY + VT_DOMAINS'],
      ['Shodan',       !!(e['SHODAN_API_KEY']),                                'SHODAN_API_KEY'],
      // ── E-commerce ───────────────────────────────────────────────────────────
      ['WooCommerce',  !!(e['WC_BASE_URL'] && e['WC_CONSUMER_KEY'] && e['WC_CONSUMER_SECRET']), 'WC_BASE_URL + WC_CONSUMER_KEY + WC_CONSUMER_SECRET'],
      ['Shopify',      !!(e['SHOPIFY_SHOP'] && e['SHOPIFY_ACCESS_TOKEN']),    'SHOPIFY_SHOP + SHOPIFY_ACCESS_TOKEN'],
      // ── Social ────────────────────────────────────────────────────────────────
      ['Reddit',       !!(e['REDDIT_SUBREDDITS'] || e['REDDIT_KEYWORDS']),    'REDDIT_SUBREDDITS or REDDIT_KEYWORDS'],
      ['Product Hunt', !!(e['PRODUCTHUNT_API_TOKEN']),                         'PRODUCTHUNT_API_TOKEN'],
    ];

    const maxLabel = Math.max(...cfgs.map(([l]) => l.length));
    const configuredCount = cfgs.filter(([, v]) => v).length;

    console.log(`\nTWM API server → http://localhost:${PORT}`);
    console.log(`  ${configuredCount}/${cfgs.length} integrations configured\n`);

    // Group output by category
    const groups: [string, string[]][] = [
      ['Payments & Billing',   ['Stripe','PayPal','WooCommerce','Shopify']],
      ['Deployments',          ['Vercel','Netlify']],
      ['CI / Build',           ['GitHub','CircleCI','Travis CI','Bitrise','SonarQube','Azure DevOps','Docker Hub']],
      ['Package / CDN',        ['npm Registry','jsDelivr']],
      ['Productivity',         ['WakaTime','Clockify','Linear','Jira']],
      ['Comms',                ['Slack','Discord','Mailchimp']],
      ['Analytics',            ['GA4','Instatus','Hacker News']],
      ['Finance',              ['Alpha Vantage','CoinGecko','Finnhub','Plaid']],
      ['Security',             ['HIBP','VirusTotal','Shodan']],
      ['Social',               ['Reddit','Product Hunt']],
      ['Infrastructure',       ['Cloudflare']],
    ];

    for (const [groupName, labels] of groups) {
      console.log(`  ── ${groupName}`);
      for (const label of labels) {
        const cfg = cfgs.find(([l]) => l === label);
        if (!cfg) continue;
        const [, v, hint] = cfg;
        const pad = label.padEnd(maxLabel);
        console.log(`    ${pad}  ${ok(v, hint)}`);
      }
    }
    console.log('');
  });
}
