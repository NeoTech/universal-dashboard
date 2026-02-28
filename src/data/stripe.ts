/**
 * Browser-side typed Stripe data client.
 * Fetches from the TWM API server via the shared api.ts fetch helpers.
 */

export { API_BASE_URL } from './api';
import { fetchResource, mutateResource } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StripePayment {
  id: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed';
  description: string | null;
  customer: string | null;
  created: number;
  receiptEmail: string | null;
}

export interface StripePaymentDetail extends StripePayment {
  receiptUrl: string | null;
  refunded: boolean;
  amountRefunded: number;
  captured: boolean;
  disputed: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  paymentIntent: string | null;
  billingDetails: { name: string | null; email: string | null; phone: string | null; address: Record<string, string | null> | null } | null;
  outcome: { networkStatus: string; reason: string | null; sellerMessage: string; type: string } | null;
}

export interface StripeProductPrice {
  amount: number | null;
  currency: string;
  interval?: string;
}

export interface StripePrice {
  id: string;
  active: boolean;
  currency: string;
  unitAmount: number | null;
  nickname: string | null;
  recurring: { interval: string; intervalCount: number } | null;
  type: string;
  created: number;
}

export interface StripeProduct {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  images: string[];
  created: number;
  updated?: number;
  price: StripeProductPrice | null;
  metadata?: Record<string, string>;
}

export interface StripeSubscription {
  id: string;
  status: 'active' | 'canceled' | 'incomplete' | 'past_due' | 'trialing' | 'unpaid' | 'paused';
  customer: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  items: Array<{ priceId: string; quantity: number | null }>;
  created: number;
}

export interface StripeSubscriptionDetail {
  id: string;
  status: string;
  customer: string | { id: string; email: string | null; name: string | null };
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  cancelAt: number | null;
  canceledAt: number | null;
  trialStart: number | null;
  trialEnd: number | null;
  items: Array<{ id: string; priceId: string; quantity: number | null; priceNickname: string | null; unitAmount: number | null; currency: string; interval: string | undefined }>;
  created: number;
  description: string | null;
  latestInvoice: string | null;
  metadata: Record<string, string>;
}

export interface StripeCustomersResponse {
  total: number;
  newThisMonth: number;
  list: Array<{
    id: string;
    email: string | null;
    name: string | null;
    created: number;
    currency: string | null;
  }>;
}

export interface StripeCustomerListItem {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  currency: string | null;
  balance: number;
  delinquent: boolean | null;
  description: string | null;
}

export interface StripeCustomerDetail {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  created: number;
  currency: string | null;
  balance: number;
  delinquent: boolean | null;
  description: string | null;
  metadata: Record<string, string>;
  address: Record<string, string | null> | null;
}

export interface StripeInvoice {
  id: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void' | null;
  customer: string | null;
  subscription: string | null;
  amountDue: number;
  amountPaid: number;
  total: number;
  currency: string;
  created: number;
  dueDate: number | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  number: string | null;
  attemptCount: number;
}

export interface StripeInvoiceDetail extends StripeInvoice {
  amountRemaining: number;
  subtotal: number;
  periodStart: number;
  periodEnd: number;
  nextPaymentAttempt: number | null;
  lines: Array<{ id: string; description: string | null; amount: number; currency: string; quantity: number | null; period: { start: number; end: number } | null }>;
  metadata: Record<string, string>;
}

export interface StripeRefund {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  reason: string | null;
  charge: string | null;
  paymentIntent: string | null;
  created: number;
  description: string | null;
}

export interface StripeWebhookEvent {
  id: string;
  type: string;
  created: number;
  livemode: boolean;
  apiVersion: string | null;
}

export interface StripeRevenuePoint {
  date: string;
  amount: number;
}

export interface StripeConfigStatus {
  ok: boolean;
  stripe: boolean;
}

// ── Fetch/mutate helpers ──────────────────────────────────────────────────────
// Re-exported from shared api.ts; kept as alias for backwards compatibility.
export { TwmApiError as StripeApiError } from './api';

// ── Read endpoints ────────────────────────────────────────────────────────────

export function fetchHealth(): Promise<StripeConfigStatus> {
  return fetchResource<StripeConfigStatus>('/health');
}

export function fetchPayments(): Promise<StripePayment[]> {
  return fetchResource<StripePayment[]>('/api/stripe/payments');
}

export function fetchPayment(id: string): Promise<StripePaymentDetail> {
  return fetchResource<StripePaymentDetail>(`/api/stripe/payments/${id}`);
}

export function fetchProducts(): Promise<StripeProduct[]> {
  return fetchResource<StripeProduct[]>('/api/stripe/products');
}

export function fetchProduct(id: string): Promise<StripeProduct> {
  return fetchResource<StripeProduct>(`/api/stripe/products/${id}`);
}

export function fetchProductPrices(productId: string): Promise<StripePrice[]> {
  return fetchResource<StripePrice[]>(`/api/stripe/products/${productId}/prices`);
}

export function fetchSubscriptions(): Promise<StripeSubscription[]> {
  return fetchResource<StripeSubscription[]>('/api/stripe/subscriptions');
}

export function fetchSubscription(id: string): Promise<StripeSubscriptionDetail> {
  return fetchResource<StripeSubscriptionDetail>(`/api/stripe/subscriptions/${id}`);
}

export function fetchCustomers(): Promise<StripeCustomersResponse> {
  return fetchResource<StripeCustomersResponse>('/api/stripe/customers');
}

