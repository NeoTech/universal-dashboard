/**
 * Shared utilities and constants for FLINT tile components.
 */
import type { FlintOrder, FlintOrderStatus } from '../../data/flint';

// ── Currency formatting ───────────────────────────────────────────────────────

/**
 * Format a decimal dollar amount as a currency string.
 * LOPC stores prices as decimal dollars (e.g. 29.99), not cents.
 * Falls back to 'USD' when currency is omitted.
 */
export function formatCurrency(amount: number, currency = 'USD'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: (currency || 'USD').toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Return a human-readable relative time string for an ISO date string.
 * E.g. "3 minutes ago", "2 days ago".
 */
export function timeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60)   return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60)   return `${mins}m ago`;
  const hrs  = Math.floor(mins / 60);
  if (hrs < 24)    return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30)   return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/** Format an ISO date string as "Jan 1, 25" */
export function fmtDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: '2-digit',
  });
}

// ── Order status labels and colors ───────────────────────────────────────────

export const ORDER_STATUS_LABELS: Record<FlintOrderStatus, string> = {
  pending:    'Pending',
  confirmed:  'Confirmed',
  processing: 'Processing',
  shipped:    'Shipped',
  delivered:  'Delivered',
  cancelled:  'Cancelled',
  refunded:   'Refunded',
  hidden:     'Hidden',
};

/** CSS class suffixes for order status badges (use with .flint-status--*). */
export const ORDER_STATUS_COLORS: Record<FlintOrderStatus, string> = {
  pending:    'pending',
  confirmed:  'confirmed',
  processing: 'processing',
  shipped:    'shipped',
  delivered:  'delivered',
  cancelled:  'cancelled',
  refunded:   'refunded',
  hidden:     'hidden',
};

// ── Status pipeline transitions ───────────────────────────────────────────────

const VALID_TRANSITIONS: Partial<Record<FlintOrderStatus, FlintOrderStatus[]>> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
};

/** Action label shown on the advance button for a target status. */
const ACTION_LABELS: Partial<Record<FlintOrderStatus, string>> = {
  confirmed: 'Confirm Order',
  processing: 'Mark Processing',
  shipped: 'Mark Shipped',
  delivered: 'Mark Delivered',
  cancelled: 'Cancel Order',
  refunded: 'Mark Refunded',
};

/** Next actions available for the given status. */
export function nextActions(status: FlintOrderStatus): { label: string; targetStatus: FlintOrderStatus }[] {
  const targets = VALID_TRANSITIONS[status] ?? [];
  return targets.map((targetStatus) => ({
    label: ACTION_LABELS[targetStatus] ?? targetStatus,
    targetStatus,
  }));
}

// ── Stock helpers ─────────────────────────────────────────────────────────────

/** CSS class suffix for stock level display. */
export function stockClass(stock: number): 'ok' | 'low' | 'zero' {
  if (stock === 0) return 'zero';
  if (stock <= 5)  return 'low';
  return 'ok';
}

// ── Order line normalization ──────────────────────────────────────────────────

/**
 * Normalize order line items from raw API response.
 * Handles both camelCase and snake_case field names, with sensible defaults.
 * Used by all tiles that display order details.
 */
export function normalizeOrderLines(order: FlintOrder): FlintOrder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawLines: any[] = Array.isArray(order.lines) ? order.lines : [];
  return {
    ...order,
    lines: rawLines.map((l) => ({
      id:          l.id ?? '',
      productId:   l.productId   ?? l.product_id   ?? '',
      variantId:   l.variantId   ?? l.variant_id,
      productName: l.productName ?? l.product_name ?? l.name ?? '\u2014',
      variantName: l.variantName ?? l.variant_name,
      quantity:    l.quantity ?? l.qty ?? 0,
      unitPrice:   l.unitPrice  ?? l.unit_price  ?? l.price ?? 0,
      totalPrice:  l.totalPrice ?? l.total_price ?? (((l.quantity ?? l.qty ?? 0) * (l.unitPrice ?? l.unit_price ?? l.price ?? 0)) || 0),
      currency:    l.currency   ?? order.currency ?? 'USD',
    })),
  };
}
