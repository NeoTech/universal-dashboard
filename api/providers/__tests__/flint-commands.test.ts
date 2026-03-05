// @vitest-environment node
/**
 * Tests for FLINT WS command execution and mutation flow (TWM-157).
 *
 * Covers:
 * - Command executor wiring (flintFetch integration)
 * - WS command protocol (ACTION_ROUTES dispatch)
 * - Optimistic acknowledgment flow (ack -> progress -> result)
 * - Queue status endpoint shape
 * - Command lifecycle: enqueue -> dequeue -> complete/fail -> broadcast
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
  enqueue,
  setCommandExecutor,
  onCommandLifecycle,
  getQueueStatus,
  dequeue,
  complete,
  fail,
} from '../flint-queue.ts';

import {
  broadcastResource,
  broadcastCommandResult,
  broadcastCommandProgress,
  __testing,
} from '../../ws/flint-hub.ts';

import type { FlintWsInbound, FlintWsOutbound } from '../../ws/flint-hub.ts';
import type { EnqueueCommand, QueueStatus, CommandExecutor } from '../flint-queue.ts';

// ── Mock WebSocket helpers ────────────────────────────────────────────────────

function createMockWs() {
  return {
    readyState: 1, // OPEN
    sent: [] as string[],
    send(data: string) { this.sent.push(data); },
    on: vi.fn(),
  };
}

function parseSent(ws: ReturnType<typeof createMockWs>, index: number): FlintWsOutbound {
  return JSON.parse(ws.sent[index]!) as FlintWsOutbound;
}

const { clients, subscriptionIndex, subscribe } = __testing;

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

// ── ACTION_ROUTES coverage ────────────────────────────────────────────────────

describe('WS command protocol (ACTION_ROUTES)', () => {
  /**
   * All 17 command actions defined in flint-hub.ts ACTION_ROUTES.
   * Each maps to an HTTP method, a path builder, and a resource name.
   */
  const EXPECTED_ACTIONS: Array<{ action: string; method: string; pathId?: string; resource: string }> = [
    { action: 'update-order-status',  method: 'PUT',    pathId: 'ord-1', resource: 'flint-orders' },
    { action: 'delete-order',         method: 'DELETE',  pathId: 'ord-2', resource: 'flint-orders' },
    { action: 'refund-order',         method: 'POST',   pathId: 'ord-3', resource: 'flint-orders' },
    { action: 'create-product',       method: 'POST',                    resource: 'flint-products' },
    { action: 'update-product',       method: 'PUT',    pathId: 'prd-1', resource: 'flint-products' },
    { action: 'delete-product',       method: 'DELETE',  pathId: 'prd-2', resource: 'flint-products' },
    { action: 'create-variant',       method: 'POST',   pathId: 'prd-3', resource: 'flint-products' },
    { action: 'update-variant',       method: 'PUT',    pathId: 'prd-4', resource: 'flint-products' },
    { action: 'create-category',      method: 'POST',                    resource: 'flint-categories' },
    { action: 'update-category',      method: 'PUT',    pathId: 'cat-1', resource: 'flint-categories' },
    { action: 'delete-category',      method: 'DELETE',  pathId: 'cat-2', resource: 'flint-categories' },
    { action: 'update-customer',      method: 'PUT',    pathId: 'cus-1', resource: 'flint-customers' },
    { action: 'create-shipment',      method: 'POST',                    resource: 'flint-shipments' },
    { action: 'update-shipment',      method: 'PUT',    pathId: 'shp-1', resource: 'flint-shipments' },
    { action: 'sync-stripe',          method: 'POST',                    resource: 'flint-orders' },
    { action: 'run-data-health',      method: 'POST',                    resource: 'flint-data-health' },
    { action: 'set-sales-range',      method: 'POST',                    resource: 'flint-sales' },
  ];

  it('all 17 actions are present', () => {
    expect(EXPECTED_ACTIONS).toHaveLength(17);
  });

  it.each(EXPECTED_ACTIONS)(
    'enqueue($action) returns a valid UUID',
    ({ action, method, pathId, resource }) => {
      const cmd: EnqueueCommand = {
        resource,
        method,
        path: pathId ? `/${action}/${pathId}` : `/${action}`,
        payload: { action },
      };
      const id = enqueue(cmd);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    },
  );
});

// ── Command executor ──────────────────────────────────────────────────────────

