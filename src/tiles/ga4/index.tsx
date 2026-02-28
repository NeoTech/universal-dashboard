import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { SessionsTile } from './SessionsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const GA4_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'ga4-sessions-trend': (t) => <SessionsTile refreshInterval={t.refreshInterval} />,
};

export { SessionsTile };
