/**
 * useSseChannel — subscribe to a named event on the shared /api/sse stream.
 *
 * A single EventSource is shared across all tile instances (module-level
 * singleton). When all consumers have cleaned up, the connection is closed.
 * The browser auto-reconnects EventSource on network interruptions.
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

function envStatusHandler(e: MessageEvent<string>): void {
  try {
    const parsed = JSON.parse(e.data) as Record<string, string[]>;
    setSseEnvStatus(parsed);
  } catch { /* malformed payload */ }
}

function acquireEs(): EventSource {
  refCount++;
  if (!sharedEs || sharedEs.readyState === EventSource.CLOSED) {
    sharedEs = new EventSource(getSseUrl());
    sharedEs.addEventListener('env-status', envStatusHandler);
  }
  return sharedEs;
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

export function useSseChannel<T>(
  eventName: string,
  initial: T,
): {
  data: Accessor<T>;
  loading: Accessor<boolean>;
  error: Accessor<string | null>;
} {
  const [data, setData] = createSignal<T>(initial);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  onMount(() => {
    const es = acquireEs();

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

    es.addEventListener(eventName, onMessage);

    onCleanup(() => {
      es.removeEventListener(eventName, onMessage);
      releaseEs();
    });
  });

  return { data, loading, error };
}
