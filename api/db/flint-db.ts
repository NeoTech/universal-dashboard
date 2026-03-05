/**
 * Drizzle ORM client for the FLINT cache database (flint-cache.db).
 *
 * Provides a typed Drizzle instance backed by bun:sqlite with WAL mode
 * for concurrent read performance, plus helper functions for cache CRUD:
 *
 * - upsertCache(resource, data, ttlMs) — insert or refresh a cache entry
 * - getCache<T>(resource)              — read if not expired, else null
 * - purgeExpired()                     — delete all rows past their TTL
 */

import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { eq, lt } from 'drizzle-orm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './flint-schema.ts';
import type {
  FlintOrder,
  FlintOrderLine,
  FlintOrderStatus,
  FlintAddress,
  FlintCustomer,
  FlintProduct,
  FlintCategory,
} from '../../src/data/flint.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', '..', 'flint-cache.db');

// ── SQLite connection ─────────────────────────────────────────────────────────

const sqlite = new Database(DB_PATH, { create: true });
sqlite.run('PRAGMA journal_mode=WAL');
sqlite.run('PRAGMA busy_timeout=5000');

// ── Drizzle instance ──────────────────────────────────────────────────────────

export const db = drizzle({ client: sqlite, schema });

// ── Auto-create tables (inline migration) ─────────────────────────────────────

sqlite.run(`CREATE TABLE IF NOT EXISTS resource_cache (
  id         TEXT PRIMARY KEY,
  resource   TEXT NOT NULL,
  data       TEXT NOT NULL,
  etag       TEXT,
  cached_at  INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS command_queue (
  id           TEXT PRIMARY KEY,
  resource     TEXT NOT NULL,
  method       TEXT NOT NULL,
  path         TEXT NOT NULL,
  payload      TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',
  created_at   INTEGER NOT NULL,
  started_at   INTEGER,
  completed_at INTEGER,
  result       TEXT,
  error        TEXT,
  retry_count  INTEGER NOT NULL DEFAULT 0
)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS ws_subscriptions (
  connection_id TEXT NOT NULL,
  resource      TEXT NOT NULL,
  subscribed_at INTEGER NOT NULL,
  PRIMARY KEY (connection_id, resource)
)`);

// Index for fast subscription lookups by resource
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_ws_sub_resource ON ws_subscriptions(resource)`);

// Index for queue processing (oldest pending first)
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_cmd_status ON command_queue(status, created_at)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_orders (
  id                    TEXT PRIMARY KEY,
  order_number          TEXT NOT NULL,
  customer_id           TEXT NOT NULL,
  customer_name         TEXT NOT NULL,
  customer_email        TEXT NOT NULL,
  status                TEXT NOT NULL,
  payment_intent_id     TEXT,
  stripe_session_id     TEXT,
  total_amount          INTEGER NOT NULL,
  currency              TEXT NOT NULL,
  shipping_address_json TEXT,
  notes                 TEXT,
  created_at_iso        TEXT NOT NULL,
  updated_at_iso        TEXT NOT NULL,
  revision              INTEGER NOT NULL,
  cached_at             INTEGER NOT NULL
)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_order_lines (
  id          TEXT PRIMARY KEY,
  order_id    TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  variant_id  TEXT,
  product_name TEXT NOT NULL,
  variant_name TEXT,
  quantity    INTEGER NOT NULL,
  unit_price  INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  currency    TEXT NOT NULL,
  revision    INTEGER NOT NULL,
  cached_at   INTEGER NOT NULL
)`);

sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_orders_created ON flint_orders(created_at_iso DESC)`);
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_orders_email ON flint_orders(customer_email)`);
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_order_lines_order ON flint_order_lines(order_id)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_customers (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT NOT NULL,
  phone             TEXT,
  stripe_customer_id TEXT,
  total_orders      INTEGER NOT NULL,
  total_spent       INTEGER NOT NULL,
  currency          TEXT NOT NULL,
  created_at_iso    TEXT NOT NULL,
  updated_at_iso    TEXT NOT NULL,
  revision          INTEGER NOT NULL,
  cached_at         INTEGER NOT NULL
)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_addresses (
  id          TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name        TEXT,
  line1       TEXT NOT NULL,
  line2       TEXT,
  city        TEXT NOT NULL,
  state       TEXT,
  postal_code TEXT NOT NULL,
  country     TEXT NOT NULL,
  is_default  INTEGER NOT NULL,
  revision    INTEGER NOT NULL,
  cached_at   INTEGER NOT NULL
)`);

sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_customers_email ON flint_customers(email)`);
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_addresses_customer ON flint_addresses(customer_id)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_products (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  description       TEXT,
  status            TEXT NOT NULL,
  category_id       TEXT,
  price             INTEGER NOT NULL,
  compare_at_price  INTEGER,
  stock             INTEGER NOT NULL,
  sku               TEXT,
  images_json       TEXT,
  variants_json     TEXT,
  created_at_iso    TEXT NOT NULL,
  updated_at_iso    TEXT NOT NULL,
  revision          INTEGER NOT NULL,
  cached_at         INTEGER NOT NULL
)`);

sqlite.run(`CREATE TABLE IF NOT EXISTS flint_categories (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  parent_id     TEXT,
  sort_order    INTEGER NOT NULL,
  product_count INTEGER,
  revision      INTEGER NOT NULL,
  cached_at     INTEGER NOT NULL
)`);

sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_products_status ON flint_products(status)`);
sqlite.run(`CREATE INDEX IF NOT EXISTS idx_flint_products_category ON flint_products(category_id)`);

// ── Cache helpers ─────────────────────────────────────────────────────────────

/**
 * Insert or update a cache entry for the given resource.
 *
 * @param resource - Channel/resource identifier, e.g. 'flint-orders'.
 * @param data     - The payload to cache (will be JSON-stringified).
 * @param ttlMs    - Time-to-live in milliseconds (default: 5 minutes).
 * @param etag     - Optional ETag for conditional upstream requests.
 */
export function upsertCache(
  resource: string,
  data: unknown,
  ttlMs = 300_000,
  etag?: string,
): void {
  const now = Date.now();
  db.insert(schema.resourceCache)
    .values({
      id: resource,
      resource,
      data: JSON.stringify(data),
      etag: etag ?? null,
      cachedAt: now,
      expiresAt: now + ttlMs,
    })
    .onConflictDoUpdate({
      target: schema.resourceCache.id,
      set: {
        data: JSON.stringify(data),
        etag: etag ?? null,
        cachedAt: now,
        expiresAt: now + ttlMs,
      },
    })
    .run();
}

/**
 * Read a cached resource if it has not expired.
 *
 * @param resource - Channel/resource identifier.
 * @returns The parsed payload, or `null` if missing or expired.
 */
export function getCache<T = unknown>(resource: string): T | null {
  const row = db
    .select()
    .from(schema.resourceCache)
    .where(eq(schema.resourceCache.id, resource))
    .get();

  if (!row) return null;
  if (row.expiresAt < Date.now()) return null;

  try {
    return JSON.parse(row.data) as T;
  } catch {
    return null;
  }
}

/**
 * Delete all cache entries whose `expires_at` is in the past.
 *
 * @returns The number of rows deleted.
 */
export function purgeExpired(): number {
  const result = db
    .delete(schema.resourceCache)
    .where(lt(schema.resourceCache.expiresAt, Date.now()))
    .run();
  return result.changes;
}

/**
 * Check that WAL mode is active (useful in tests).
 */
export function isWalMode(): boolean {
  const row = sqlite.query<{ journal_mode: string }, []>('PRAGMA journal_mode').get();
  return row?.journal_mode === 'wal';
}

/**
 * Get the file size of the database in bytes.
 */
export function getDbSizeBytes(): number {
  try {
    const file = Bun.file(DB_PATH);
    return file.size;
  } catch {
    return 0;
  }
}

