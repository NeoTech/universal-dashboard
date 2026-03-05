/**
 * WebSocket hub for FLINT real-time communication.
 *
 * Handles `/ws/flint` upgrade requests. Each connected client can:
 * - Subscribe to FLINT resources (receives cached data immediately + live updates)
 * - Unsubscribe from resources
 * - Send commands (mutations) that are enqueued in the durable command queue
 *
 * The hub maintains an in-memory map of connected clients and their subscriptions,
 * with SQLite-backed subscription tracking for crash recovery.
 *
 * Wire into server.ts via:
 *   server.on('upgrade', (req, socket, head) => handleWsUpgrade(req, socket, head))
 */

import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { db } from '../db/flint-db.ts';
import {
  getCache,
  getProjectedOrderById,
  getProjectedCustomerById,
  getProductNameMap,
} from '../db/flint-db.ts';
import { resolveOrderLineNames } from '../db/flint-db.ts';
import { wsSubscriptions } from '../db/flint-schema.ts';
import { eq } from 'drizzle-orm';
import { enqueue } from '../providers/flint-queue.ts';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Inbound message from a WS client. */
export type FlintWsInbound =
  | { type: 'subscribe'; resource: string }
  | { type: 'unsubscribe'; resource: string }
  | { type: 'command'; action: string; id?: string; resource: string; payload?: unknown }
  | { type: 'query'; queryId: string; resource: string; params?: Record<string, unknown> };

/** Outbound message from the server to WS clients. */
export type FlintWsOutbound =
  | { type: 'connected'; id: string }
  | { type: 'data'; resource: string; data: unknown; timestamp: number }
  | { type: 'command-ack'; commandId: string; status: 'queued' }
  | { type: 'command-progress'; commandId: string; status: 'processing' }
  | { type: 'command-result'; commandId: string; status: 'completed' | 'failed'; data?: unknown; error?: string }
  | { type: 'query-result'; queryId: string; resource: string; data: unknown; timestamp: number }
  | { type: 'error'; message: string };

// ── Action-to-route mapping ───────────────────────────────────────────────────

const ACTION_ROUTES: Record<string, { method: string; pathFn: (id?: string) => string; resource: string }> = {
  'update-order-status':   { method: 'PUT',    pathFn: (id) => `/orders/${id}/status`,           resource: 'flint-orders' },
  'delete-order':          { method: 'DELETE',  pathFn: (id) => `/orders/${id}`,                  resource: 'flint-orders' },
  'refund-order':          { method: 'POST',    pathFn: (id) => `/orders/${id}/refund`,           resource: 'flint-orders' },
  'create-product':        { method: 'POST',    pathFn: () => '/products',                        resource: 'flint-products' },
  'update-product':        { method: 'PUT',     pathFn: (id) => `/products/${id}`,                resource: 'flint-products' },
  'delete-product':        { method: 'DELETE',  pathFn: (id) => `/products/${id}`,                resource: 'flint-products' },
  'create-variant':        { method: 'POST',    pathFn: (id) => `/products/${id}/variants`,       resource: 'flint-products' },
  'update-variant':        { method: 'PUT',     pathFn: (id) => `/products/${id}/variants`,       resource: 'flint-products' },
  'create-category':       { method: 'POST',    pathFn: () => '/categories',                      resource: 'flint-categories' },
  'update-category':       { method: 'PUT',     pathFn: (id) => `/categories/${id}`,              resource: 'flint-categories' },
  'delete-category':       { method: 'DELETE',  pathFn: (id) => `/categories/${id}`,              resource: 'flint-categories' },
  'update-customer':       { method: 'PUT',     pathFn: (id) => `/customers/${id}`,               resource: 'flint-customers' },
  'create-shipment':       { method: 'POST',    pathFn: () => '/shipments',                       resource: 'flint-shipments' },
  'update-shipment':       { method: 'PUT',     pathFn: (id) => `/shipments/${id}`,               resource: 'flint-shipments' },
  'sync-stripe':           { method: 'POST',    pathFn: () => '/admin/sync-stripe',               resource: 'flint-orders' },
  'run-data-health':       { method: 'POST',    pathFn: () => '/admin/data-health',               resource: 'flint-data-health' },
  'set-sales-range':       { method: 'POST',    pathFn: () => '/sales-range',                     resource: 'flint-sales' },
};