export function fetchCustomerList(): Promise<StripeCustomerListItem[]> {
  return fetchResource<StripeCustomerListItem[]>('/api/stripe/customers/list');
}

export function fetchCustomer(id: string): Promise<StripeCustomerDetail> {
  return fetchResource<StripeCustomerDetail>(`/api/stripe/customers/${id}`);
}

export function fetchInvoices(): Promise<StripeInvoice[]> {
  return fetchResource<StripeInvoice[]>('/api/stripe/invoices');
}

export function fetchInvoice(id: string): Promise<StripeInvoiceDetail> {
  return fetchResource<StripeInvoiceDetail>(`/api/stripe/invoices/${id}`);
}

export function fetchRefunds(): Promise<StripeRefund[]> {
  return fetchResource<StripeRefund[]>('/api/stripe/refunds');
}

export function fetchWebhookEvents(): Promise<StripeWebhookEvent[]> {
  return fetchResource<StripeWebhookEvent[]>('/api/stripe/webhooks');
}

export function fetchRevenue(): Promise<StripeRevenuePoint[]> {
  return fetchResource<StripeRevenuePoint[]>('/api/stripe/revenue');
}

// ── Mutation endpoints ────────────────────────────────────────────────────────

export function refundPayment(id: string, params: { amount?: number; reason?: string }): Promise<StripeRefund> {
  return mutateResource<StripeRefund>('POST', `/api/stripe/payments/${id}/refund`, params);
}

export function capturePayment(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/payments/${id}/capture`);
}

export function cancelPayment(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/payments/${id}/cancel`);
}

export function createProduct(params: { name: string; description?: string }): Promise<StripeProduct> {
  return mutateResource<StripeProduct>('POST', '/api/stripe/products', params);
}

export function updateProduct(id: string, params: { name?: string; description?: string; active?: boolean; metadata?: Record<string, string> }): Promise<StripeProduct> {
  return mutateResource<StripeProduct>('PATCH', `/api/stripe/products/${id}`, params);
}

export function deleteProduct(id: string): Promise<{ id: string; deleted: boolean }> {
  return mutateResource<{ id: string; deleted: boolean }>('DELETE', `/api/stripe/products/${id}`);
}

export function createPrice(params: { product: string; unit_amount: number; currency: string; recurring?: { interval: string } }): Promise<StripePrice> {
  return mutateResource<StripePrice>('POST', '/api/stripe/prices', params);
}

export function archivePrice(id: string): Promise<{ id: string; active: boolean }> {
  return mutateResource<{ id: string; active: boolean }>('PATCH', `/api/stripe/prices/${id}`, { active: false });
}

export function updateSubscription(id: string, params: Record<string, unknown>): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
  return mutateResource<{ id: string; status: string; cancelAtPeriodEnd: boolean }>('PATCH', `/api/stripe/subscriptions/${id}`, params);
}

export function cancelSubscription(id: string, immediate = false): Promise<{ id: string; status: string }> {
  return immediate
    ? mutateResource<{ id: string; status: string }>('DELETE', `/api/stripe/subscriptions/${id}`, { invoice_now: false })
    : mutateResource<{ id: string; status: string }>('PATCH', `/api/stripe/subscriptions/${id}`, { cancel_at_period_end: true });
}

export function resumeSubscription(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/subscriptions/${id}/resume`);
}

export function updateCustomer(id: string, params: { name?: string; email?: string; phone?: string; description?: string; metadata?: Record<string, string> }): Promise<{ id: string; email: string | null; name: string | null }> {
  return mutateResource<{ id: string; email: string | null; name: string | null }>('PATCH', `/api/stripe/customers/${id}`, params);
}

export function deleteCustomer(id: string): Promise<{ id: string; deleted: boolean }> {
  return mutateResource<{ id: string; deleted: boolean }>('DELETE', `/api/stripe/customers/${id}`);
}

export function finalizeInvoice(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/invoices/${id}/finalize`);
}

export function payInvoice(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/invoices/${id}/pay`);
}

export function voidInvoice(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/invoices/${id}/void`);
}

export function sendInvoice(id: string): Promise<{ id: string; status: string }> {
  return mutateResource<{ id: string; status: string }>('POST', `/api/stripe/invoices/${id}/send`);
}

export function createRefund(params: { charge?: string; payment_intent?: string; amount?: number; reason?: string }): Promise<StripeRefund> {
  return mutateResource<StripeRefund>('POST', '/api/stripe/refunds', params);
}

// ── Order workflow statuses (local, not stored in Stripe) ─────────────────────
export type OrderWorkflowStatus = 'new' | 'processing' | 'packing' | 'shipped' | 'done';

export interface OrderStatusEntry {
  status: OrderWorkflowStatus;
  updatedAt: number;
  note?: string;
}

export async function fetchOrderStatuses(): Promise<Record<string, OrderStatusEntry>> {
  return fetchResource<Record<string, OrderStatusEntry>>('/api/stripe/orders/statuses');
}

export async function updateOrderStatus(id: string, status: OrderWorkflowStatus, note?: string): Promise<OrderStatusEntry> {
  return mutateResource<OrderStatusEntry>('PATCH', `/api/stripe/orders/${id}/status`, { status, ...(note !== undefined ? { note } : {}) });
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatAmount(amount: number, currency = 'usd'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase(), minimumFractionDigits: 2 }).format(amount / 100);
}

export function formatDate(unix: number): string {
  return new Date(unix * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

