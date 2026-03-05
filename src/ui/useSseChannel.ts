/**
 * useSseChannel — subscribe to a named event on the shared /api/sse stream.
 *
 * A single EventSource is shared across all tile instances (module-level
 * singleton). When all consumers have cleaned up, the connection is closed.
 * The browser auto-reconnects EventSource on network interruptions.
 *
 * Resilience design:
 * - A module-level channelListeners registry ensures listeners are always
 *   re-attached to a new EventSource when the old one is replaced, so stale
 *   closure references never silently drop events.
 * - A reconnectCallbacks set notifies every active useSseChannel hook when the
 *   EventSource (re)opens, resetting loading → true so tiles show a skeleton
 *   while the server replays cached data rather than appearing permanently black.
 * - The server sends a ': keepalive' comment every 25 s to prevent proxies and
 *   NAT gateways from dropping the idle TCP connection.
 */
import { createSignal, onMount, onCleanup } from 'solid-js';
import type { Accessor } from 'solid-js';
import { API_BASE_URL } from '../data/api';

const SSE_BASE = `${API_BASE_URL}/api/sse`;

function getSseUrl(): string {
  // EventSource cannot set headers; pass JWT as a query param when present.
  try {
    const token = localStorage.getItem('twm-jwt');
    return token ? `${SSE_BASE}?token=${encodeURIComponent(token)}` : SSE_BASE;
  } catch {
    return SSE_BASE;
  }
}

let sharedEs: EventSource | null = null;
let refCount = 0;

/**
 * Module-level map tracking when each SSE channel last delivered a message.
 * Keyed by event name (SSE channel). Values are epoch ms timestamps.
 * Read by TileGrid to render "Updated X ago" in tile footers.
 */
export const sseReceivedAt = new Map<string, number>();

/**
 * Reactive revision counter — increments on every SSE message.
 * Import this in components that need to react immediately when any
 * SSE channel receives data (e.g. tile footers showing "Updated X ago").
 */
export const [sseRevision, setSseRevision] = createSignal(0);

/**
 * Reactive map of SSE channel names → required env var names that are missing.
 * Populated by the server's `env-status` event broadcast at startup.
 * Used by BaseTile to show a friendly configuration banner when a tile's
 * data source has no credentials configured.
 */
export const [sseEnvStatus, setSseEnvStatus] = createSignal<Record<string, string[]>>({});

// ── Module-level listener registry ───────────────────────────────────────────
// Maps event name → Set of message handlers. When acquireEs() creates a new
// EventSource (replacing a dead one), it re-attaches every registered handler
// so tile components that survived the replacement continue receiving events.
const channelListeners = new Map<string, Set<(e: MessageEvent<string>) => void>>();

/**
 * Set of callbacks invoked whenever the shared `EventSource` (re)opens.
 *
 * Each active {@link useSseChannel} hook registers one callback that resets
 * its `loading` signal to `true`.  This causes tiles to display a skeleton
 * while the server replays the cached resource payload, preventing a
 * permanently blank tile after a network interruption.
 *
 * Callbacks are added in `onMount` and removed in `onCleanup`, so the set
 * only holds references to currently-mounted tile components.
 */
const reconnectCallbacks = new Set<() => void>();

function envStatusHandler(e: MessageEvent<string>): void {
  try {
    const parsed = JSON.parse(e.data) as Record<string, string[]>;
    setSseEnvStatus(parsed);
  } catch { /* malformed payload */ }
}

/**
 * Wire up a freshly created `EventSource` by attaching all necessary handlers.
 *
 * Three responsibilities:
 * 1. Attaches the `env-status` handler so configuration banners update on
 *    every reconnect without tile components needing to re-subscribe.
 * 2. Re-attaches every handler in the `channelListeners` registry.  This
 *    is the key step that keeps all mounted tiles receiving events when a
 *    previous `EventSource` was discarded (e.g. after `refCount` hit 0).
 * 3. Sets `es.onopen` so that every reconnect notifies all active
 *    {@link useSseChannel} hooks via `reconnectCallbacks`, resetting their
 *    `loading` state to `true`.
 *
 * @param es - The newly created `EventSource` instance to configure.
 */
function setupEs(es: EventSource): void {
  es.addEventListener('env-status', envStatusHandler);
  for (const [name, handlers] of channelListeners) {
    for (const fn of handlers) {
      es.addEventListener(name, fn as EventListener);
    }
  }
  // onopen fires on both initial connect and every auto-reconnect.
  // Resetting loading → true here makes tiles show a skeleton while
  // the server replays cached data, preventing a permanent black screen.
  es.onopen = () => {
    for (const cb of reconnectCallbacks) cb();
  };
}

