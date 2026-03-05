// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reimporting the module after each test requires clearing the module cache,
// so we mock fetch globally and reset state via loginFlint / refreshFlintToken.

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Set env before importing so the module picks up the values
process.env['FLINT_FUNCTION_URL'] = 'https://flint.test';
process.env['FLINT_AUTH_EMAIL']   = 'test@example.com';
process.env['FLINT_AUTH_TOKEN']   = 'testpassword';

import {
  loginFlint, refreshFlintToken, getFlintToken,
  dataFlintOrders, dataFlintProducts, dataFlintInventory,
  dataFlintSession,
  normalizeOrder, normalizeOrderLine, normalizeProduct, normalizeCustomer,
  enrichOrdersWithCustomers,
} from '../flint.ts';
import { upsertCache } from '../../db/flint-db.ts';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  // Data functions now use Drizzle cache as source of truth; reset keys so
  // tests are isolated and don't inherit data from previous runs.
  upsertCache('flint-orders', [], 60_000);
  upsertCache('flint-products', [], 60_000);
  upsertCache('flint-categories', [], 60_000);
  upsertCache('flint-customers', [], 60_000);
  upsertCache('flint-dashboard', null, 60_000);
  upsertCache('flint-inventory', [], 60_000);
  upsertCache('flint-sales', [], 60_000);
  upsertCache('flint-customer-report', null, 60_000);
  upsertCache('flint-shipments', [], 60_000);
  upsertCache('flint-data-health', null, 60_000);
});

// ── loginFlint / getFlintToken ────────────────────────────────────────────────

describe('loginFlint', () => {
  it('stores the access and refresh tokens on success', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-abc',
      refreshToken: 'refresh-xyz',
      user: { email: 'test@example.com' },
    }));

    await loginFlint();
    const token = await getFlintToken();
    expect(token).toBe('access-abc');
  });

  it('silently returns when response is not ok', async () => {
    mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));
    // Should not throw
    await expect(loginFlint()).resolves.toBeUndefined();
  });
});

// ── refreshFlintToken ─────────────────────────────────────────────────────────

describe('refreshFlintToken', () => {
  it('uses refresh token when available and succeeds', async () => {
    // First prime the token state via login
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-initial',
      refreshToken: 'refresh-initial',
    }));
    await loginFlint();

    // Then refresh
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-refreshed',
      refreshToken: 'refresh-new',
    }));
    await refreshFlintToken();

    // Force expiry to trigger getFlintToken to use cached value
    const token = await getFlintToken();
    expect(token).toBe('access-refreshed');
  });

  it('falls back to loginFlint when refresh endpoint fails', async () => {
    // Prime login first
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-initial',
      refreshToken: 'refresh-initial',
    }));
    await loginFlint();

    // Refresh fails
    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 401 }));
    // Fallback login succeeds
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-via-login',
      refreshToken: 'refresh-via-login',
    }));

    await refreshFlintToken();
    const token = await getFlintToken();
    expect(token).toBe('access-via-login');
  });
});

// ── dataFlintOrders ───────────────────────────────────────────────────────────

describe('dataFlintOrders', () => {
  it('returns parsed orders array on success', async () => {
    // Login first
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
    }));
    await loginFlint();

    const orders = [
      { id: 'ord-1', orderNumber: '001', status: 'pending', totalAmount: 1000, currency: 'USD', lines: [], createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z', customerId: 'cust-1', customerName: 'Alice', customerEmail: 'alice@test.com' },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: orders }));

    const result = await dataFlintOrders();
    expect(result).toHaveLength(1);
    expect(result[0]!.orderNumber).toBe('001');
  });

  it('handles array response directly (no envelope)', async () => {
    // Login
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-456',
      refreshToken: 'refresh-456',
    }));
    await loginFlint();

    const orders = [
      { id: 'ord-2', orderNumber: '002', status: 'confirmed', totalAmount: 2000, currency: 'USD', lines: [], createdAt: '2025-01-02T00:00:00Z', updatedAt: '2025-01-02T00:00:00Z', customerId: 'cust-2', customerName: 'Bob', customerEmail: 'bob@test.com' },
    ];
    mockFetch.mockResolvedValueOnce(jsonResponse(orders));

    const result = await dataFlintOrders();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('ord-2');
  });

  it('returns stale cache on fetch error', async () => {
    // Login
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-789',
      refreshToken: 'refresh-789',
    }));
    await loginFlint();

    // First successful fetch populates stale cache
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [
      { id: 'ord-stale', orderNumber: 'stale-001', status: 'pending', totalAmount: 500, currency: 'USD', lines: [], createdAt: '', updatedAt: '', customerId: 'c1', customerName: 'C', customerEmail: 'c@c.com' },
    ] }));
    await dataFlintOrders();

    // Second fetch throws network error
    mockFetch.mockRejectedValueOnce(new Error('network error'));
    // On retry for token, also fail
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await dataFlintOrders();
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Should have returned the stale order from cache
  });
});

