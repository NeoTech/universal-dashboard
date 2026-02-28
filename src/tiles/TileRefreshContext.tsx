/**
 * TileRefreshContext
 *
 * Provides a reactive revision counter to self-polling tiles (rss-feed, rest,
 * websocket). The counter increments each time an external refresh is requested
 * (manual ↻ button or TileRefreshTimer ring completing a cycle).
 *
 * SSE-backed tiles ignore this context — they receive data passively.
 * Custom tiles use it like:
 *
 *   const refresh = useTileRefresh();
 *   createEffect(() => { refresh(); void fetchData(); });
 */
import { createContext, useContext } from 'solid-js';

const TileRefreshContext = createContext<() => number>(() => 0);

export const TileRefreshProvider = TileRefreshContext.Provider;

/** Returns a reactive accessor whose value increments on every external refresh. */
export function useTileRefresh(): () => number {
  return useContext(TileRefreshContext);
}
