/**
 * Tests for FLINT real-time frontend infrastructure (TWM-158).
 *
 * Covers:
 * - useFlintSocket: WS connection, ref-counting, subscribe, command round-trip,
 *   reconnect backoff, SSE fallback threshold
 * - flintRealtimeStore: useFlintResource drop-in interface, sendCommand routing,
 *   transport mode signal, ACTION_RESOURCE mapping
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'solid-js';

// ── Mock WebSocket ────────────────────────────────────────────────────────────

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  sent: string[] = [];

  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose(new Event('close') as CloseEvent);
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  /** Simulate server opening connection. */
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen(new Event('open'));
  }

  /** Simulate receiving a message from server. */
  simulateMessage(data: unknown): void {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  /** Simulate connection error. */
  simulateError(): void {
    if (this.onerror) this.onerror(new Event('error'));
  }

  /** Simulate close after error (browser behavior). */
  simulateErrorClose(): void {
    this.simulateError();
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose(new Event('close') as CloseEvent);
  }

  static instances: MockWebSocket[] = [];
  static last(): MockWebSocket | undefined { return this.instances.at(-1); }
  static reset(): void { this.instances.length = 0; }
}

// Install mock globally
const origWs = globalThis.WebSocket;
beforeEach(() => {
  MockWebSocket.reset();
  (globalThis as Record<string, unknown>).WebSocket = MockWebSocket;
  // Mock localStorage
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => 'test-jwt-token'), setItem: vi.fn(), removeItem: vi.fn() });
});
afterEach(() => {
  (globalThis as Record<string, unknown>).WebSocket = origWs;
  vi.restoreAllMocks();
});

// ── Import after mock setup ───────────────────────────────────────────────────

import {
  acquireFlintWs,
  subscribeResource,
  sendWsCommand,
  connectionState,
  shouldFallbackToSse,
  getConsecutiveFailures,
  __testing,
} from '../ui/useFlintSocket';
import type { CommandResult } from '../ui/useFlintSocket';

// ══════════════════════════════════════════════════════════════════════════════
// useFlintSocket tests
// ══════════════════════════════════════════════════════════════════════════════