// ── State ─────────────────────────────────────────────────────────────────────

/** Connected WS clients keyed by their UUID. */
const clients = new Map<string, WebSocket>();

/** In-memory subscription index: resource -> set of connection IDs. */
const subscriptionIndex = new Map<string, Set<string>>();

/** JWT verifier injected from server.ts at startup. */
let _verifyToken: ((token: string) => unknown | null) | null = null;

/** WebSocketServer instance (created once). */
let wss: WebSocketServer | null = null;

// ── Initialization ────────────────────────────────────────────────────────────

/**
 * Set the JWT verification function. Called once from server.ts.
 */
export function setTokenVerifier(verifier: (token: string) => unknown | null): void {
  _verifyToken = verifier;
}

/**
 * Initialize the WebSocket server and return the upgrade handler.
 * Must be called once during server startup.
 */
export function createWsServer(): WebSocketServer {
  if (wss) return wss;

  wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (ws: WebSocket, connectionId: string) => {
    clients.set(connectionId, ws);
    console.log(`  [ws-flint] connected: ${connectionId} (${clients.size} total)`);

    // Send connected acknowledgment
    sendTo(ws, { type: 'connected', id: connectionId });

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as FlintWsInbound;
        handleMessage(connectionId, ws, msg);
      } catch {
        sendTo(ws, { type: 'error', message: 'Invalid JSON' });
      }
    });

    ws.on('close', () => {
      cleanup(connectionId);
    });

    ws.on('error', () => {
      cleanup(connectionId);
    });
  });

  // Clean up any stale subscriptions from previous server run
  db.delete(wsSubscriptions).run();

  console.log('  [ws-flint] WebSocket server initialized');
  return wss;
}

/**
 * Handle the HTTP upgrade request for `/ws/flint`.
 * Validates the JWT token from `?token=` query parameter.
 */
export function handleWsUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
  if (!wss) {
    socket.destroy();
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');

  // Auth check (same pattern as SSE: ?token= query param)
  const authEnabled = process.env['AUTH_ENABLED'] === 'true';
  if (authEnabled) {
    const token = url.searchParams.get('token');
    if (!token || !_verifyToken?.(token)) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }

  const connectionId = randomUUID();

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss!.emit('connection', ws, connectionId);
  });
}

// ── Message handling ──────────────────────────────────────────────────────────

function handleMessage(connectionId: string, ws: WebSocket, msg: FlintWsInbound): void {
  switch (msg.type) {
    case 'subscribe':
      subscribe(connectionId, msg.resource);
      // Send cached data immediately
      {
        const cached = getCache(msg.resource);
        if (cached !== null) {
          sendTo(ws, { type: 'data', resource: msg.resource, data: cached, timestamp: Date.now() });
        }
      }
      break;

    case 'unsubscribe':
      unsubscribe(connectionId, msg.resource);
      break;

    case 'command': {
      const route = ACTION_ROUTES[msg.action];
      if (!route) {
        sendTo(ws, { type: 'error', message: `Unknown action: ${msg.action}` });
        return;
      }

      const commandId = enqueue({
        resource: route.resource,
        method: route.method,
        path: route.pathFn(msg.id),
        payload: msg.payload,
      });

      sendTo(ws, { type: 'command-ack', commandId, status: 'queued' });
      break;
    }

    case 'query': {
      try {
        const result = handleQuery(msg.resource, msg.params);
        sendTo(ws, {
          type: 'query-result',
          queryId: msg.queryId,
          resource: msg.resource,
          data: result,
          timestamp: Date.now(),
        });
      } catch (err) {
        console.error(`[ws-flint] query error for ${msg.resource}:`, err);
        sendTo(ws, {
          type: 'query-result',
          queryId: msg.queryId,
          resource: msg.resource,
          data: null,
          timestamp: Date.now(),
        });
      }
      break;
    }
  }
}

// ── Query handling ────────────────────────────────────────────────────────────

/**
 * Handle a query message by reading from local caches.
 * Zero upstream calls — returns whatever is projected/cached, enriched with
 * product names and customer info from relational tables.
 */
