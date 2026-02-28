import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { TopStoriesTile } from './TopStoriesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const HACKERNEWS_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'hn-top-stories': (t) => <TopStoriesTile refreshInterval={t.refreshInterval} />,
};

export { TopStoriesTile };