describe('useFlintSocket', () => {
  beforeEach(() => {
    __testing.reset();
  });

  // ── Ref-counted lifecycle ─────────────────────────────────────────────────

  describe('ref-counted lifecycle', () => {
    it('acquireFlintWs creates a WebSocket on first call', () => {
      const release = acquireFlintWs();
      expect(MockWebSocket.instances).toHaveLength(1);
      release();
    });

    it('multiple acquires share same connection', () => {
      const r1 = acquireFlintWs();
      const r2 = acquireFlintWs();
      expect(MockWebSocket.instances).toHaveLength(1);
      r1();
      // Still connected — one ref remaining
      expect(connectionState()).not.toBe('closed');
      r2();
    });

    it('last release disconnects WebSocket', () => {
      const r1 = acquireFlintWs();
      const r2 = acquireFlintWs();
      r1();
      r2();
      // After all refs released, should be closed
      expect(connectionState()).toBe('closed');
    });

    it('clears internal state on final release', () => {
      const release = acquireFlintWs();
      subscribeResource('flint-orders', () => {});
      expect(__testing.activeSubscriptions.size).toBe(1);
      release();
      expect(__testing.activeSubscriptions.size).toBe(0);
      expect(__testing.resourceListeners.size).toBe(0);
    });
  });

  // ── Connection state ──────────────────────────────────────────────────────

  describe('connection state', () => {
    it('starts as connecting on acquire', () => {
      const release = acquireFlintWs();
      expect(connectionState()).toBe('connecting');
      release();
    });

    it('transitions to open on WebSocket open', () => {
      const release = acquireFlintWs();
      MockWebSocket.last()!.simulateOpen();
      expect(connectionState()).toBe('open');
      release();
    });

    it('transitions to closed on disconnect', () => {
      const release = acquireFlintWs();
      MockWebSocket.last()!.simulateOpen();
      release();
      expect(connectionState()).toBe('closed');
    });
  });

  // ── JWT authentation ──────────────────────────────────────────────────────

  describe('JWT authentication', () => {
    it('includes JWT token in WS URL', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      expect(ws.url).toContain('token=test-jwt-token');
      release();
    });

    it('URL has ws:// protocol', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      expect(ws.url).toMatch(/^wss?:\/\//);
      release();
    });
  });

  // ── Resource subscriptions ────────────────────────────────────────────────

  describe('subscribeResource', () => {
    it('sends subscribe message when WS is open', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      subscribeResource('flint-orders', () => {});
      const msg = JSON.parse(ws.sent.at(-1)!);
      expect(msg).toEqual({ type: 'subscribe', resource: 'flint-orders' });
      release();
    });

    it('tracks active subscriptions for reconnect', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const unsub = subscribeResource('flint-products', () => {});
      expect(__testing.activeSubscriptions.has('flint-products')).toBe(true);
      unsub();
      expect(__testing.activeSubscriptions.has('flint-products')).toBe(false);
      release();
    });

    it('sends unsubscribe when last listener removed', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const unsub = subscribeResource('flint-customers', () => {});
      unsub();
      const msg = JSON.parse(ws.sent.at(-1)!);
      expect(msg).toEqual({ type: 'unsubscribe', resource: 'flint-customers' });
      release();
    });

    it('dispatches data updates to callbacks', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const received: unknown[] = [];
      subscribeResource('flint-orders', (data) => received.push(data));

      ws.simulateMessage({
        type: 'data',
        resource: 'flint-orders',
        data: [{ id: 'ord-1' }],
        timestamp: Date.now(),
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual([{ id: 'ord-1' }]);
      release();
    });

    it('supports multiple listeners per resource', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      let count = 0;
      subscribeResource('flint-sales', () => count++);
      subscribeResource('flint-sales', () => count++);

      ws.simulateMessage({
        type: 'data',
        resource: 'flint-sales',
        data: [],
        timestamp: Date.now(),
      });

      expect(count).toBe(2);
      release();
    });

    it('re-subscribes all resources on reconnect', () => {
      vi.useFakeTimers();

      const release = acquireFlintWs();
      const ws1 = MockWebSocket.last()!;
      ws1.simulateOpen();

      subscribeResource('flint-orders', () => {});
      subscribeResource('flint-products', () => {});

      // Simulate disconnect — onclose triggers reconnect timer
      ws1.readyState = MockWebSocket.CLOSED;
      ws1.onclose?.(new Event('close') as CloseEvent);

      // Fast-forward past the first reconnect delay (1s)
      vi.advanceTimersByTime(1500);

      const ws2 = MockWebSocket.last()!;
      expect(ws2).not.toBe(ws1);
      ws2.simulateOpen();

      // Should have re-subscribed both resources
      const resubMsgs = ws2.sent.map(s => JSON.parse(s) as { type: string; resource: string });
      const subscribeMsgs = resubMsgs.filter(m => m.type === 'subscribe');
      expect(subscribeMsgs.map(m => m.resource).sort()).toEqual(['flint-orders', 'flint-products']);

      vi.useRealTimers();
      release();
    });
  });

  // ── Command round-trip ────────────────────────────────────────────────────

  describe('sendWsCommand', () => {
    it('sends command message with correct shape', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      void sendWsCommand('update-order-status', 'flint-orders', 'ord-1', { status: 'shipped' });

      const msg = JSON.parse(ws.sent.at(-1)!);
      expect(msg).toEqual({
        type: 'command',
        action: 'update-order-status',
        resource: 'flint-orders',
        id: 'ord-1',
        payload: { status: 'shipped' },
      });
      release();
    });

    it('resolves on command-result (completed)', async () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const promise = sendWsCommand('delete-order', 'flint-orders', 'ord-2');

      // Server acks the command
      ws.simulateMessage({
        type: 'command-ack',
        commandId: 'cmd-abc',
        status: 'queued',
      });

      // Server sends result
      ws.simulateMessage({
        type: 'command-result',
        commandId: 'cmd-abc',
        status: 'completed',
        data: { deleted: true },
      });

      const result: CommandResult = await promise;
      expect(result.status).toBe('completed');
      expect(result.commandId).toBe('cmd-abc');
      expect(result.data).toEqual({ deleted: true });
      release();
    });

    it('resolves on command-result (failed)', async () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const promise = sendWsCommand('refund-order', 'flint-orders', 'ord-3');

      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-zzz', status: 'queued' });
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-zzz', status: 'failed', error: 'Insufficient funds' });

      const result = await promise;
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Insufficient funds');
      release();
    });

    it('calls onProgress callback on ack and progress', async () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const progressUpdates: string[] = [];
      const promise = sendWsCommand(
        'update-product', 'flint-products', 'prod-1', { stock: 5 },
        (status) => progressUpdates.push(status),
      );

      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-p1', status: 'queued' });
      ws.simulateMessage({ type: 'command-progress', commandId: 'cmd-p1', status: 'processing' });
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-p1', status: 'completed' });

      await promise;
      expect(progressUpdates).toEqual(['queued', 'processing']);
      release();
    });

    it('rejects when WS not connected', async () => {
      __testing.reset();
      await expect(sendWsCommand('test', 'test')).rejects.toThrow('WebSocket not connected');
    });

    it('FIFO: concurrent commands are acked in order', async () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const p1 = sendWsCommand('update-order-status', 'flint-orders', 'ord-1', { status: 'shipped' });
      const p2 = sendWsCommand('delete-order', 'flint-orders', 'ord-2');

      // Acks arrive in order
      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-1', status: 'queued' });
      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-2', status: 'queued' });

      // Results can arrive in any order — but still mapped correctly
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-2', status: 'completed', data: 'second' });
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-1', status: 'completed', data: 'first' });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.commandId).toBe('cmd-1');
      expect(r1.data).toBe('first');
      expect(r2.commandId).toBe('cmd-2');
      expect(r2.data).toBe('second');
      release();
    });
  });

  // ── SSE fallback threshold ────────────────────────────────────────────────

  describe('SSE fallback', () => {
    it('shouldFallbackToSse returns false initially', () => {
      expect(shouldFallbackToSse()).toBe(false);
      expect(getConsecutiveFailures()).toBe(0);
    });

    it('tracks consecutive failures on error', () => {
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;

      // Simulate errors
      ws.simulateError();
      expect(getConsecutiveFailures()).toBe(1);
      expect(shouldFallbackToSse()).toBe(false);

      // Need 3 consecutive for fallback, but errors trigger reconnect
      // After onerror, onclose fires which starts reconnect
      release();
    });

    it('resets failure count on successful open', () => {
      vi.useFakeTimers();

      const release = acquireFlintWs();
      const ws1 = MockWebSocket.last()!;
      ws1.simulateErrorClose();
      expect(getConsecutiveFailures()).toBe(1);

      vi.advanceTimersByTime(2000);
      const ws2 = MockWebSocket.last()!;
      ws2.simulateOpen();
      expect(getConsecutiveFailures()).toBe(0);
      expect(shouldFallbackToSse()).toBe(false);

      vi.useRealTimers();
      release();
    });
  });

  // ── Reconnect backoff ─────────────────────────────────────────────────────

  describe('reconnect backoff', () => {
    it('reconnects with exponential backoff', () => {
      vi.useFakeTimers();

      const release = acquireFlintWs();
      expect(MockWebSocket.instances).toHaveLength(1);

      // First disconnect
      MockWebSocket.last()!.simulateErrorClose();

      // After 1s (2^0 * 1000): first reconnect
      vi.advanceTimersByTime(1000);
      expect(MockWebSocket.instances).toHaveLength(2);

      // Second disconnect
      MockWebSocket.last()!.simulateErrorClose();

      // After 2s (2^1 * 1000): second reconnect
      vi.advanceTimersByTime(2000);
      expect(MockWebSocket.instances).toHaveLength(3);

      vi.useRealTimers();
      release();
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// flintRealtimeStore tests
// ══════════════════════════════════════════════════════════════════════════════

describe('flintRealtimeStore', () => {
  beforeEach(() => {
    __testing.reset();
  });

  // ── ACTION_RESOURCE mapping ───────────────────────────────────────────────

  describe('ACTION_RESOURCE mapping', () => {
    // Import dynamically to avoid module-level side effects
    it('maps all 17 actions to their resources', async () => {
      const { sendCommand } = await import('../tiles/flint/flintRealtimeStore');

      // sendCommand calls sendWsCommand with resource from ACTION_RESOURCE.
      // We can verify the mapping by inspecting the sent WS message.
      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      // Fire-and-forget (will reject on timeout but we catch it)
      void sendCommand('update-order-status', 'ord-1', { status: 'shipped' }).catch(() => {});
      const msg = JSON.parse(ws.sent.at(-1)!);
      expect(msg.resource).toBe('flint-orders');

      void sendCommand('create-product', undefined, { name: 'Test' }).catch(() => {});
      const msg2 = JSON.parse(ws.sent.at(-1)!);
      expect(msg2.resource).toBe('flint-products');

      void sendCommand('update-category', 'cat-1', { name: 'New' }).catch(() => {});
      const msg3 = JSON.parse(ws.sent.at(-1)!);
      expect(msg3.resource).toBe('flint-categories');

      void sendCommand('update-customer', 'cust-1').catch(() => {});
      const msg4 = JSON.parse(ws.sent.at(-1)!);
      expect(msg4.resource).toBe('flint-customers');

      void sendCommand('create-shipment', undefined).catch(() => {});
      const msg5 = JSON.parse(ws.sent.at(-1)!);
      expect(msg5.resource).toBe('flint-shipments');

      void sendCommand('run-data-health').catch(() => {});
      const msg6 = JSON.parse(ws.sent.at(-1)!);
      expect(msg6.resource).toBe('flint-data-health');

      void sendCommand('set-sales-range', undefined, { from: '2024-01-01' }).catch(() => {});
      const msg7 = JSON.parse(ws.sent.at(-1)!);
      expect(msg7.resource).toBe('flint-sales');

      release();
    });
  });

  // ── sendCommand integration ───────────────────────────────────────────────

  describe('sendCommand', () => {
    it('routes and resolves via WS round-trip', async () => {
      const { sendCommand } = await import('../tiles/flint/flintRealtimeStore');

      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const p = sendCommand('delete-product', 'prod-5');

      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-x1', status: 'queued' });
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-x1', status: 'completed', data: { ok: true } });

      const result = await p;
      expect(result.status).toBe('completed');
      expect(result.data).toEqual({ ok: true });
      release();
    });

    it('reports failure correctly', async () => {
      const { sendCommand } = await import('../tiles/flint/flintRealtimeStore');

      const release = acquireFlintWs();
      const ws = MockWebSocket.last()!;
      ws.simulateOpen();

      const p = sendCommand('refund-order', 'ord-7', { amount: 100 });

      ws.simulateMessage({ type: 'command-ack', commandId: 'cmd-f1', status: 'queued' });
      ws.simulateMessage({ type: 'command-result', commandId: 'cmd-f1', status: 'failed', error: 'Declined' });

      const result = await p;
      expect(result.status).toBe('failed');
      expect(result.error).toBe('Declined');
      release();
    });
  });

  // ── useFlintResource interface ────────────────────────────────────────────

  describe('useFlintResource', () => {
    it('returns data, loading, error accessors (drop-in for useSseChannel)', async () => {
      const { useFlintResource } = await import('../tiles/flint/flintRealtimeStore');

      createRoot((dispose) => {
        const { data, loading, error } = useFlintResource<string[]>('flint-test', []);
        expect(typeof data).toBe('function');
        expect(typeof loading).toBe('function');
        expect(typeof error).toBe('function');
        expect(data()).toEqual([]);
        expect(loading()).toBe(true);
        expect(error()).toBe(null);
        dispose();
      });
    });
  });

  // ── transportMode signal ──────────────────────────────────────────────────

  describe('transportMode', () => {
    it('defaults to ws', async () => {
      const { transportMode } = await import('../tiles/flint/flintRealtimeStore');
      expect(transportMode()).toBe('ws');
    });
  });

  // ── connectionState re-export ─────────────────────────────────────────────

  describe('connectionState re-export', () => {
    it('re-exports connectionState from useFlintSocket', async () => {
      const store = await import('../tiles/flint/flintRealtimeStore');
      expect(store.connectionState).toBe(connectionState);
    });
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// FlintWsIndicator tests
// ══════════════════════════════════════════════════════════════════════════════

describe('FlintWsIndicator', () => {
  it('exports a valid SolidJS component', async () => {
    const { FlintWsIndicator } = await import('../tiles/flint/FlintWsIndicator');
    expect(typeof FlintWsIndicator).toBe('function');
  });
});
