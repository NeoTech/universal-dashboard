/**
 * flintRealtimeStore — high-level reactive store for FLINT tiles.
 *
 * Provides:
 * - `useFlintResource<T>(resource, initial)` — drop-in replacement for `useSseChannel`
 *   with identical `{ data, loading, error }` return type. Internally uses WS with
 *   automatic SSE fallback after 3 consecutive WS failures.
 * - `sendCommand(action, id?, payload?)` — Promise-based mutation via WS command queue
 * - `transportMode` — reactive signal showing current transport ('ws' | 'sse')
 *
 * Tiles migrate by changing one import + one function call; no other changes needed
 * for read-only tiles. Mutation tiles replace fetch() calls with sendCommand().
 */
import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import {
  acquireFlintWs,
  subscribeResource,
  sendWsCommand,
  queryResource as wsQueryResource,
  connectionState,
  shouldFallbackToSse,
} from '../../ui/useFlintSocket';
import type { CommandResult } from '../../ui/useFlintSocket';
import { useSseChannel } from '../../ui/useSseChannel';

// ── Transport mode ────────────────────────────────────────────────────────────

export type TransportMode = 'ws' | 'sse';

const [transportMode, setTransportMode] = createSignal<TransportMode>('ws');
export { transportMode };

// Re-export for convenience
export { connectionState };
export type { CommandResult };

// ── ACTION_ROUTES resource map (mirrors api/ws/flint-hub.ts) ──────────────────

const ACTION_RESOURCE: Record<string, string> = {
  'update-order-status': 'flint-orders',
  'delete-order':        'flint-orders',
  'refund-order':        'flint-orders',
  'create-product':      'flint-products',
  'update-product':      'flint-products',
  'delete-product':      'flint-products',
  'create-variant':      'flint-products',
  'update-variant':      'flint-products',
  'create-category':     'flint-categories',
  'update-category':     'flint-categories',
  'delete-category':     'flint-categories',
  'update-customer':     'flint-customers',
  'create-shipment':     'flint-shipments',
  'update-shipment':     'flint-shipments',
  'sync-stripe':         'flint-orders',
  'run-data-health':     'flint-data-health',
  'set-sales-range':     'flint-sales',
};

// ── useFlintResource ──────────────────────────────────────────────────────────

/**
 * Subscribe to a FLINT resource with WS transport (SSE fallback).
 *
 * Drop-in replacement for `useSseChannel<T>(channel, initial)`.
 * Returns `{ data, loading, error }` — identical interface.
 */
export function useFlintResource<T>(
  resource: string,
  initial: T,
): {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
} {
  const [data, setData] = createSignal<T>(initial);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  // SSE fallback: create lazily, used only if WS fails
  let sseFallback: ReturnType<typeof useSseChannel<T>> | null = null;
  let usingSse = false;

  onMount(() => {
    // Check if we should use SSE fallback immediately
    if (shouldFallbackToSse()) {
      activateSseFallback();
      return;
    }

    // Acquire WS connection (ref-counted)
    const releaseWs = acquireFlintWs();

    // Subscribe to resource data
    const unsubscribe = subscribeResource(resource, (rawData) => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log(`[ws] data received: ${resource} (${JSON.stringify(rawData).length} bytes)`);
      }
      setData(() => rawData as T);
      setLoading(false);
      setError(null);
    });

    // Watch connection state for SSE fallback
    // We check on an interval rather than a createEffect to avoid reactive tracking issues
    const fallbackCheck = setInterval(() => {
      if (!usingSse && shouldFallbackToSse()) {
        unsubscribe();
        releaseWs();
        activateSseFallback();
        clearInterval(fallbackCheck);
      }
    }, 2000);

    onCleanup(() => {
      clearInterval(fallbackCheck);
      if (!usingSse) {
        unsubscribe();
        releaseWs();
      }
    });
  });

  function activateSseFallback(): void {
    usingSse = true;
    setTransportMode('sse');
    sseFallback = useSseChannel<T>(resource, initial);
    // Wire SSE signals through to our signals via polling effect
    // Since we can't use createEffect inside a non-reactive context,
    // we use an interval to sync SSE -> our signals
    const syncInterval = setInterval(() => {
      if (sseFallback) {
        const d = sseFallback.data();
        const l = sseFallback.loading();
        const e = sseFallback.error();
        setData(() => d);
        setLoading(l);
        setError(e);
      }
    }, 100);

    onCleanup(() => {
      clearInterval(syncInterval);
    });
  }

  return { data, loading, error };
}

// ── sendCommand ───────────────────────────────────────────────────────────────

/**
 * Send a mutation command via the WS command queue.
 *
 * Replaces direct `fetch()` calls to `/api/flint/...` mutation endpoints.
 * The command is enqueued server-side, acknowledged optimistically, and
 * the promise resolves when the server confirms completion or failure.
 *
 * @param action  - ACTION_ROUTES key (e.g. 'update-order-status')
 * @param id      - Optional entity ID (e.g. order ID)
 * @param payload - Optional request body
 * @param onProgress - Optional callback for 'queued' | 'processing' updates
 * @returns Promise resolving to the command result
 */
export function sendCommand(
  action: string,
  id?: string,
  payload?: unknown,
  onProgress?: (status: 'queued' | 'processing') => void,
): Promise<CommandResult> {
  const resource = ACTION_RESOURCE[action] ?? 'flint-orders';
  return sendWsCommand(action, resource, id, payload, onProgress);
}

// ── queryResource ─────────────────────────────────────────────────────────────

/**
 * Query cached/projected data from the server via WS.
 * Zero upstream calls — returns whatever the server has cached, enriched
 * with product names and customer info from relational tables.
 *
 * @param resource  - Resource to query (e.g. 'flint-order-detail')
 * @param params    - Query params (e.g. { id: orderId })
 * @returns Promise resolving to the cached data, or null if nothing is cached
 */
export function queryResource<T = unknown>(
  resource: string,
  params?: Record<string, unknown>,
): Promise<T | null> {
  return wsQueryResource<T>(resource, params);
}
