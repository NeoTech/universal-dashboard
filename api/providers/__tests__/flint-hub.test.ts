// @vitest-environment node
/**
 * Tests for the FLINT WebSocket hub (api/ws/flint-hub.ts).
 *
 * Tests the hub's broadcast + subscription logic directly by populating
 * the internal Maps via __testing exports.  The ws package's upgrade flow
 * is covered by integration tests since ws is a CJS native module that
 * is difficult to mock cleanly in vitest.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── bun:sqlite mock ──────────────────────────────────────────────────────────
vi.mock('bun:sqlite', () => {
  class Database {
    run() { return this; }
    prepare() { return { all: () => [], get: () => null, run: () => ({ changes: 0 }), values: () => [] }; }
  }
  return { Database };
});

import {
  broadcastResource,
  broadcastCommandResult,
  getClientCount,
  setTokenVerifier,
  __testing,
} from '../../ws/flint-hub.ts';

// ── Mock WebSocket ────────────────────────────────────────────────────────────
// Minimal mock matching the ws.WebSocket interface used by the hub:
//   ws.readyState === WebSocket.OPEN  (1)
//   ws.send(payload: string)

function createMockWs() {
  return {
    readyState: 1, // OPEN
    sent: [] as string[],
    send(data: string) { this.sent.push(data); },
    on: vi.fn(),
  };
}

function parseSent(ws: ReturnType<typeof createMockWs>, index: number): Record<string, unknown> {
  return JSON.parse(ws.sent[index]!) as Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const { clients, subscriptionIndex, subscribe, unsubscribe, cleanup } = __testing;

function resetState() {
  clients.clear();
  subscriptionIndex.clear();
}

function addClient(id: string) {
  const ws = createMockWs();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clients.set(id, ws as any);
  return ws;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('WS hub module exports', () => {
  it('exports broadcastResource as a function', () => {
    expect(typeof broadcastResource).toBe('function');
  });

  it('exports broadcastCommandResult as a function', () => {
    expect(typeof broadcastCommandResult).toBe('function');
  });

  it('exports getClientCount as a function', () => {
    expect(typeof getClientCount).toBe('function');
  });

  it('exports setTokenVerifier as a function', () => {
    expect(typeof setTokenVerifier).toBe('function');
  });

  it('setTokenVerifier stores the verifier without throwing', () => {
    expect(() => setTokenVerifier(() => null)).not.toThrow();
  });
});

describe('subscription management', () => {
  beforeEach(resetState);

  it('subscribe adds to subscriptionIndex', () => {
    addClient('conn-1');
    subscribe('conn-1', 'flint-orders');

    expect(subscriptionIndex.has('flint-orders')).toBe(true);
    expect(subscriptionIndex.get('flint-orders')!.has('conn-1')).toBe(true);
  });

  it('subscribe handles multiple clients for the same resource', () => {
    addClient('conn-1');
    addClient('conn-2');
    subscribe('conn-1', 'flint-orders');
    subscribe('conn-2', 'flint-orders');

    expect(subscriptionIndex.get('flint-orders')!.size).toBe(2);
  });

  it('unsubscribe removes from subscriptionIndex', () => {
    addClient('conn-1');
    subscribe('conn-1', 'flint-orders');
    unsubscribe('conn-1', 'flint-orders');

    // Set should be removed since it's empty
    expect(subscriptionIndex.has('flint-orders')).toBe(false);
  });

  it('cleanup removes client from all subscriptions', () => {
    addClient('conn-1');
    subscribe('conn-1', 'flint-orders');
    subscribe('conn-1', 'flint-products');
    cleanup('conn-1');

    expect(clients.has('conn-1')).toBe(false);
    expect(subscriptionIndex.has('flint-orders')).toBe(false);
    expect(subscriptionIndex.has('flint-products')).toBe(false);
  });

  it('cleanup does not affect other clients', () => {
    addClient('conn-1');
    addClient('conn-2');
    subscribe('conn-1', 'flint-orders');
    subscribe('conn-2', 'flint-orders');
    cleanup('conn-1');

    expect(clients.has('conn-2')).toBe(true);
    expect(subscriptionIndex.get('flint-orders')!.has('conn-2')).toBe(true);
  });
});

describe('broadcastResource', () => {
  beforeEach(resetState);

  it('sends data only to subscribed clients', () => {
    const ws1 = addClient('conn-1');
    const ws2 = addClient('conn-2');
    subscribe('conn-1', 'flint-orders');
    // conn-2 is NOT subscribed to flint-orders

    broadcastResource('flint-orders', [{ id: 'order-1' }]);

    expect(ws1.sent.length).toBe(1);
    expect(ws2.sent.length).toBe(0);

    const frame = parseSent(ws1, 0);
    expect(frame.type).toBe('data');
    expect(frame.resource).toBe('flint-orders');
    expect(frame.data).toEqual([{ id: 'order-1' }]);
    expect(typeof frame.timestamp).toBe('number');
  });

  it('sends to multiple subscribers', () => {
    const ws1 = addClient('conn-1');
    const ws2 = addClient('conn-2');
    subscribe('conn-1', 'flint-orders');
    subscribe('conn-2', 'flint-orders');

    broadcastResource('flint-orders', { orders: [] });

    expect(ws1.sent.length).toBe(1);
    expect(ws2.sent.length).toBe(1);
  });

  it('is a no-op when no one is subscribed', () => {
    const ws1 = addClient('conn-1');
    broadcastResource('flint-orders', []);
    expect(ws1.sent.length).toBe(0);
  });

  it('skips clients with closed connections', () => {
    const ws1 = addClient('conn-1');
    ws1.readyState = 3; // CLOSED
    subscribe('conn-1', 'flint-orders');

    broadcastResource('flint-orders', []);
    expect(ws1.sent.length).toBe(0);
  });
});

describe('broadcastCommandResult', () => {
  beforeEach(resetState);

  it('sends to ALL connected clients regardless of subscription', () => {
    const ws1 = addClient('conn-1');
    const ws2 = addClient('conn-2');
    // Neither is subscribed to anything

    broadcastCommandResult('cmd-1', 'completed', { ok: true });

    expect(ws1.sent.length).toBe(1);
    expect(ws2.sent.length).toBe(1);

    const frame = parseSent(ws1, 0);
    expect(frame.type).toBe('command-result');
    expect(frame.commandId).toBe('cmd-1');
    expect(frame.status).toBe('completed');
    expect(frame.data).toEqual({ ok: true });
  });

  it('sends failed status with error message', () => {
    const ws1 = addClient('conn-1');

    broadcastCommandResult('cmd-2', 'failed', undefined, 'Something broke');

    const frame = parseSent(ws1, 0);
    expect(frame.type).toBe('command-result');
    expect(frame.status).toBe('failed');
    expect(frame.error).toBe('Something broke');
    expect(frame.data).toBeUndefined();
  });

  it('skips closed connections', () => {
    const ws1 = addClient('conn-1');
    ws1.readyState = 3; // CLOSED

    broadcastCommandResult('cmd-3', 'completed');
    expect(ws1.sent.length).toBe(0);
  });
});

describe('getClientCount', () => {
  beforeEach(resetState);

  it('returns 0 when no clients', () => {
    expect(getClientCount()).toBe(0);
  });

  it('reflects connected client count', () => {
    addClient('conn-1');
    addClient('conn-2');
    expect(getClientCount()).toBe(2);
  });

  it('decreases after cleanup', () => {
    addClient('conn-1');
    addClient('conn-2');
    cleanup('conn-1');
    expect(getClientCount()).toBe(1);
  });
});
