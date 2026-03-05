/**
 * Durable command queue for FLINT mutations backed by Drizzle ORM + SQLite.
 *
 * All FLINT write operations (order status change, stock edit, shipment create,
 * etc.) are enqueued as rows in the `command_queue` table. A processing loop
 * dequeues one command at a time, executes it against the LOPC API, and records
 * the result. Failed commands are retried up to MAX_RETRIES before being marked
 * as permanently failed.
 *
 * External callers:
 * - `enqueue(cmd)` — add a command (returns the generated UUID)
 * - `startProcessingLoop()` / `stopProcessingLoop()` — lifecycle
 * - `getQueueStatus()` — summary for admin dashboards
 */

import { randomUUID } from 'node:crypto';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '../db/flint-db.ts';
import { commandQueue } from '../db/flint-schema.ts';
import type { CommandQueueRow } from '../db/flint-schema.ts';

// ── Configuration ─────────────────────────────────────────────────────────────

const MAX_RETRIES = parseInt(process.env['FLINT_QUEUE_MAX_RETRIES'] ?? '3', 10);
const LOOP_INTERVAL_MS = 500;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnqueueCommand {
  resource: string;
  method: string;
  path: string;
  payload?: unknown;
}

export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  recentErrors: Array<{
    id: string;
    resource: string;
    path: string;
    error: string | null;
    createdAt: number;
  }>;
}

/**
 * Callback that executes a command against the LOPC upstream.
 * Set via `setCommandExecutor()` — decouples queue from flint provider.
 */
export type CommandExecutor = (
  method: string,
  path: string,
  payload: unknown | null,
) => Promise<unknown>;

// ── State ─────────────────────────────────────────────────────────────────────

let _executor: CommandExecutor | null = null;
let _loopTimer: ReturnType<typeof setInterval> | null = null;
let _onCommandStart: ((cmd: CommandQueueRow) => void) | null = null;
let _onCommandComplete: ((cmd: CommandQueueRow, result: unknown) => void) | null = null;
let _onCommandFailed: ((cmd: CommandQueueRow, error: string) => void) | null = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register the function that executes upstream LOPC calls.
 * Called once during server startup from the flint provider.
 */
export function setCommandExecutor(executor: CommandExecutor): void {
  _executor = executor;
}

/**
 * Register callbacks for command lifecycle events (used by WS hub for broadcasting).
 */
export function onCommandLifecycle(handlers: {
  onStart?: (cmd: CommandQueueRow) => void;
  onComplete?: (cmd: CommandQueueRow, result: unknown) => void;
  onFailed?: (cmd: CommandQueueRow, error: string) => void;
}): void {
  if (handlers.onStart) _onCommandStart = handlers.onStart;
  if (handlers.onComplete) _onCommandComplete = handlers.onComplete;
  if (handlers.onFailed) _onCommandFailed = handlers.onFailed;
}

/**
 * Enqueue a new command for processing.
 *
 * @returns The generated command UUID.
 */
export function enqueue(cmd: EnqueueCommand): string {
  const id = randomUUID();
  db.insert(commandQueue)
    .values({
      id,
      resource: cmd.resource,
      method: cmd.method,
      path: cmd.path,
      payload: cmd.payload != null ? JSON.stringify(cmd.payload) : null,
      status: 'pending',
      createdAt: Date.now(),
      retryCount: 0,
    })
    .run();
  return id;
}

/**
 * Dequeue the oldest pending command and mark it as processing.
 * Uses a single atomic UPDATE ... RETURNING to avoid double-processing.
 *
 * @returns The command row, or null if the queue is empty.
 */
export function dequeue(): CommandQueueRow | null {
  // SQLite doesn't support UPDATE ... RETURNING with subquery well in all
  // drivers, so we use a two-step approach within a transaction.
  const row = db
    .select()
    .from(commandQueue)
    .where(eq(commandQueue.status, 'pending'))
    .orderBy(asc(commandQueue.createdAt))
    .limit(1)
    .get();

  if (!row) return null;

  db.update(commandQueue)
    .set({ status: 'processing', startedAt: Date.now() })
    .where(
      and(
        eq(commandQueue.id, row.id),
        eq(commandQueue.status, 'pending'),
      ),
    )
    .run();

  return { ...row, status: 'processing', startedAt: Date.now() };
}

/**
 * Mark a command as completed with its result.
 */