// ── dataFlintInventory ────────────────────────────────────────────────────────

describe('dataFlintInventory', () => {
  it('derives inventory rows from products with variants', async () => {
    // Login
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-inv',
      refreshToken: 'refresh-inv',
    }));
    await loginFlint();

    const products = [{
      id: 'prod-1',
      name: 'T-Shirt',
      status: 'active',
      price: 2000,
      stock: 0,
      variants: [
        { id: 'var-s', productId: 'prod-1', name: 'Small', stock: 10, price: 2000 },
        { id: 'var-l', productId: 'prod-1', name: 'Large', stock: 3, price: 2000 },
      ],
      createdAt: '', updatedAt: '',
    }];
    // dataFlintProducts now fetches 3 statuses in parallel (active, draft, archived)
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: products }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));
    mockFetch.mockResolvedValueOnce(jsonResponse({ data: [] }));

    const rows = await dataFlintInventory();
    expect(rows).toHaveLength(2);
    const large = rows.find(r => r.variantName === 'Large');
    expect(large?.isLowStock).toBe(true);   // stock 3 <= 5
    const small = rows.find(r => r.variantName === 'Small');
    expect(small?.isLowStock).toBe(false);  // stock 10 > 5
  });
});

// ── dataFlintSession ──────────────────────────────────────────────────────────

describe('dataFlintSession', () => {
  it('returns authenticated=true after successful token refresh', async () => {
    // Login to set initial state
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-sess',
      refreshToken: 'refresh-sess',
      user: { email: 'test@example.com' },
    }));
    await loginFlint();

    // dataFlintSession calls refreshFlintToken which POSTs to /auth/refresh
    mockFetch.mockResolvedValueOnce(jsonResponse({
      accessToken: 'access-sess-2',
      refreshToken: 'refresh-sess-2',
    }));

    const result = await dataFlintSession();
    expect(result.authenticated).toBe(true);
  });

  it('returns existing session stale data when refresh fails (stale-on-error)', async () => {
    // Refresh fails — loginFlint fallback also fails — but _accessToken stays set (stale)
    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 401 })); // refresh fails
    mockFetch.mockResolvedValueOnce(new Response('Error', { status: 401 })); // login fallback fails

    const result = await dataFlintSession();
    // Should not throw; returns current cached state (stale-on-error strategy)
    expect(result).toHaveProperty('authenticated');
  });
});

// ── normalizeProduct ──────────────────────────────────────────────────────────

describe('normalizeProduct', () => {
  it('preserves active status', () => {
    const p = normalizeProduct({ id: 'p1', name: 'A', status: 'active', price: 10 });
    expect(p.status).toBe('active');
  });

  it('preserves draft status', () => {
    const p = normalizeProduct({ id: 'p2', name: 'B', status: 'draft', price: 20 });
    expect(p.status).toBe('draft');
  });

  it('preserves archived status', () => {
    const p = normalizeProduct({ id: 'p3', name: 'C', status: 'archived', price: 30 });
    expect(p.status).toBe('archived');
  });

  it('defaults to draft when status is missing', () => {
    const p = normalizeProduct({ id: 'p4', name: 'D', price: 5 });
    expect(p.status).toBe('draft');
  });

  it('handles snake_case fields', () => {
    const p = normalizeProduct({
      id: 'p5', name: 'E', status: 'active',
      category_id: 'cat-1', category_name: 'Clothing',
      compare_at_price: 50, created_at: '2025-01-01', updated_at: '2025-01-02',
    });
    expect(p.categoryId).toBe('cat-1');
    expect(p.categoryName).toBe('Clothing');
    expect(p.compareAtPrice).toBe(50);
    expect(p.createdAt).toBe('2025-01-01');
    expect(p.updatedAt).toBe('2025-01-02');
  });
});

// ── normalizeOrder ────────────────────────────────────────────────────────────

describe('normalizeOrderLine', () => {
  it('maps lineTotal and nested product fields', () => {
    const line = normalizeOrderLine({
      id: 'line-1',
      product: { id: 'prod-1', name: 'Sneaker' },
      quantity: 2,
      unitPrice: 10,
      lineTotal: 20,
      currency_code: 'usd',
    });
    expect(line.productId).toBe('prod-1');
    expect(line.productName).toBe('Sneaker');
    expect(line.totalPrice).toBe(20);
    expect(line.currency).toBe('usd');
  });
});

