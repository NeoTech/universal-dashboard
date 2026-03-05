/**
 * TypeScript interfaces for the FLINT (LOPC) e-commerce API.
 *
 * All entities are returned by the LOPC Cloudflare Workers API at
 * {@link https://lopc-api.andreas-016.workers.dev} and proxied server-side
 * through `api/providers/flint.ts`.
 */

// ── Generic envelope ─────────────────────────────────────────────────────────

/** Standard API response envelope used by most LOPC list/detail endpoints. */
export interface FlintApiResponse<T> {
  data: T;
  message?: string;
  success?: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Response from POST /auth/login or POST /auth/refresh. */
export interface FlintAuthResponse {
  accessToken: string;
  refreshToken: string;
  user?: { email: string; role?: string };
}

/** Session health payload broadcast on the `flint-session` SSE channel. */
export interface FlintSessionStatus {
  authenticated: boolean;
  email?: string;
  expiresAt?: number;
}

// ── Orders ───────────────────────────────────────────────────────────────────

/**
 * Order statuses as defined by the LOPC API.
 * Valid transitions are enforced by `nextActions()` in `src/tiles/flint/utils.ts`.
 */
export type FlintOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refunded'
  | 'hidden';

/** A line item within an order. */
export interface FlintOrderLine {
  id: string;
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  currency: string;
}

/** Full order record returned by GET /orders and GET /orders/:id. */
export interface FlintOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: FlintOrderStatus;
  paymentIntentId?: string;
  stripeSessionId?: string;
  totalAmount: number;
  lineCount?: number;
  currency: string;
  lines: FlintOrderLine[];
  shippingAddress?: FlintAddress;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Products ─────────────────────────────────────────────────────────────────

/** Product publication status. */
export type FlintProductStatus = 'active' | 'draft' | 'archived';

/** A product variant (e.g. size, colour). */
export interface FlintVariant {
  id: string;
  productId: string;
  name: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  attributes?: Record<string, string>;
}

/** Full product record. */
export interface FlintProduct {
  id: string;
  name: string;
  description?: string;
  status: FlintProductStatus;
  categoryId?: string;
  categoryName?: string;
  price: number;
  compareAtPrice?: number;
  stock: number;
  sku?: string;
  images?: string[];
  variants?: FlintVariant[];
  createdAt: string;
  updatedAt: string;
}

// ── Categories ───────────────────────────────────────────────────────────────

/** A product category (supports parent/child hierarchy). */
export interface FlintCategory {
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  sortOrder: number;
  productCount?: number;
}

// ── Customers ────────────────────────────────────────────────────────────────

/** A shipping or billing address. */
export interface FlintAddress {
  id?: string;
  customerId?: string;
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
}

/** Full customer record. */
export interface FlintCustomer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  stripeCustomerId?: string;
  totalOrders: number;
  totalSpent: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

// ── Shipments ────────────────────────────────────────────────────────────────

/** Shipment status. */
export type FlintShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'returned' | 'failed';

/** A shipment record linked to an order. */
export interface FlintShipment {
  id: string;
  orderId: string;
  orderNumber?: string;
  carrier: string;
  trackingNumber: string;
  status: FlintShipmentStatus;
  estimatedDelivery?: string;
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

/** Tracking info returned by GET /tracking/:trackingNumber. */
export interface FlintTrackingInfo {
  carrier: string;
  trackingNumber: string;
  status: string;
  lastUpdate?: string;
  events?: Array<{ timestamp: string; location?: string; description: string }>;
}

// ── Dashboard summary ─────────────────────────────────────────────────────────

/** Aggregated KPIs returned by the dashboard summary endpoint. */
export interface FlintDashboardSummary {
  ordersToday: number;
  revenueToday: number;
  currency: string;
  newCustomersToday: number;
  lowStockCount: number;
  pendingOrders: number;
  processingOrders: number;
}

// ── Sales data ───────────────────────────────────────────────────────────────

/** A single data point in a sales time-series. */
export interface FlintSalesPoint {
  date: string;
  revenue: number;
  orderCount: number;
  currency: string;
}

// ── Inventory ─────────────────────────────────────────────────────────────────

/** A row in the inventory view (flattened product + variant). */
export interface FlintInventoryRow {
  productId: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  sku?: string;
  stock: number;
  price: number;
  currency: string;
  status: FlintProductStatus;
  isLowStock: boolean;
}

// ── Customer reports ─────────────────────────────────────────────────────────

/** Aggregated customer metrics. */
export interface FlintCustomerReport {
  totalActive: number;
  totalInactive: number;
  newThisMonth: number;
  churnRate?: number;
  newPerDay: Array<{ date: string; count: number }>;
}

// ── Data health ───────────────────────────────────────────────────────────────

/** Diagnostic health report from the admin endpoint. */
export interface FlintDataHealth {
  tableCounts: Record<string, number>;
  orphanedOrderLines: number;
  duplicateAddresses: number;
  stuckWebhooks: number;
  unlinkedStripePayments: number;
  lastCheckedAt: string;
}

// ── Webhooks ─────────────────────────────────────────────────────────────────

/** A Stripe webhook event record stored in LOPC. */
export interface FlintWebhookEvent {
  id: string;
  stripeEventId: string;
  type: string;
  amount?: number;
  currency?: string;
  stripeSessionId?: string;
  processed: boolean;
  error?: string;
  receivedAt: string;
}