/**
 * Close the database connection. Used in tests for cleanup.
 */
export function closeDb(): void {
  sqlite.close();
}

let projectionRevision = 0;

function nextProjectionRevision(): number {
  const now = Date.now();
  projectionRevision = Math.max(projectionRevision + 1, now);
  return projectionRevision;
}

function parseShippingAddress(json: string | null): FlintAddress | undefined {
  if (!json) return undefined;
  try {
    return JSON.parse(json) as FlintAddress;
  } catch {
    return undefined;
  }
}

function mapOrderRows(rows: Array<{
  id: string;
  order_number: string;
  customer_id: string;
  customer_name: string;
  customer_email: string;
  status: string;
  payment_intent_id: string | null;
  stripe_session_id: string | null;
  total_amount: number;
  currency: string;
  shipping_address_json: string | null;
  notes: string | null;
  created_at_iso: string;
  updated_at_iso: string;
}>,
linesByOrderId: Map<string, FlintOrderLine[]>,
): FlintOrder[] {
  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    status: row.status as FlintOrderStatus,
    paymentIntentId: row.payment_intent_id ?? undefined,
    stripeSessionId: row.stripe_session_id ?? undefined,
    totalAmount: row.total_amount,
    currency: row.currency,
    lines: linesByOrderId.get(row.id) ?? [],
    shippingAddress: parseShippingAddress(row.shipping_address_json),
    notes: row.notes ?? undefined,
    createdAt: row.created_at_iso,
    updatedAt: row.updated_at_iso,
  }));
}

function getLinesByOrderIds(orderIds: string[]): Map<string, FlintOrderLine[]> {
  const out = new Map<string, FlintOrderLine[]>();
  if (orderIds.length === 0) return out;

  const placeholders = orderIds.map(() => '?').join(',');
  const stmt = sqlite.prepare(`
    SELECT id, order_id, product_id, variant_id, product_name, variant_name,
           quantity, unit_price, total_price, currency
    FROM flint_order_lines
    WHERE order_id IN (${placeholders})
    ORDER BY order_id, id
  `);

  const rows = stmt.all(...orderIds) as Array<{
    id: string;
    order_id: string;
    product_id: string;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    quantity: number;
    unit_price: number;
    total_price: number;
    currency: string;
  }>;

  for (const row of rows) {
    const list = out.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      productId: row.product_id,
      variantId: row.variant_id ?? undefined,
      productName: row.product_name,
      variantName: row.variant_name ?? undefined,
      quantity: row.quantity,
      unitPrice: row.unit_price,
      totalPrice: row.total_price,
      currency: row.currency,
    });
    out.set(row.order_id, list);
  }

  return out;
}