describe('normalizeOrder', () => {
  it('maps snake_case fields to camelCase', () => {
    const o = normalizeOrder({
      id: 'o1', order_number: '100', customer_id: 'c1',
      customer_name: 'Alice', customer_email: 'a@a.com',
      total_amount: 50, status: 'pending',
      created_at: '2025-01-01', updated_at: '2025-01-02',
    });
    expect(o.orderNumber).toBe('100');
    expect(o.customerId).toBe('c1');
    expect(o.customerName).toBe('Alice');
    expect(o.totalAmount).toBe(50);
  });

  it('falls back to nested customer object', () => {
    const o = normalizeOrder({
      id: 'o2', status: 'confirmed',
      customer: { id: 'c2', name: 'Bob', email: 'bob@b.com' },
      total: 120,
    });
    expect(o.customerId).toBe('c2');
    expect(o.customerName).toBe('Bob');
    expect(o.customerEmail).toBe('bob@b.com');
    expect(o.totalAmount).toBe(120);
  });

  it('maps alternate line array keys', () => {
    const o = normalizeOrder({
      id: 'o3',
      status: 'pending',
      customerId: 'c3',
      customerName: 'Casey',
      customerEmail: 'casey@test.com',
      total: 30,
      line_items: [
        { product_id: 'prod-3', quantity: 3, unit_price: 10, line_total: 30 },
      ],
    });
    expect(o.lines).toHaveLength(1);
    expect(o.lines[0]!.productId).toBe('prod-3');
    expect(o.lines[0]!.totalPrice).toBe(30);
  });
});

// ── normalizeCustomer ─────────────────────────────────────────────────────────

describe('normalizeCustomer', () => {
  it('builds full name from firstName + lastName', () => {
    const c = normalizeCustomer({
      id: 'c1', firstName: 'Alice', lastName: 'Smith', email: 'a@a.com',
    });
    expect(c.name).toBe('Alice Smith');
  });

  it('handles snake_case first_name / last_name', () => {
    const c = normalizeCustomer({
      id: 'c2', first_name: 'Bob', last_name: 'Jones', email: 'b@b.com',
    });
    expect(c.name).toBe('Bob Jones');
  });

  it('uses provided name field over firstName+lastName', () => {
    const c = normalizeCustomer({
      id: 'c3', name: 'Charlie', firstName: 'C', lastName: 'D', email: 'c@c.com',
    });
    expect(c.name).toBe('Charlie');
  });

  it('defaults to dash when no name info is available', () => {
    const c = normalizeCustomer({ id: 'c4', email: 'x@x.com' });
    expect(c.name).toBe('—');
  });
});

// ── enrichOrdersWithCustomers ─────────────────────────────────────────────────

describe('enrichOrdersWithCustomers', () => {
  const baseOrder = (id: string, custId: string) => ({
    id, orderNumber: id, customerId: custId, customerName: '—', customerEmail: '—',
    status: 'pending' as const, totalAmount: 100, currency: 'USD', lines: [],
    createdAt: '2025-01-01', updatedAt: '2025-01-01',
  });
  const baseCustomer = (id: string, name: string, email: string) => ({
    id, name, email, totalOrders: 1, totalSpent: 100, currency: 'USD',
    createdAt: '2025-01-01', updatedAt: '2025-01-01',
  });

  it('populates customerName and customerEmail from matching customers', () => {
    const orders = [baseOrder('o1', 'c1'), baseOrder('o2', 'c2')];
    const customers = [baseCustomer('c1', 'Alice', 'a@a.com'), baseCustomer('c2', 'Bob', 'b@b.com')];
    const enriched = enrichOrdersWithCustomers(orders, customers);
    expect(enriched[0]!.customerName).toBe('Alice');
    expect(enriched[0]!.customerEmail).toBe('a@a.com');
    expect(enriched[1]!.customerName).toBe('Bob');
  });

  it('leaves orders unchanged when no customer matches', () => {
    const orders = [baseOrder('o3', 'c-missing')];
    const customers = [baseCustomer('c99', 'Nobody', 'n@n.com')];
    const enriched = enrichOrdersWithCustomers(orders, customers);
    expect(enriched[0]!.customerName).toBe('—');
  });

  it('returns orders unchanged when customer list is empty', () => {
    const orders = [baseOrder('o4', 'c1')];
    const enriched = enrichOrdersWithCustomers(orders, []);
    expect(enriched[0]!.customerName).toBe('—');
  });
});