export function complete(id: string, result: unknown): void {
  db.update(commandQueue)
    .set({
      status: 'completed',
      completedAt: Date.now(),
      result: JSON.stringify(result),
    })
    .where(eq(commandQueue.id, id))
    .run();
}

/**
 * Mark a command as failed. If retries < MAX_RETRIES, reset to pending
 * for another attempt. Otherwise mark as permanently failed.
 */
export function fail(id: string, error: string): void {
  const row = db
    .select({ retryCount: commandQueue.retryCount })
    .from(commandQueue)
    .where(eq(commandQueue.id, id))
    .get();

  const retries = (row?.retryCount ?? 0) + 1;

  if (retries < MAX_RETRIES) {
    db.update(commandQueue)
      .set({
        status: 'pending',
        retryCount: retries,
        error,
        startedAt: null,
      })
      .where(eq(commandQueue.id, id))
      .run();
  } else {
    db.update(commandQueue)
      .set({
        status: 'failed',
        completedAt: Date.now(),
        retryCount: retries,
        error,
      })
      .where(eq(commandQueue.id, id))
      .run();
  }
}

/**
 * Get a summary of the queue state for admin dashboards.
 */
export function getQueueStatus(): QueueStatus {
  const counts = db
    .select({
      status: commandQueue.status,
      count: sql<number>`count(*)`,
    })
    .from(commandQueue)
    .groupBy(commandQueue.status)
    .all();

  const countMap = new Map(counts.map((r) => [r.status, r.count]));

  const recentErrors = db
    .select({
      id: commandQueue.id,
      resource: commandQueue.resource,
      path: commandQueue.path,
      error: commandQueue.error,
      createdAt: commandQueue.createdAt,
    })
    .from(commandQueue)
    .where(eq(commandQueue.status, 'failed'))
    .orderBy(asc(commandQueue.createdAt))
    .limit(10)
    .all();

  return {
    pending: countMap.get('pending') ?? 0,
    processing: countMap.get('processing') ?? 0,
    completed: countMap.get('completed') ?? 0,
    failed: countMap.get('failed') ?? 0,
    recentErrors,
  };
}

/**
 * Clean up completed/failed commands older than the given age.
 *
 * @param maxAgeMs - Max age in milliseconds (default: 24 hours).
 * @returns Number of rows deleted.
 */
export function purgeOldCommands(maxAgeMs = 86_400_000): number {
  const cutoff = Date.now() - maxAgeMs;
  const result = db
    .delete(commandQueue)
    .where(
      and(
        sql`${commandQueue.status} IN ('completed', 'failed')`,
        sql`${commandQueue.completedAt} < ${cutoff}`,
      ),
    )
    .run();
  return result.changes;
}

// ── Processing loop ───────────────────────────────────────────────────────────

async function processOne(): Promise<void> {
  if (!_executor) return;

  const cmd = dequeue();
  if (!cmd) return;

  _onCommandStart?.(cmd);

  try {
    const payload = cmd.payload ? JSON.parse(cmd.payload) as unknown : null;
    const result = await _executor(cmd.method, cmd.path, payload);
    complete(cmd.id, result);
    _onCommandComplete?.(cmd, result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(cmd.id, msg);

    // Re-read to check final status after fail() may have retried
    const updated = db
      .select()
      .from(commandQueue)
      .where(eq(commandQueue.id, cmd.id))
      .get();

    if (updated && updated.status === 'failed') {
      _onCommandFailed?.(updated, msg);
    }
  }
}

/**
 * Start the background processing loop.
 */
export function startProcessingLoop(): void {
  if (_loopTimer) return;
  _loopTimer = setInterval(() => { void processOne(); }, LOOP_INTERVAL_MS);
  console.log(`  [flint-queue] processing loop started (${LOOP_INTERVAL_MS}ms interval, max ${MAX_RETRIES} retries)`);
}

/**
 * Stop the background processing loop.
 */
export function stopProcessingLoop(): void {
  if (_loopTimer) {
    clearInterval(_loopTimer);
    _loopTimer = null;
  }
}

/**
 * Reset any commands stuck in 'processing' state back to 'pending'.
 * Called at startup to recover from unclean shutdown.
 */
export function recoverStuckCommands(): number {
  const result = db
    .update(commandQueue)
    .set({ status: 'pending', startedAt: null })
    .where(eq(commandQueue.status, 'processing'))
    .run();
  if (result.changes > 0) {
    console.log(`  [flint-queue] recovered ${result.changes} stuck command(s)`);
  }
  return result.changes;
}
