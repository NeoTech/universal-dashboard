/**
 * useFlintSocket — singleton WebSocket client for FLINT real-time communication.
 *
 * Wraps a single WebSocket connection to `/ws/flint` with:
 * - Ref-counted lifecycle (connect on first subscriber, close on last cleanup)
 * - Exponential backoff reconnection (1s, 2s, 4s, 8s, max 30s)
 * - JWT auth via `?token=` query parameter (same pattern as SSE)
 * - Typed inbound/outbound message handling
 * - Resource subscription registry with automatic re-subscribe on reconnect
 * - Command result promise tracking for `sendCommand` round-trips
 *
 * This is a low-level transport layer. Tiles should use `useFlintResource` and
 * `sendCommand` from `flintRealtimeStore.ts` instead of this directly.
 */
import { createSignal } from 'solid-js';
import { API_BASE_URL } from '../data/api';

// ── WS Message Types (frontend-side mirror of api/ws/flint-hub.ts) ────────────

export interface FlintWsSubscribe   { type: 'subscribe';   resource: string }
export interface FlintWsUnsubscribe { type: 'unsubscribe'; resource: string }
export interface FlintWsCommand     { type: 'command'; action: string; id?: string; resource: string; payload?: unknown }
export interface FlintWsQuery       { type: 'query'; queryId: string; resource: string; params?: Record<string, unknown> }

export type FlintWsInbound = FlintWsSubscribe | FlintWsUnsubscribe | FlintWsCommand | FlintWsQuery;

export interface FlintWsConnected       { type: 'connected'; id: string }
export interface FlintWsData            { type: 'data'; resource: string; data: unknown; timestamp: number }
export interface FlintWsCommandAck      { type: 'command-ack'; commandId: string; status: 'queued' }
export interface FlintWsCommandProgress { type: 'command-progress'; commandId: string; status: 'processing' }
export interface FlintWsCommandResult   { type: 'command-result'; commandId: string; status: 'completed' | 'failed'; data?: unknown; error?: string }
export interface FlintWsQueryResult     { type: 'query-result'; queryId: string; resource: string; data: unknown; timestamp: number }
export interface FlintWsError           { type: 'error'; message: string }

export type FlintWsOutbound =
  | FlintWsConnected
  | FlintWsData
  | FlintWsCommandAck
  | FlintWsCommandProgress
  | FlintWsCommandResult
  | FlintWsQueryResult
  | FlintWsError;

// ── Connection state ──────────────────────────────────────────────────────────

export type WsConnectionState = 'connecting' | 'open' | 'closed' | 'error';

const [connectionState, setConnectionState] = createSignal<WsConnectionState>('closed');
export { connectionState };

// ── Internal state ────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let refCount = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let consecutiveFailures = 0;
let connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

const MAX_BACKOFF_MS = 30_000;
const WS_FAILURE_THRESHOLD = 3;
const WS_CONNECT_TIMEOUT_MS = 8_000;

/** Resource subscription callbacks. Multiple listeners per resource. */
const resourceListeners = new Map<string, Set<(data: unknown) => void>>();

/** Active resource subscriptions (for re-subscribe on reconnect). */
const activeSubscriptions = new Set<string>();

/** Pending command promises keyed by commandId. */
const pendingCommands = new Map<string, {
  resolve: (result: FlintWsCommandResult) => void;
  reject: (error: Error) => void;
}>();

/** Callbacks for command lifecycle events. */
const commandProgressCallbacks = new Map<string, (status: 'queued' | 'processing') => void>();

/** Pending query promises keyed by queryId. */
const pendingQueries = new Map<string, {
  resolve: (data: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

// ── URL construction ──────────────────────────────────────────────────────────

function getWsUrl(): string {
  const env = (import.meta as { env?: Record<string, string> }).env ?? {};
  const configuredWsBase = env['VITE_WS_URL']?.trim();
  const proxyTarget = env['VITE_PROXY_TARGET']?.trim();
  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const base = configuredWsBase
    || (isLocalHost && proxyTarget ? proxyTarget : '')
    || API_BASE_URL
    || window.location.origin;
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  let origin = window.location.origin;
  try {
    origin = new URL(base, window.location.origin).origin;
  } catch {
    origin = window.location.origin;
  }
  const wsUrl = new URL('/ws/flint', origin);
  wsUrl.protocol = protocol;
  try {
    const token = localStorage.getItem('twm-jwt');
    if (token) wsUrl.searchParams.set('token', token);
  } catch { /* localStorage unavailable */ }
  return wsUrl.toString();
}

// ── Connection management ─────────────────────────────────────────────────────

function connect(): void {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return;

  setConnectionState('connecting');

  try {
    ws = new WebSocket(getWsUrl());
  } catch {
    setConnectionState('error');
    consecutiveFailures++;
    scheduleReconnect();
    return;
  }

  let opened = false;
  let sawError = false;
  connectTimeoutTimer = setTimeout(() => {
    // Some tunnels/proxies can leave WS in CONNECTING forever. Force-fail so
    // reconnect/fallback logic can progress instead of keeping tiles loading.
    if (ws && ws.readyState === WebSocket.CONNECTING) {
      consecutiveFailures++;
      setConnectionState('error');
      ws.close();
    }
  }, WS_CONNECT_TIMEOUT_MS);

  ws.onopen = () => {
    opened = true;
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer);
      connectTimeoutTimer = null;
    }
    setConnectionState('open');
    reconnectAttempt = 0;
    consecutiveFailures = 0;

    // Re-subscribe to all active resources
    for (const resource of activeSubscriptions) {
      sendRaw({ type: 'subscribe', resource });
    }
  };

  ws.onmessage = (event: MessageEvent) => {
    try {
      const msg = JSON.parse(event.data as string) as FlintWsOutbound;
      handleMessage(msg);
    } catch { /* malformed JSON */ }
  };

  ws.onclose = () => {
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer);
      connectTimeoutTimer = null;
    }
    // Count failed handshakes even when browsers don't emit onerror.
    if (!opened && !sawError) consecutiveFailures++;
    ws = null;
    setConnectionState('closed');
    if (refCount > 0) scheduleReconnect();
  };

  ws.onerror = () => {
    sawError = true;
    if (connectTimeoutTimer) {
      clearTimeout(connectTimeoutTimer);
      connectTimeoutTimer = null;
    }
    consecutiveFailures++;
    setConnectionState('error');
    // WebSocket will fire onclose after onerror, which triggers reconnect
  };
}