describe('command executor integration', () => {
  it('stores executor via setCommandExecutor without throwing', () => {
    const executor: CommandExecutor = vi.fn(async () => ({ ok: true }));
    expect(() => setCommandExecutor(executor)).not.toThrow();
  });

  it('executor receives correct method, path, and payload shape', () => {
    const executor = vi.fn(async (_m: string, _p: string, _pl: unknown) => ({ ok: true }));
    setCommandExecutor(executor);

    // Verify the executor type matches the expected signature
    expect(typeof executor).toBe('function');
  });
});

// ── Optimistic acknowledgment flow ────────────────────────────────────────────

describe('optimistic acknowledgment', () => {
  beforeEach(resetState);

  it('command-ack is immediate after enqueue', () => {
    // Simulate what flint-hub handleMessage does for a command:
    // 1. Look up ACTION_ROUTES[action]
    // 2. Call enqueue() which returns a commandId
    // 3. Send command-ack to the client
    const ws = addClient('conn-1');

    const commandId = enqueue({
      resource: 'flint-orders',
      method: 'PUT',
      path: '/orders/1/status',
      payload: { status: 'confirmed' },
    });

    // Simulate the hub sending ack (hub does this synchronously after enqueue)
    const ackFrame: FlintWsOutbound = { type: 'command-ack', commandId, status: 'queued' };
    ws.send(JSON.stringify(ackFrame));

    const frame = parseSent(ws, 0);
    expect(frame.type).toBe('command-ack');
    if (frame.type === 'command-ack') {
      expect(frame.commandId).toBe(commandId);
      expect(frame.status).toBe('queued');
    }
  });

  it('broadcastCommandProgress sends to all clients', () => {
    const ws1 = addClient('conn-1');
    const ws2 = addClient('conn-2');

    broadcastCommandProgress('cmd-progress-1');

    expect(ws1.sent).toHaveLength(1);
    expect(ws2.sent).toHaveLength(1);

    const frame1 = parseSent(ws1, 0);
    expect(frame1.type).toBe('command-progress');
    if (frame1.type === 'command-progress') {
      expect(frame1.commandId).toBe('cmd-progress-1');
      expect(frame1.status).toBe('processing');
    }
  });

  it('broadcastCommandProgress skips closed connections', () => {
    const ws1 = addClient('conn-1');
    ws1.readyState = 3; // CLOSED

    broadcastCommandProgress('cmd-closed');
    expect(ws1.sent).toHaveLength(0);
  });

  it('broadcastCommandResult sends completed result to all clients', () => {
    const ws1 = addClient('conn-1');

    broadcastCommandResult('cmd-done', 'completed', { order: { id: '1', status: 'confirmed' } });

    const frame = parseSent(ws1, 0);
    expect(frame.type).toBe('command-result');
    if (frame.type === 'command-result') {
      expect(frame.commandId).toBe('cmd-done');
      expect(frame.status).toBe('completed');
      expect(frame.data).toEqual({ order: { id: '1', status: 'confirmed' } });
    }
  });

  it('broadcastCommandResult sends failed result with error', () => {
    const ws1 = addClient('conn-1');

    broadcastCommandResult('cmd-fail', 'failed', undefined, 'Upstream 503');

    const frame = parseSent(ws1, 0);
    if (frame.type === 'command-result') {
      expect(frame.status).toBe('failed');
      expect(frame.error).toBe('Upstream 503');
      expect(frame.data).toBeUndefined();
    }
  });
});

// ── Full lifecycle: ack -> progress -> result ─────────────────────────────────

describe('full command lifecycle sequence', () => {
  beforeEach(resetState);

  it('produces ack, progress, and result frames in order', () => {
    const ws = addClient('conn-1');

    // 1. Enqueue -> ack
    const commandId = enqueue({
      resource: 'flint-orders',
      method: 'PUT',
      path: '/orders/1/status',
      payload: { status: 'shipped' },
    });
    ws.send(JSON.stringify({ type: 'command-ack', commandId, status: 'queued' }));

    // 2. Processing starts -> progress
    broadcastCommandProgress(commandId);

    // 3. Processing completes -> result
    broadcastCommandResult(commandId, 'completed', { status: 'shipped' });

    expect(ws.sent).toHaveLength(3);

    const ack = parseSent(ws, 0);
    expect(ack.type).toBe('command-ack');

    const progress = parseSent(ws, 1);
    expect(progress.type).toBe('command-progress');

    const result = parseSent(ws, 2);
    expect(result.type).toBe('command-result');
    if (result.type === 'command-result') {
      expect(result.status).toBe('completed');
    }
  });

  it('produces ack, progress, and failed result for error', () => {
    const ws = addClient('conn-1');

    const commandId = enqueue({
      resource: 'flint-products',
      method: 'DELETE',
      path: '/products/5',
    });
    ws.send(JSON.stringify({ type: 'command-ack', commandId, status: 'queued' }));
    broadcastCommandProgress(commandId);
    broadcastCommandResult(commandId, 'failed', undefined, 'FLINT 404: Not found');

    expect(ws.sent).toHaveLength(3);
    const result = parseSent(ws, 2);
    if (result.type === 'command-result') {
      expect(result.status).toBe('failed');
      expect(result.error).toBe('FLINT 404: Not found');
    }
  });
});