/**
 * Increment the shared `EventSource` reference count and create a new
 * connection if none exists or the previous one has been closed.
 *
 * ### Singleton pattern
 * A single `EventSource` is shared by all mounted tile components.  The
 * first tile to mount triggers the initial TCP connection; subsequent tiles
 * simply increment `refCount` and reuse the open socket.
 *
 * ### Closed-source handling
 * If `sharedEs.readyState === EventSource.CLOSED` (e.g. the browser
 * explicitly closed the connection after `refCount` reached 0 and then a
 * new tile mounted), a fresh `EventSource` is created and {@link setupEs}
 * re-attaches all registered channel listeners so no events are lost.
 *
 * Must be paired with a corresponding call to `releaseEs()` in `onCleanup`.
 */
function acquireEs(): void {
  refCount++;
  if (!sharedEs || sharedEs.readyState === EventSource.CLOSED) {
    sharedEs = new EventSource(getSseUrl());
    setupEs(sharedEs);
  }
}

function releaseEs(): void {
  refCount--;
  if (refCount <= 0) {
    sharedEs?.removeEventListener('env-status', envStatusHandler);
    sharedEs?.close();
    sharedEs = null;
    refCount = 0;
  }
}

/** Register a message handler for a named SSE event.
 *  The handler is recorded in the module-level registry so it survives
 *  an EventSource replacement (e.g. after refCount hit 0 and a new tile mounts). */
function addChannelListener(
  eventName: string,
  fn: (e: MessageEvent<string>) => void,
): void {
  if (!channelListeners.has(eventName)) channelListeners.set(eventName, new Set());
  channelListeners.get(eventName)!.add(fn);
  sharedEs?.addEventListener(eventName, fn as EventListener);
}

/** Unregister a message handler. Removes from both the registry and the live ES. */
function removeChannelListener(
  eventName: string,
  fn: (e: MessageEvent<string>) => void,
): void {
  channelListeners.get(eventName)?.delete(fn);
  sharedEs?.removeEventListener(eventName, fn as EventListener);
}

/**
 * SolidJS hook — subscribe to a named SSE event and return reactive signals
 * for the latest data, loading state, and error message.
 *
 * ### Parameters
 * @param eventName - The SSE event name (channel) to listen to, matching the
 *   string passed to `res.write(`event: ${name}\\n`)` on the server.
 * @param initial   - Initial value for the `data` signal before the first
 *   message arrives.  Pass an empty array `[]` for list resources.
 *
 * ### Return shape
 * | Signal    | Type                  | Description |
 * |-----------|-----------------------|-------------|
 * | `data`    | `Accessor<T>`         | Latest parsed payload from the server. |
 * | `loading` | `Accessor<boolean>`   | `true` until the first successful message (or after a reconnect). |
 * | `error`   | `Accessor<string\|null>` | Non-null when the server sends `{ error: string }`. |
 *
 * ### Lifecycle
 * - **Mount** — calls `acquireEs()` (opens or reuses the shared `EventSource`)
 *   and registers `onMessage` + `onReconnect` callbacks.
 * - **Data** — each SSE message JSON-parses `e.data`; on success it updates
 *   `data`, stampts `sseReceivedAt`, increments `sseRevision`, and clears
 *   `loading`/`error`.
 * - **Reconnect** — `onReconnect` resets `loading → true` so the tile shows
 *   a skeleton while the server replays cached data via the new connection.
 * - **Unmount** — `onCleanup` removes the listeners and calls `releaseEs()`;
 *   when `refCount` reaches 0 the `EventSource` is closed.
 *
 * @example
 * ```tsx
 * const { data, loading, error } = useSseChannel<MyPayload[]>('my-channel', []);
 * return <Show when={!loading()} fallback={<Skeleton />}>{data()}</Show>;
 * ```
 */
export function useSseChannel<T>(
  eventName: string,
  initial: T,
): {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
} {
  // FLINT channels now use the WS transport (useFlintResource). If a FLINT
  // channel name is passed here it's likely a stale import that wasn't migrated.
  if (import.meta.env.DEV && eventName.startsWith('flint-')) {
    console.warn(
      `[useSseChannel] FLINT channel "${eventName}" should use useFlintResource (WS), not SSE. ` +
      'This subscription will still work but is deprecated.',
    );
  }

  const [data, setData] = createSignal<T>(initial);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    acquireEs();

    const onMessage = (e: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(e.data) as T | { error: string };
        if (parsed && typeof parsed === 'object' && 'error' in (parsed as object)) {
          setError((parsed as { error: string }).error);
        } else {
          // Use functional form so arrays are not interpreted as SolidJS updaters
          setData(() => parsed as T);
          sseReceivedAt.set(eventName, Date.now());
          setSseRevision(r => r + 1);
          setError(null);
          setLoading(false);
        }
      } catch { /* malformed payload */ }
    };

    // Reset loading → true on every (re)connect so the tile shows a skeleton
    // while the server replays cached data. The next onMessage will clear it.
    const onReconnect = () => { setLoading(true); setError(null); };

    addChannelListener(eventName, onMessage);
    reconnectCallbacks.add(onReconnect);

    onCleanup(() => {
      removeChannelListener(eventName, onMessage);
      reconnectCallbacks.delete(onReconnect);
      releaseEs();
    });
  });

  return { data, loading, error };
}