function disconnect(): void {
  if (connectTimeoutTimer) {
    clearTimeout(connectTimeoutTimer);
    connectTimeoutTimer = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.onclose = null; // Prevent reconnect on intentional close
    ws.close();
    ws = null;
  }

  // Drain all pending promises to avoid leaked timers and orphaned callbacks.
  // Resolve (not reject) to prevent unhandled-rejection noise when callers
  // used `void` fire-and-forget pattern. Consumers get clean failure status.
  for (const entry of pendingQueries.values()) {
    clearTimeout(entry.timer);
    entry.resolve(null);
  }
  pendingQueries.clear();

  for (const entry of pendingCommands.values()) {
    entry.resolve({ type: 'command-result', commandId: '', status: 'failed', error: 'WebSocket disconnected' } as FlintWsCommandResult);
  }
  pendingCommands.clear();
  commandProgressCallbacks.clear();

  for (const entry of pendingAckQueue) {
    clearTimeout(entry.timer);
    entry.resolve({ commandId: '', status: 'failed', error: 'WebSocket disconnected' });
  }
  pendingAckQueue.length = 0;

  setConnectionState('closed');
  reconnectAttempt = 0;
  consecutiveFailures = 0;
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectAttempt++;
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempt - 1), MAX_BACKOFF_MS);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (refCount > 0) connect();
  }, delay);
}

// ── Message handling ──────────────────────────────────────────────────────────

function handleMessage(msg: FlintWsOutbound): void {
  switch (msg.type) {
    case 'data': {
      const listeners = resourceListeners.get(msg.resource);
      if (listeners) {
        for (const cb of listeners) cb(msg.data);
      }
      break;
    }

    case 'command-ack': {
      // FIFO: the oldest pending-ack entry corresponds to this ack
      const entry = pendingAckQueue[0];
      if (entry) {
        const commandId = msg.commandId;
        entry.onProgress?.('queued');
        // Register for progress and result tracking
        commandProgressCallbacks.set(commandId, entry.onProgress ?? (() => {}));
        pendingCommands.set(commandId, {
          resolve: (r) => {
            clearTimeout(entry.timer);
            entry.resolve({ commandId: r.commandId, status: r.status, data: r.data, error: r.error });
          },
          reject: entry.reject,
        });
        pendingAckQueue.shift();
      }
      break;
    }

    case 'command-progress': {
      const progressCb = commandProgressCallbacks.get(msg.commandId);
      if (progressCb) progressCb('processing');
      break;
    }

    case 'command-result': {
      const pending = pendingCommands.get(msg.commandId);
      if (pending) {
        pendingCommands.delete(msg.commandId);
        commandProgressCallbacks.delete(msg.commandId);
        pending.resolve(msg);
      }
      break;
    }

    case 'query-result': {
      const pending = pendingQueries.get(msg.queryId);
      if (pending) {
        pendingQueries.delete(msg.queryId);
        clearTimeout(pending.timer);
        pending.resolve(msg.data);
      }
      break;
    }

    case 'connected':
    case 'error':
      break;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

function sendRaw(msg: FlintWsInbound): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Acquire a reference to the WS connection. Connects if this is the first ref.
 * Returns a release function to call on cleanup.
 */
export function acquireFlintWs(): () => void {
  refCount++;
  if (refCount === 1) connect();
  return () => {
    refCount--;
    if (refCount <= 0) {
      refCount = 0;
      disconnect();
      activeSubscriptions.clear();
      resourceListeners.clear();
    }
  };
}

/**
 * Subscribe to a FLINT resource. Sends subscribe message to server and
 * registers the callback for data updates. Returns an unsubscribe function.
 */
export function subscribeResource(resource: string, callback: (data: unknown) => void): () => void {
  // Register callback
  if (!resourceListeners.has(resource)) resourceListeners.set(resource, new Set());
  resourceListeners.get(resource)!.add(callback);

  // Track for reconnect
  activeSubscriptions.add(resource);

  // Send subscribe to server
  sendRaw({ type: 'subscribe', resource });

  return () => {
    const listeners = resourceListeners.get(resource);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        resourceListeners.delete(resource);
        activeSubscriptions.delete(resource);
        sendRaw({ type: 'unsubscribe', resource });
      }
    }
  };
}

