import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  fetchPayments,
  fetchProducts,
  fetchSubscriptions,
  fetchCustomers,
  fetchWebhookEvents,
  fetchRevenue,
  fetchHealth,
  formatAmount,
  formatDate,
  StripeApiError,
} from '../stripe';

function mockFetch(data: unknown, status = 200): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as Response);
}

afterEach(() => vi.restoreAllMocks());

describe('stripe client', () => {
  it('fetchHealth returns config status', async () => {
    mockFetch({ ok: true, stripe: true });
    const result = await fetchHealth();
    expect(result.ok).toBe(true);
    expect(result.stripe).toBe(true);
  });

  it('fetchPayments returns payment list', async () => {
    const payments = [{ id: 'ch_1', amount: 2000, currency: 'usd', status: 'succeeded', description: null, customer: null, created: 1700000000, receiptEmail: null }];
    mockFetch(payments);
    const result = await fetchPayments();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('ch_1');
    expect(result[0].amount).toBe(2000);
  });

  it('fetchProducts returns product list', async () => {
    const products = [{ id: 'prod_1', name: 'Widget', description: null, active: true, images: [], created: 1700000000, price: { amount: 999, currency: 'usd', interval: 'month' } }];
    mockFetch(products);
    const result = await fetchProducts();
    expect(result[0].price?.amount).toBe(999);
  });

  it('fetchSubscriptions returns subscription list', async () => {
    const subs = [{ id: 'sub_1', status: 'active', customer: 'cus_1', currentPeriodEnd: 1700000000, cancelAtPeriodEnd: false, items: [], created: 1700000000 }];
    mockFetch(subs);
    const result = await fetchSubscriptions();
    expect(result[0].status).toBe('active');
  });

  it('fetchCustomers returns customer summary', async () => {
    mockFetch({ total: 5, newThisMonth: 2, list: [] });
    const result = await fetchCustomers();
    expect(result.total).toBe(5);
    expect(result.newThisMonth).toBe(2);
  });

  it('fetchWebhookEvents returns event list', async () => {
    const events = [{ id: 'evt_1', type: 'payment_intent.succeeded', created: 1700000000, livemode: false, apiVersion: '2025-01-27.acacia' }];
    mockFetch(events);
    const result = await fetchWebhookEvents();
    expect(result[0].type).toBe('payment_intent.succeeded');
  });

  it('fetchRevenue returns daily buckets', async () => {
    const revenue = [{ date: '2025-01-01', amount: 5000 }];
    mockFetch(revenue);
    const result = await fetchRevenue();
    expect(result[0].date).toBe('2025-01-01');
    expect(result[0].amount).toBe(5000);
  });

  it('throws StripeApiError on non-2xx response', async () => {
    mockFetch({ error: 'Stripe not configured' }, 503);
    await expect(fetchPayments()).rejects.toBeInstanceOf(StripeApiError);
  });

  it('StripeApiError has correct status code', async () => {
    mockFetch({ error: 'Not found' }, 404);
    try {
      await fetchPayments();
    } catch (e) {
      expect((e as StripeApiError).status).toBe(404);
    }
  });

  it('formatAmount converts cents to currency string', () => {
    expect(formatAmount(2000, 'usd')).toBe('$20.00');
    expect(formatAmount(999, 'usd')).toBe('$9.99');
  });

  it('formatDate converts unix timestamp to readable date', () => {
    // 2023-11-14 UTC
    const unix = 1699920000;
    const result = formatDate(unix);
    expect(result).toMatch(/Nov|2023/);
  });
});
