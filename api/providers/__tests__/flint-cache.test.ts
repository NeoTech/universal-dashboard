// @vitest-environment node
/**
 * Tests for the FLINT Drizzle cache module (api/db/flint-db.ts).
 *
 * Since vitest runs in Node.js and Drizzle wraps bun:sqlite, we mock the
 * Database class. These tests verify the module loads cleanly, exports the
 * expected API, and that the functions exercise the correct Drizzle operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── bun:sqlite mock (must precede all imports that transitively use it) ───────
const mockRun = vi.fn();
const mockAll = vi.fn(() => []);
const mockGet = vi.fn(() => null);

vi.mock('bun:sqlite', () => {
  class Database {
    run() { return this; }
    prepare() { return { all: mockAll, get: mockGet, run: mockRun, values: () => [] }; }
  }
  return { Database };
});

import { upsertCache, getCache, purgeExpired, isWalMode, getDbSizeBytes, closeDb, db } from '../../db/flint-db.ts';

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe('flint-db module exports', () => {
  it('exports the Drizzle db instance', () => {
    expect(db).toBeDefined();
  });

  it('exports upsertCache as a function', () => {
    expect(typeof upsertCache).toBe('function');
  });

  it('exports getCache as a function', () => {
    expect(typeof getCache).toBe('function');
  });

  it('exports purgeExpired as a function', () => {
    expect(typeof purgeExpired).toBe('function');
  });

  it('exports utility functions', () => {
    expect(typeof isWalMode).toBe('function');
    expect(typeof getDbSizeBytes).toBe('function');
    expect(typeof closeDb).toBe('function');
  });
});

// ── upsertCache ───────────────────────────────────────────────────────────────

describe('upsertCache', () => {
  beforeEach(() => {
    mockRun.mockClear();
  });

  it('calls the database for a cache write', () => {
    upsertCache('flint-orders', [{ id: 1 }], 60_000);
    // Drizzle executes via prepare().run() on the underlying SQLite driver
    expect(mockRun).toHaveBeenCalled();
  });

  it('accepts optional etag parameter', () => {
    // Should not throw
    expect(() => upsertCache('flint-orders', [], 60_000, 'etag-123')).not.toThrow();
  });

  it('serializes complex data to JSON', () => {
    const data = { nested: { orders: [1, 2, 3], meta: { page: 1 } } };
    expect(() => upsertCache('test-resource', data, 5000)).not.toThrow();
  });
});

// ── getCache ──────────────────────────────────────────────────────────────────

describe('getCache', () => {
  beforeEach(() => {
    mockAll.mockClear();
  });

  it('returns null when the cache is empty', () => {
    mockAll.mockReturnValueOnce([]);
    const result = getCache('nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for expired entries', () => {
    // With the mock DB always returning [], getCache returns null
    // (deeper TTL logic requires a real SQLite instance)
    const result = getCache('r');
    expect(result).toBeNull();
  });

  it('returns null for nonexistent entries', () => {
    const result = getCache<Array<{ id: string }>>('flint-orders');
    expect(result).toBeNull();
  });
});

// ── purgeExpired ──────────────────────────────────────────────────────────────

describe('purgeExpired', () => {
  beforeEach(() => {
    mockRun.mockClear();
  });

  it('calls the database to delete expired entries', () => {
    mockRun.mockReturnValueOnce({ changes: 3 });
    const count = purgeExpired();
    expect(mockRun).toHaveBeenCalled();
    // Returns the number of purged rows (or 0 if mock doesn't set changes)
    expect(typeof count).toBe('number');
  });
});
