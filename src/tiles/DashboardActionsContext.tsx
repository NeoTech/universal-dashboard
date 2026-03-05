import { createContext, useContext } from 'solid-js';
import type { TileConfig, TileType } from './TileConfig';

/**
 * Lightweight context that exposes dashboard-level actions to any tile rendered
 * inside the TileGrid.  Provided by DashboardPanel so tiles can programmatically
 * add or remove siblings without reaching into global state.
 */
export interface DashboardActions {
  addTile: (tile: TileConfig) => void;
  hasTileType: (type: TileType) => boolean;
}

const DashboardActionsContext = createContext<DashboardActions>();

export const DashboardActionsProvider = DashboardActionsContext.Provider;
export const useDashboardActions = (): DashboardActions | undefined => useContext(DashboardActionsContext);