export function replaceProjectedOrders(orders: FlintOrder[]): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    sqlite.run('DELETE FROM flint_order_lines');
    sqlite.run('DELETE FROM flint_orders');

    for (const order of orders) {
      db.insert(schema.flintOrders).values({
        id: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        status: order.status,
        paymentIntentId: order.paymentIntentId ?? null,
        stripeSessionId: order.stripeSessionId ?? null,
        totalAmount: order.totalAmount,
        currency: order.currency,
        shippingAddressJson: order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
        notes: order.notes ?? null,
        createdAtIso: order.createdAt,
        updatedAtIso: order.updatedAt,
        revision,
        cachedAt: now,
      }).run();

      for (const line of order.lines) {
        const lineId = line.id && line.id.trim().length > 0
          ? line.id
          : `${order.id}:${line.productId}:${line.variantId ?? ''}`;
        db.insert(schema.flintOrderLines).values({
          id: lineId,
          orderId: order.id,
          productId: line.productId,
          variantId: line.variantId ?? null,
          productName: line.productName,
          variantName: line.variantName ?? null,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          totalPrice: line.totalPrice,
          currency: line.currency,
          revision,
          cachedAt: now,
        }).run();
      }
    }

    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function upsertProjectedOrder(order: FlintOrder): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    db.insert(schema.flintOrders).values({
      id: order.id,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      status: order.status,
      paymentIntentId: order.paymentIntentId ?? null,
      stripeSessionId: order.stripeSessionId ?? null,
      totalAmount: order.totalAmount,
      currency: order.currency,
      shippingAddressJson: order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
      notes: order.notes ?? null,
      createdAtIso: order.createdAt,
      updatedAtIso: order.updatedAt,
      revision,
      cachedAt: now,
    }).onConflictDoUpdate({
      target: schema.flintOrders.id,
      set: {
        orderNumber: order.orderNumber,
        customerId: order.customerId,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        status: order.status,
        paymentIntentId: order.paymentIntentId ?? null,
        stripeSessionId: order.stripeSessionId ?? null,
        totalAmount: order.totalAmount,
        currency: order.currency,
        shippingAddressJson: order.shippingAddress ? JSON.stringify(order.shippingAddress) : null,
        notes: order.notes ?? null,
        createdAtIso: order.createdAt,
        updatedAtIso: order.updatedAt,
        revision,
        cachedAt: now,
      },
    }).run();

    db.delete(schema.flintOrderLines).where(eq(schema.flintOrderLines.orderId, order.id)).run();

    for (const line of order.lines) {
      const lineId = line.id && line.id.trim().length > 0
        ? line.id
        : `${order.id}:${line.productId}:${line.variantId ?? ''}`;
      db.insert(schema.flintOrderLines).values({
        id: lineId,
        orderId: order.id,
        productId: line.productId,
        variantId: line.variantId ?? null,
        productName: line.productName,
        variantName: line.variantName ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        totalPrice: line.totalPrice,
        currency: line.currency,
        revision,
        cachedAt: now,
      }).run();
    }

    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function getProjectedOrders(): FlintOrder[] {
  const rows = sqlite.prepare(`
    SELECT id, order_number, customer_id, customer_name, customer_email, status,
           payment_intent_id, stripe_session_id, total_amount, currency,
           shipping_address_json, notes, created_at_iso, updated_at_iso
    FROM flint_orders
    ORDER BY created_at_iso DESC
  `).all() as Array<{
    id: string;
    order_number: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    payment_intent_id: string | null;
    stripe_session_id: string | null;
    total_amount: number;
    currency: string;
    shipping_address_json: string | null;
    notes: string | null;
    created_at_iso: string;
    updated_at_iso: string;
  }>;

  const linesByOrderId = getLinesByOrderIds(rows.map((row) => row.id));
  return mapOrderRows(rows, linesByOrderId);
}

export function getProjectedOrderById(orderId: string): FlintOrder | null {
  const row = sqlite.prepare(`
    SELECT id, order_number, customer_id, customer_name, customer_email, status,
           payment_intent_id, stripe_session_id, total_amount, currency,
           shipping_address_json, notes, created_at_iso, updated_at_iso
    FROM flint_orders
    WHERE id = ?
    LIMIT 1
  `).get(orderId) as {
    id: string;
    order_number: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    payment_intent_id: string | null;
    stripe_session_id: string | null;
    total_amount: number;
    currency: string;
    shipping_address_json: string | null;
    notes: string | null;
    created_at_iso: string;
    updated_at_iso: string;
  } | null;

  if (!row) return null;
  const linesByOrderId = getLinesByOrderIds([orderId]);
  return mapOrderRows([row], linesByOrderId)[0] ?? null;
}

function mapCustomerRows(rows: Array<{
  id: string;
  name: string;
  email: string;
  phone: string | null;
  stripe_customer_id: string | null;
  total_orders: number;
  total_spent: number;
  currency: string;
  created_at_iso: string;
  updated_at_iso: string;
}>): FlintCustomer[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    stripeCustomerId: row.stripe_customer_id ?? undefined,
    totalOrders: row.total_orders,
    totalSpent: row.total_spent,
    currency: row.currency,
    createdAt: row.created_at_iso,
    updatedAt: row.updated_at_iso,
  }));
}

