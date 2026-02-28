import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { SummaryTile } from './SummaryTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const WAKATIME_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'wakatime-summary': (t) => <SummaryTile refreshInterval={t.refreshInterval} />,
};

export { SummaryTile };
