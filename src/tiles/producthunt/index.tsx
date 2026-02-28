import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { LaunchesTile } from './LaunchesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const PRODUCTHUNT_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'producthunt-top-launches': (t) => <LaunchesTile refreshInterval={t.refreshInterval} />,
};

export { LaunchesTile };