export function replaceProjectedCustomers(customers: FlintCustomer[]): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    sqlite.run('DELETE FROM flint_customers');
    for (const customer of customers) {
      db.insert(schema.flintCustomers).values({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone ?? null,
        stripeCustomerId: customer.stripeCustomerId ?? null,
        totalOrders: customer.totalOrders,
        totalSpent: customer.totalSpent,
        currency: customer.currency,
        createdAtIso: customer.createdAt,
        updatedAtIso: customer.updatedAt,
        revision,
        cachedAt: now,
      }).run();
    }
    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function upsertProjectedCustomer(customer: FlintCustomer): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  db.insert(schema.flintCustomers).values({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone ?? null,
    stripeCustomerId: customer.stripeCustomerId ?? null,
    totalOrders: customer.totalOrders,
    totalSpent: customer.totalSpent,
    currency: customer.currency,
    createdAtIso: customer.createdAt,
    updatedAtIso: customer.updatedAt,
    revision,
    cachedAt: now,
  }).onConflictDoUpdate({
    target: schema.flintCustomers.id,
    set: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone ?? null,
      stripeCustomerId: customer.stripeCustomerId ?? null,
      totalOrders: customer.totalOrders,
      totalSpent: customer.totalSpent,
      currency: customer.currency,
      createdAtIso: customer.createdAt,
      updatedAtIso: customer.updatedAt,
      revision,
      cachedAt: now,
    },
  }).run();

  return revision;
}

export function getProjectedCustomers(): FlintCustomer[] {
  const rows = sqlite.prepare(`
    SELECT id, name, email, phone, stripe_customer_id, total_orders, total_spent,
           currency, created_at_iso, updated_at_iso
    FROM flint_customers
    ORDER BY created_at_iso DESC
  `).all() as Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    stripe_customer_id: string | null;
    total_orders: number;
    total_spent: number;
    currency: string;
    created_at_iso: string;
    updated_at_iso: string;
  }>;

  return mapCustomerRows(rows);
}

export function getProjectedCustomerById(customerId: string): FlintCustomer | null {
  const row = sqlite.prepare(`
    SELECT id, name, email, phone, stripe_customer_id, total_orders, total_spent,
           currency, created_at_iso, updated_at_iso
    FROM flint_customers
    WHERE id = ?
    LIMIT 1
  `).get(customerId) as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    stripe_customer_id: string | null;
    total_orders: number;
    total_spent: number;
    currency: string;
    created_at_iso: string;
    updated_at_iso: string;
  } | null;

  if (!row) return null;
  return mapCustomerRows([row])[0] ?? null;
}

export function replaceProjectedCustomerAddresses(customerId: string, addresses: FlintAddress[]): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    db.delete(schema.flintAddresses).where(eq(schema.flintAddresses.customerId, customerId)).run();
    for (const address of addresses) {
      const addressId = address.id && address.id.trim().length > 0
        ? address.id
        : `${customerId}:${address.postalCode}:${address.line1}`;
      db.insert(schema.flintAddresses).values({
        id: addressId,
        customerId,
        name: address.name ?? null,
        line1: address.line1,
        line2: address.line2 ?? null,
        city: address.city,
        state: address.state ?? null,
        postalCode: address.postalCode,
        country: address.country,
        isDefault: address.isDefault ? 1 : 0,
        revision,
        cachedAt: now,
      }).run();
    }
    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function getProjectedCustomerAddresses(customerId: string): FlintAddress[] {
  const rows = sqlite.prepare(`
    SELECT id, customer_id, name, line1, line2, city, state, postal_code, country, is_default
    FROM flint_addresses
    WHERE customer_id = ?
    ORDER BY is_default DESC, id
  `).all(customerId) as Array<{
    id: string;
    customer_id: string;
    name: string | null;
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postal_code: string;
    country: string;
    is_default: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    customerId: row.customer_id,
    name: row.name ?? undefined,
    line1: row.line1,
    line2: row.line2 ?? undefined,
    city: row.city,
    state: row.state ?? undefined,
    postalCode: row.postal_code,
    country: row.country,
    isDefault: row.is_default === 1,
  }));
}

