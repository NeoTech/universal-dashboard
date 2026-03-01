// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// bun:sqlite mock — must use a real class so `new Database(...)` works
vi.mock('bun:sqlite', () => {
  class Database {
    run() { return this; }
    prepare() { return { all: () => [], run: () => {} }; }
  }
  return { Database };
});

// stripe mock — class-based so `new Stripe(key, cfg)` works; records calls
// in a static array that tests can inspect without vi.mocked().
vi.mock('stripe', () => {
  const calls: Array<{ key: string; cfg: Record<string, unknown> }> = [];
  class MockStripe {
    static readonly _calls = calls;
    static _clear() { calls.length = 0; }
    constructor(key: string, cfg: Record<string, unknown>) { calls.push({ key, cfg }); }
  }
  return { default: MockStripe };
});

import Stripe from 'stripe';
import { getStripe, noStripe, type OrderWorkflowStatus } from '../stripe.ts';

// Helper to access the static call recorder on the mock class
const stripeCalls = () => (Stripe as unknown as { _calls: Array<{ key: string; cfg: Record<string, unknown> }> })._calls;
const clearCalls = () => (Stripe as unknown as { _clear(): void })._clear();

// ── getStripe ─────────────────────────────────────────────────────────────────

describe('getStripe', () => {
  const originalKey = process.env['STRIPE_SECRET_KEY'];

  beforeEach(() => {
    clearCalls();
    delete process.env['STRIPE_SECRET_KEY'];
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env['STRIPE_SECRET_KEY'] = originalKey;
    } else {
      delete process.env['STRIPE_SECRET_KEY'];
    }
  });

  it('returns null when STRIPE_SECRET_KEY is not set', () => {
    expect(getStripe()).toBeNull();
  });

  it('returns null when key starts with the placeholder prefix', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_your_stripe_secret_key_here';
    expect(getStripe()).toBeNull();
  });

  it('returns a non-null instance when a real-looking key is set', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_live_4xampleKeyForTests123456789012345678';
    expect(getStripe()).not.toBeNull();
    expect(stripeCalls()).toHaveLength(1);
    expect(stripeCalls()[0]!.key).toBe('sk_live_4xampleKeyForTests123456789012345678');
  });

  it('passes the provided key and an apiVersion config to Stripe', () => {
    const key = 'sk_live_testApiVersionCheck123456789012345';
    process.env['STRIPE_SECRET_KEY'] = key;
    getStripe();
    const { key: calledKey, cfg } = stripeCalls()[0]!;
    expect(calledKey).toBe(key);
    expect(cfg).toHaveProperty('apiVersion');
  });

  it('passes custom host/port when a non-default base URL is provided', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_localtest1234567890123456789012345';
    getStripe('http://localhost:12111');
    expect(stripeCalls()[0]!.cfg).toMatchObject({ host: 'localhost', port: 12111, protocol: 'http' });
  });

  it('does not set host/port for the default Stripe URL', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_default99999999999999999999999999';
    getStripe('https://api.stripe.com');
    const { cfg } = stripeCalls()[0]!;
    expect(cfg).not.toHaveProperty('host');
    expect(cfg).not.toHaveProperty('port');
  });
});

// ── noStripe ──────────────────────────────────────────────────────────────────

describe('noStripe', () => {
  it('writes a 503 JSON response mentioning Stripe config', () => {
    const writeHead = vi.fn();
    const end = vi.fn();
    const res = { writeHead, end } as never;
    noStripe(res);
    expect(writeHead).toHaveBeenCalledWith(503, expect.objectContaining({ 'Content-Type': 'application/json' }));
    const body = JSON.parse(end.mock.calls[0]?.[0] as string) as { error: string };
    expect(body.error).toMatch(/stripe/i);
  });
});

// ── OrderWorkflowStatus ───────────────────────────────────────────────────────

describe('OrderWorkflowStatus', () => {
  it('includes the five expected workflow states (compile-time type check)', () => {
    // TypeScript will error at compile time if any value is removed from the union.
    const validStates: OrderWorkflowStatus[] = ['new', 'processing', 'packing', 'shipped', 'done'];
    expect(validStates).toHaveLength(5);
    expect(new Set(validStates).size).toBe(5);
  });
});