/** Command result type for consumers. */
export interface CommandResult {
  commandId: string;
  status: 'completed' | 'failed';
  data?: unknown;
  error?: string;
}

/**
 * FIFO queue for correlating sent commands with their server-generated commandIds.
 * WS guarantees message order: send A, send B → ack-A, ack-B.
 */
const pendingAckQueue: Array<{
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  onProgress?: (status: 'queued' | 'processing') => void;
  timer: ReturnType<typeof setTimeout>;
}> = [];

/**
 * Send a command (mutation) via WS. Returns a promise that resolves when
 * the server sends back `command-result` for this command.
 *
 * @param action   - One of the 17 ACTION_ROUTES keys (e.g. 'update-order-status')
 * @param resource - The resource this command affects (for routing)
 * @param id       - Optional entity ID
 * @param payload  - Optional request body
 * @param onProgress - Optional callback for ack/progress updates
 */
export function sendWsCommand(
  action: string,
  resource: string,
  id?: string,
  payload?: unknown,
  onProgress?: (status: 'queued' | 'processing') => void,
): Promise<CommandResult> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('WebSocket not connected'));
  }

  const perfLabel = import.meta.env.DEV ? `[ws] command ${action} → ${resource}` : '';
  // eslint-disable-next-line no-console
  if (import.meta.env.DEV) console.time(perfLabel);

  return new Promise<CommandResult>((resolve, reject) => {
    // Timeout after 30s
    const timer = setTimeout(() => {
      const idx = pendingAckQueue.findIndex(e => e.resolve === resolve);
      if (idx !== -1) pendingAckQueue.splice(idx, 1);
      // eslint-disable-next-line no-console
      if (import.meta.env.DEV) console.timeEnd(perfLabel);
      reject(new Error('Command timeout: no result received'));
    }, 30_000);

    pendingAckQueue.push({
      resolve: (result) => {
        // eslint-disable-next-line no-console
        if (import.meta.env.DEV) console.timeEnd(perfLabel);
        resolve(result);
      },
      reject,
      onProgress,
      timer,
    });
    sendRaw({ type: 'command', action, resource, id, payload });
  });
}

/**
 * Send a one-shot query via WS. Returns cached/projected data from the server
 * without triggering upstream fetches. Returns null if nothing is cached.
 *
 * @param resource - Resource to query (e.g. 'flint-order-detail')
 * @param params   - Query params (e.g. { id: orderId })
 * @param timeoutMs - Response timeout in ms (default 5000)
 */
export function queryResource<T = unknown>(
  resource: string,
  params?: Record<string, unknown>,
  timeoutMs = 5000,
): Promise<T | null> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('WebSocket not connected'));
  }

  const queryId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return new Promise<T | null>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingQueries.delete(queryId);
      reject(new Error('Query timeout: no result received'));
    }, timeoutMs);

    pendingQueries.set(queryId, {
      resolve: (data) => resolve(data as T | null),
      reject,
      timer,
    });

    sendRaw({ type: 'query', queryId, resource, params });
  });
}

/**
 * Whether the WS connection has exceeded the failure threshold,
 * indicating SSE fallback should be used.
 */
export function shouldFallbackToSse(): boolean {
  return consecutiveFailures >= WS_FAILURE_THRESHOLD;
}

/**
 * Get the current consecutive failure count (for testing).
 */
export function getConsecutiveFailures(): number {
  return consecutiveFailures;
}

// ── Test helpers ──────────────────────────────────────────────────────────────

export const __testing = {
  resourceListeners,
  activeSubscriptions,
  pendingCommands,
  pendingAckQueue,
  commandProgressCallbacks,
  pendingQueries,
  handleMessage,
  getWsUrl,
  reset() {
    // Silent cleanup for tests: clear timers without rejecting promises
    // to avoid unhandled rejection noise in test output
    for (const entry of pendingQueries.values()) clearTimeout(entry.timer);
    for (const entry of pendingAckQueue) clearTimeout(entry.timer);

    // Disconnect without draining (prevents unhandled rejections in tests)
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.onclose = null; ws.close(); ws = null; }
    setConnectionState('closed');

    refCount = 0;
    reconnectAttempt = 0;
    consecutiveFailures = 0;
    resourceListeners.clear();
    activeSubscriptions.clear();
    pendingCommands.clear();
    pendingAckQueue.length = 0;
    commandProgressCallbacks.clear();
    pendingQueries.clear();
  },
} as const;