export function getProjectedCustomerOrders(customerId: string): FlintOrder[] {
  const rows = sqlite.prepare(`
    SELECT id, order_number, customer_id, customer_name, customer_email, status,
           payment_intent_id, stripe_session_id, total_amount, currency,
           shipping_address_json, notes, created_at_iso, updated_at_iso
    FROM flint_orders
    WHERE customer_id = ?
    ORDER BY created_at_iso DESC
  `).all(customerId) as Array<{
    id: string;
    order_number: string;
    customer_id: string;
    customer_name: string;
    customer_email: string;
    status: string;
    payment_intent_id: string | null;
    stripe_session_id: string | null;
    total_amount: number;
    currency: string;
    shipping_address_json: string | null;
    notes: string | null;
    created_at_iso: string;
    updated_at_iso: string;
  }>;

  const linesByOrderId = getLinesByOrderIds(rows.map((row) => row.id));
  return mapOrderRows(rows, linesByOrderId);
}

export function getProjectedCustomer360ByEmail(email: string): {
  customer: FlintCustomer | null;
  addresses: FlintAddress[];
  orders: FlintOrder[];
} {
  const normalizedEmail = email.trim().toLowerCase();
  const customerRow = sqlite.prepare(`
    SELECT id, name, email, phone, stripe_customer_id, total_orders, total_spent,
           currency, created_at_iso, updated_at_iso
    FROM flint_customers
    WHERE lower(email) = ?
    ORDER BY updated_at_iso DESC
    LIMIT 1
  `).get(normalizedEmail) as {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    stripe_customer_id: string | null;
    total_orders: number;
    total_spent: number;
    currency: string;
    created_at_iso: string;
    updated_at_iso: string;
  } | null;

  if (!customerRow) {
    return { customer: null, addresses: [], orders: [] };
  }

  const customer = mapCustomerRows([customerRow])[0] ?? null;
  const addresses = getProjectedCustomerAddresses(customerRow.id);
  const orders = getProjectedCustomerOrders(customerRow.id);
  return { customer, addresses, orders };
}

// ── Product projection ────────────────────────────────────────────────────────

export function replaceProjectedProducts(products: FlintProduct[]): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    sqlite.run('DELETE FROM flint_products');
    for (const product of products) {
      db.insert(schema.flintProducts).values({
        id: product.id,
        name: product.name,
        description: product.description ?? null,
        status: product.status,
        categoryId: product.categoryId ?? null,
        price: product.price,
        compareAtPrice: product.compareAtPrice ?? null,
        stock: product.stock,
        sku: product.sku ?? null,
        imagesJson: product.images ? JSON.stringify(product.images) : null,
        variantsJson: product.variants ? JSON.stringify(product.variants) : null,
        createdAtIso: product.createdAt,
        updatedAtIso: product.updatedAt,
        revision,
        cachedAt: now,
      }).run();
    }
    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function getProjectedProducts(): FlintProduct[] {
  const rows = sqlite.prepare(`
    SELECT id, name, description, status, category_id, price, compare_at_price,
           stock, sku, images_json, variants_json, created_at_iso, updated_at_iso
    FROM flint_products
    ORDER BY name ASC
  `).all() as Array<{
    id: string;
    name: string;
    description: string | null;
    status: string;
    category_id: string | null;
    price: number;
    compare_at_price: number | null;
    stock: number;
    sku: string | null;
    images_json: string | null;
    variants_json: string | null;
    created_at_iso: string;
    updated_at_iso: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    status: row.status as FlintProduct['status'],
    categoryId: row.category_id ?? undefined,
    price: row.price,
    compareAtPrice: row.compare_at_price ?? undefined,
    stock: row.stock,
    sku: row.sku ?? undefined,
    images: row.images_json ? JSON.parse(row.images_json) as string[] : undefined,
    variants: row.variants_json ? JSON.parse(row.variants_json) as FlintProduct['variants'] : undefined,
    createdAt: row.created_at_iso,
    updatedAt: row.updated_at_iso,
  }));
}

