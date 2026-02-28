import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { BreachesTile } from './BreachesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const HIBP_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'hibp-email-breaches': (t) => <BreachesTile refreshInterval={t.refreshInterval} />,
};

export { BreachesTile };
