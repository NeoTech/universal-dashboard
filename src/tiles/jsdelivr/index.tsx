import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { StatsTile } from './StatsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const JSDELIVR_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'jsdelivr-hits': (t) => <StatsTile refreshInterval={t.refreshInterval} />,
};

export { StatsTile };