/**
 * Resolve product names by ID from the local projected products table.
 * Returns a Map<productId, productName>. This is the core function that
 * eliminates the need for upstream API calls to resolve line item names.
 */
export function getProductNameMap(): Map<string, string> {
  const rows = sqlite.prepare('SELECT id, name FROM flint_products').all() as Array<{
    id: string;
    name: string;
  }>;
  return new Map(rows.map((row) => [row.id, row.name]));
}

/**
 * Resolve a single product name by ID from the local cache.
 */
export function getProductNameById(productId: string): string | null {
  const row = sqlite.prepare('SELECT name FROM flint_products WHERE id = ? LIMIT 1')
    .get(productId) as { name: string } | null;
  return row?.name ?? null;
}

/**
 * Enrich order lines with product names from the local product cache.
 * Mutates nothing -- returns new line objects with resolved productName.
 */
export function resolveOrderLineNames(
  lines: FlintOrderLine[],
  nameMap?: Map<string, string>,
): FlintOrderLine[] {
  if (lines.length === 0) return lines;

  // Check if any lines actually need resolution
  const needResolution = lines.some(
    (l) => !l.productName || l.productName === '\u2014' || l.productName === l.productId,
  );
  if (!needResolution) return lines;

  const map = nameMap ?? getProductNameMap();
  return lines.map((line) => {
    if (line.productName && line.productName !== '\u2014' && line.productName !== line.productId) {
      return line;
    }
    const resolved = line.productId ? map.get(line.productId) : undefined;
    return { ...line, productName: resolved ?? line.productName ?? '\u2014' };
  });
}

/**
 * Enrich a full order's lines + store back into the projection table.
 * Call after fetching order detail when lines have unresolved names.
 */
export function enrichAndStoreOrder(order: FlintOrder): FlintOrder {
  const enrichedLines = resolveOrderLineNames(order.lines);
  const enriched = { ...order, lines: enrichedLines };
  upsertProjectedOrder(enriched);
  return enriched;
}

// ── Category projection ───────────────────────────────────────────────────────

export function replaceProjectedCategories(categories: FlintCategory[]): number {
  const now = Date.now();
  const revision = nextProjectionRevision();

  sqlite.run('BEGIN IMMEDIATE');
  try {
    sqlite.run('DELETE FROM flint_categories');
    for (const cat of categories) {
      db.insert(schema.flintCategories).values({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parentId: cat.parentId ?? null,
        sortOrder: cat.sortOrder,
        productCount: cat.productCount ?? null,
        revision,
        cachedAt: now,
      }).run();
    }
    sqlite.run('COMMIT');
    return revision;
  } catch (error) {
    sqlite.run('ROLLBACK');
    throw error;
  }
}

export function getProjectedCategories(): FlintCategory[] {
  const rows = sqlite.prepare(`
    SELECT id, name, slug, parent_id, sort_order, product_count
    FROM flint_categories
    ORDER BY sort_order ASC, name ASC
  `).all() as Array<{
    id: string;
    name: string;
    slug: string;
    parent_id: string | null;
    sort_order: number;
    product_count: number | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id ?? undefined,
    sortOrder: row.sort_order,
    productCount: row.product_count ?? undefined,
  }));
}

/**
 * Resolve a category name by ID from the local cache.
 */
export function getCategoryNameById(categoryId: string): string | null {
  const row = sqlite.prepare('SELECT name FROM flint_categories WHERE id = ? LIMIT 1')
    .get(categoryId) as { name: string } | null;
  return row?.name ?? null;
}