function handleQuery(resource: string, params?: Record<string, unknown>): unknown {
  switch (resource) {
    case 'flint-order-detail': {
      const orderId = String(params?.id ?? '');
      if (!orderId) return null;

      const projected = getProjectedOrderById(orderId);
      if (!projected) {
        // Try blob cache as fallback
        const cached = getCache((`flint-order:${orderId}`));
        return cached ?? null;
      }

      // Enrich lines with product names from relational cache
      const productNameMap = getProductNameMap();
      const enrichedLines = resolveOrderLineNames(projected.lines, productNameMap);

      // Enrich customer name/email if missing
      let customerName = projected.customerName;
      let customerEmail = projected.customerEmail;
      if ((customerName === '\u2014' || customerEmail === '\u2014') && projected.customerId) {
        const customer = getProjectedCustomerById(projected.customerId);
        if (customer) {
          if (customerName === '\u2014') customerName = customer.name;
          if (customerEmail === '\u2014') customerEmail = customer.email;
        }
      }

      return { ...projected, lines: enrichedLines, customerName, customerEmail };
    }

    default:
      // For any other resource, return the blob cache entry
      return getCache(resource);
  }
}

// ── Subscription management ───────────────────────────────────────────────────

function subscribe(connectionId: string, resource: string): void {
  // In-memory index
  let subs = subscriptionIndex.get(resource);
  if (!subs) {
    subs = new Set();
    subscriptionIndex.set(resource, subs);
  }
  subs.add(connectionId);

  // Persist to SQLite
  db.insert(wsSubscriptions)
    .values({ connectionId, resource, subscribedAt: Date.now() })
    .onConflictDoNothing()
    .run();
}

function unsubscribe(connectionId: string, resource: string): void {
  const subs = subscriptionIndex.get(resource);
  if (subs) {
    subs.delete(connectionId);
    if (subs.size === 0) subscriptionIndex.delete(resource);
  }

  db.delete(wsSubscriptions)
    .where(eq(wsSubscriptions.connectionId, connectionId))
    .run();
}

function cleanup(connectionId: string): void {
  clients.delete(connectionId);

  // Remove from all subscription sets
  for (const [resource, subs] of subscriptionIndex) {
    subs.delete(connectionId);
    if (subs.size === 0) subscriptionIndex.delete(resource);
  }

  // Remove from SQLite
  db.delete(wsSubscriptions)
    .where(eq(wsSubscriptions.connectionId, connectionId))
    .run();

  console.log(`  [ws-flint] disconnected: ${connectionId} (${clients.size} remaining)`);
}

// ── Broadcasting ──────────────────────────────────────────────────────────────

/**
 * Broadcast a resource update to all WS clients subscribed to it.
 * Called by FLINT pollers after writing to the Drizzle cache.
 */
export function broadcastResource(resource: string, data: unknown): void {
  const subs = subscriptionIndex.get(resource);
  if (!subs || subs.size === 0) return;

  const frame: FlintWsOutbound = {
    type: 'data',
    resource,
    data,
    timestamp: Date.now(),
  };

  const payload = JSON.stringify(frame);

  for (const connId of subs) {
    const ws = clients.get(connId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Send a command-progress notification to ALL connected clients.
 */
export function broadcastCommandProgress(commandId: string): void {
  const frame: FlintWsOutbound = {
    type: 'command-progress',
    commandId,
    status: 'processing',
  };

  const payload = JSON.stringify(frame);

  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Send a command result to ALL connected clients (the originator and any
 * other tabs/users watching the same resource).
 */
export function broadcastCommandResult(
  commandId: string,
  status: 'completed' | 'failed',
  data?: unknown,
  error?: string,
): void {
  const frame: FlintWsOutbound = {
    type: 'command-result',
    commandId,
    status,
    ...(data !== undefined && { data }),
    ...(error !== undefined && { error }),
  };

  const payload = JSON.stringify(frame);

  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

/**
 * Get the number of connected clients (for logging / admin).
 */
export function getClientCount(): number {
  return clients.size;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sendTo(ws: WebSocket, msg: FlintWsOutbound): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Test internals (exposed for unit tests only) ──────────────────────────────
export const __testing = {
  clients,
  subscriptionIndex,
  subscribe,
  unsubscribe,
  cleanup,
} as const;