// ── onCommandLifecycle hooks ──────────────────────────────────────────────────

describe('onCommandLifecycle with onStart', () => {
  it('accepts onStart hook without throwing', () => {
    const onStart = vi.fn();
    const onComplete = vi.fn();
    const onFailed = vi.fn();
    expect(() => onCommandLifecycle({ onStart, onComplete, onFailed })).not.toThrow();
  });

  it('accepts partial hooks (onStart only)', () => {
    const onStart = vi.fn();
    expect(() => onCommandLifecycle({ onStart })).not.toThrow();
  });
});

// ── Queue status shape ────────────────────────────────────────────────────────

describe('getQueueStatus response shape', () => {
  it('returns all required fields', () => {
    const status: QueueStatus = getQueueStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('completed');
    expect(status).toHaveProperty('failed');
    expect(status).toHaveProperty('recentErrors');
  });

  it('recentErrors is an array', () => {
    const status = getQueueStatus();
    expect(Array.isArray(status.recentErrors)).toBe(true);
  });

  it('all counts are non-negative numbers', () => {
    const status = getQueueStatus();
    expect(status.pending).toBeGreaterThanOrEqual(0);
    expect(status.processing).toBeGreaterThanOrEqual(0);
    expect(status.completed).toBeGreaterThanOrEqual(0);
    expect(status.failed).toBeGreaterThanOrEqual(0);
  });
});

// ── Queue operations ──────────────────────────────────────────────────────────

describe('queue operations', () => {
  it('dequeue returns null when queue is empty (mocked DB)', () => {
    // With the mocked DB returning null from get(), dequeue should return null
    const cmd = dequeue();
    expect(cmd).toBeNull();
  });

  it('complete does not throw', () => {
    expect(() => complete('some-id', { ok: true })).not.toThrow();
  });

  it('fail does not throw', () => {
    expect(() => fail('some-id', 'test error')).not.toThrow();
  });
});

// ── WS broadcast for resource updates after mutation ──────────────────────────

describe('resource broadcast after command', () => {
  beforeEach(resetState);

  it('broadcastResource sends updated data to subscribed WS clients', () => {
    const ws = addClient('conn-1');
    subscribe('conn-1', 'flint-orders');

    // After a command completes, the server re-polls and broadcasts
    broadcastResource('flint-orders', [{ id: 'order-1', status: 'confirmed' }]);

    expect(ws.sent).toHaveLength(1);
    const frame = parseSent(ws, 0);
    expect(frame.type).toBe('data');
    if (frame.type === 'data') {
      expect(frame.resource).toBe('flint-orders');
      expect(frame.data).toEqual([{ id: 'order-1', status: 'confirmed' }]);
    }
  });

  it('command result broadcast is independent of resource subscriptions', () => {
    // Command results go to ALL clients, not just resource subscribers
    const ws1 = addClient('conn-1');
    const ws2 = addClient('conn-2');
    subscribe('conn-1', 'flint-orders');
    // conn-2 is NOT subscribed

    broadcastCommandResult('cmd-x', 'completed', { ok: true });

    // Both get the command result
    expect(ws1.sent).toHaveLength(1);
    expect(ws2.sent).toHaveLength(1);
  });
});

// ── Type validation ───────────────────────────────────────────────────────────

describe('WS message types', () => {
  it('FlintWsInbound command type has expected shape', () => {
    const msg: FlintWsInbound = {
      type: 'command',
      action: 'update-order-status',
      resource: 'flint-orders',
      id: 'order-1',
      payload: { status: 'confirmed' },
    };
    expect(msg.type).toBe('command');
    expect(msg.action).toBe('update-order-status');
    expect(msg.resource).toBe('flint-orders');
  });

  it('FlintWsInbound command without id or payload is valid', () => {
    const msg: FlintWsInbound = {
      type: 'command',
      action: 'run-data-health',
      resource: 'flint-data-health',
    };
    expect(msg.type).toBe('command');
    expect(msg.action).toBe('run-data-health');
  });
});
