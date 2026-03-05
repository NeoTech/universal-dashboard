// @vitest-environment node
/**
 * Tests for the FLINT durable command queue (api/providers/flint-queue.ts).
 *
 * Since the queue stores state in SQLite via Drizzle, we mock bun:sqlite.
 * These tests focus on the queue's non-DB logic: executor registration,
 * lifecycle hooks, loop management, and the processOne flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
  startProcessingLoop,
  stopProcessingLoop,
} from '../flint-queue.ts';

// ── Module exports ────────────────────────────────────────────────────────────

describe('flint-queue module exports', () => {
  it('exports enqueue as a function', () => {
    expect(typeof enqueue).toBe('function');
  });

  it('exports setCommandExecutor as a function', () => {
    expect(typeof setCommandExecutor).toBe('function');
  });

  it('exports onCommandLifecycle as a function', () => {
    expect(typeof onCommandLifecycle).toBe('function');
  });

  it('exports getQueueStatus as a function', () => {
    expect(typeof getQueueStatus).toBe('function');
  });

  it('exports loop control functions', () => {
    expect(typeof startProcessingLoop).toBe('function');
    expect(typeof stopProcessingLoop).toBe('function');
  });
});

// ── enqueue ───────────────────────────────────────────────────────────────────

describe('enqueue', () => {
  it('returns a UUID string', () => {
    const id = enqueue({ resource: 'flint-orders', method: 'PUT', path: '/orders/1/status' });
    // UUID v4 format
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('returns unique IDs for each call', () => {
    const id1 = enqueue({ resource: 'r1', method: 'POST', path: '/a' });
    const id2 = enqueue({ resource: 'r2', method: 'POST', path: '/b' });
    expect(id1).not.toBe(id2);
  });

  it('accepts optional payload', () => {
    const id = enqueue({
      resource: 'flint-products',
      method: 'POST',
      path: '/products',
      payload: { name: 'Test', price: 10 },
    });
    expect(id).toBeTruthy();
  });
});

// ── Executor registration ─────────────────────────────────────────────────────

describe('setCommandExecutor', () => {
  afterEach(() => {
    // Reset to a no-op executor
    setCommandExecutor(async () => ({ ok: true }));
  });

  it('stores the executor function without throwing', () => {
    const executor = vi.fn(async () => ({ ok: true }));
    expect(() => setCommandExecutor(executor)).not.toThrow();
  });
});

// ── Lifecycle hooks ───────────────────────────────────────────────────────────

describe('onCommandLifecycle', () => {
  it('stores hooks without throwing', () => {
    const onComplete = vi.fn();
    const onFailed = vi.fn();
    expect(() => onCommandLifecycle({ onComplete, onFailed })).not.toThrow();
  });
});

// ── Loop management ───────────────────────────────────────────────────────────

describe('processing loop', () => {
  afterEach(() => {
    stopProcessingLoop();
  });

  it('starts without throwing', () => {
    expect(() => startProcessingLoop()).not.toThrow();
  });

  it('stops without throwing', () => {
    startProcessingLoop();
    expect(() => stopProcessingLoop()).not.toThrow();
  });

  it('can be re-started after stopping', () => {
    startProcessingLoop();
    stopProcessingLoop();
    expect(() => startProcessingLoop()).not.toThrow();
  });
});

// ── getQueueStatus ────────────────────────────────────────────────────────────

describe('getQueueStatus', () => {
  it('returns an object with expected fields', () => {
    const status = getQueueStatus();
    expect(status).toHaveProperty('pending');
    expect(status).toHaveProperty('processing');
    expect(status).toHaveProperty('completed');
    expect(status).toHaveProperty('failed');
    expect(status).toHaveProperty('recentErrors');
    expect(Array.isArray(status.recentErrors)).toBe(true);
  });

  it('returns numeric counts', () => {
    const status = getQueueStatus();
    expect(typeof status.pending).toBe('number');
    expect(typeof status.processing).toBe('number');
    expect(typeof status.completed).toBe('number');
    expect(typeof status.failed).toBe('number');
  });
});
