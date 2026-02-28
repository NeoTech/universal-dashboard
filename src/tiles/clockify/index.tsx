import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { TimeEntriesTile } from './TimeEntriesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const CLOCKIFY_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'clockify-time-entries': (t) => <TimeEntriesTile refreshInterval={t.refreshInterval} />,
};

export { TimeEntriesTile };
