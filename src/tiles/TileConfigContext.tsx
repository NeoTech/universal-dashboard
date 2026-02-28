/**
 * TileConfigContext
 *
 * Provides the current TileConfig to any descendant component — including the
 * shared `usePagination` hook — without any per-tile prop drilling.
 *
 * Wrapped in `renderTile` so every mounted tile automatically has access to
 * its own config (pageSize, fetchLimit, etc.).
 */
import { createContext, useContext } from 'solid-js';
import type { TileConfig } from './TileConfig';

const TileConfigContext = createContext<TileConfig | undefined>(undefined);

export const TileConfigProvider = TileConfigContext.Provider;

/** Read the TileConfig for the currently-rendering tile. May be undefined outside tiles. */
export function useTileConfig(): TileConfig | undefined {
  return useContext(TileConfigContext);
}
