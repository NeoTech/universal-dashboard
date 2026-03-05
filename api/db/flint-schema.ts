/**
 * Drizzle ORM schema for the FLINT cache database.
 *
 * Three tables:
 * - resource_cache: Server-side L1/L2 cache for FLINT API resource snapshots.
 * - command_queue:  Durable queue for mutations (order status changes, stock
 *                   edits, shipment creation, etc.) with retry logic.
 * - ws_subscriptions: Tracks which WebSocket connections are subscribed to
 *                     which FLINT resources for targeted broadcast fan-out.
 */

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// ── Resource cache ────────────────────────────────────────────────────────────

export const resourceCache = sqliteTable('resource_cache', {
  /** SSE channel / resource identifier, e.g. 'flint-orders'. */
  id: text('id').primaryKey(),

  /** Logical resource group for bulk purge, e.g. 'flint-orders'. */
  resource: text('resource').notNull(),

  /** JSON-serialised snapshot of the resource payload. */
  data: text('data').notNull(),

  /** Optional ETag from upstream for conditional fetches. */
  etag: text('etag'),

  /** Unix epoch ms when this entry was cached. */
  cachedAt: integer('cached_at').notNull(),

  /** Unix epoch ms when this entry expires (cachedAt + ttl). */
  expiresAt: integer('expires_at').notNull(),
});

// ── Command queue ─────────────────────────────────────────────────────────────

export const commandQueue = sqliteTable('command_queue', {
  /** UUID primary key generated at enqueue time. */
  id: text('id').primaryKey(),

  /** Target resource, e.g. 'flint-orders'. */
  resource: text('resource').notNull(),

  /** HTTP method for the upstream LOPC call, e.g. 'PUT', 'POST', 'DELETE'. */
  method: text('method').notNull(),

  /** LOPC API path, e.g. '/orders/abc/status'. */
  path: text('path').notNull(),

  /** JSON-serialised request body (nullable for GET/DELETE). */
  payload: text('payload'),

  /** Queue status: pending | processing | completed | failed. */
  status: text('status').notNull().$default(() => 'pending'),

  /** Unix epoch ms when enqueued. */
  createdAt: integer('created_at').notNull(),

  /** Unix epoch ms when processing started (null until dequeued). */
  startedAt: integer('started_at'),

  /** Unix epoch ms when processing finished (null until done). */
  completedAt: integer('completed_at'),

  /** JSON-serialised result on success. */
  result: text('result'),

  /** Error message on failure. */
  error: text('error'),

  /** Number of times this command has been retried after failure. */
  retryCount: integer('retry_count').notNull().$default(() => 0),
});

// ── WebSocket subscriptions ───────────────────────────────────────────────────

export const wsSubscriptions = sqliteTable('ws_subscriptions', {
  /** UUID of the connected WebSocket client. */
  connectionId: text('connection_id').notNull(),

  /** Resource channel the client is subscribed to, e.g. 'flint-orders'. */
  resource: text('resource').notNull(),

  /** Unix epoch ms when the subscription was created. */
  subscribedAt: integer('subscribed_at').notNull(),
});

// ── Normalized FLINT projections ─────────────────────────────────────────────

export const flintOrders = sqliteTable('flint_orders', {
  id: text('id').primaryKey(),
  orderNumber: text('order_number').notNull(),
  customerId: text('customer_id').notNull(),
  customerName: text('customer_name').notNull(),
  customerEmail: text('customer_email').notNull(),
  status: text('status').notNull(),
  paymentIntentId: text('payment_intent_id'),
  stripeSessionId: text('stripe_session_id'),
  totalAmount: integer('total_amount').notNull(),
  currency: text('currency').notNull(),
  shippingAddressJson: text('shipping_address_json'),
  notes: text('notes'),
  createdAtIso: text('created_at_iso').notNull(),
  updatedAtIso: text('updated_at_iso').notNull(),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

export const flintOrderLines = sqliteTable('flint_order_lines', {
  id: text('id').primaryKey(),
  orderId: text('order_id').notNull(),
  productId: text('product_id').notNull(),
  variantId: text('variant_id'),
  productName: text('product_name').notNull(),
  variantName: text('variant_name'),
  quantity: integer('quantity').notNull(),
  unitPrice: integer('unit_price').notNull(),
  totalPrice: integer('total_price').notNull(),
  currency: text('currency').notNull(),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

export const flintCustomers = sqliteTable('flint_customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  stripeCustomerId: text('stripe_customer_id'),
  totalOrders: integer('total_orders').notNull(),
  totalSpent: integer('total_spent').notNull(),
  currency: text('currency').notNull(),
  createdAtIso: text('created_at_iso').notNull(),
  updatedAtIso: text('updated_at_iso').notNull(),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

export const flintAddresses = sqliteTable('flint_addresses', {
  id: text('id').primaryKey(),
  customerId: text('customer_id').notNull(),
  name: text('name'),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state'),
  postalCode: text('postal_code').notNull(),
  country: text('country').notNull(),
  isDefault: integer('is_default').notNull(),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

// ── Normalized product + category projections ─────────────────────────────────

export const flintProducts = sqliteTable('flint_products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  categoryId: text('category_id'),
  price: integer('price').notNull(),
  compareAtPrice: integer('compare_at_price'),
  stock: integer('stock').notNull(),
  sku: text('sku'),
  imagesJson: text('images_json'),
  variantsJson: text('variants_json'),
  createdAtIso: text('created_at_iso').notNull(),
  updatedAtIso: text('updated_at_iso').notNull(),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

export const flintCategories = sqliteTable('flint_categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  parentId: text('parent_id'),
  sortOrder: integer('sort_order').notNull(),
  productCount: integer('product_count'),
  revision: integer('revision').notNull(),
  cachedAt: integer('cached_at').notNull(),
});

// ── Inferred types ────────────────────────────────────────────────────────────

export type ResourceCacheRow = typeof resourceCache.$inferSelect;
export type InsertResourceCache = typeof resourceCache.$inferInsert;

export type CommandQueueRow = typeof commandQueue.$inferSelect;
export type InsertCommandQueue = typeof commandQueue.$inferInsert;

export type WsSubscriptionRow = typeof wsSubscriptions.$inferSelect;
export type InsertWsSubscription = typeof wsSubscriptions.$inferInsert;

export type FlintOrderRow = typeof flintOrders.$inferSelect;
export type InsertFlintOrder = typeof flintOrders.$inferInsert;

export type FlintOrderLineRow = typeof flintOrderLines.$inferSelect;
export type InsertFlintOrderLine = typeof flintOrderLines.$inferInsert;

export type FlintCustomerRow = typeof flintCustomers.$inferSelect;
export type InsertFlintCustomer = typeof flintCustomers.$inferInsert;

export type FlintAddressRow = typeof flintAddresses.$inferSelect;
export type InsertFlintAddress = typeof flintAddresses.$inferInsert;

export type FlintProductRow = typeof flintProducts.$inferSelect;
export type InsertFlintProduct = typeof flintProducts.$inferInsert;

export type FlintCategoryRow = typeof flintCategories.$inferSelect;
export type InsertFlintCategory = typeof flintCategories.$inferInsert;
