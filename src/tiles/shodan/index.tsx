import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { SearchTile } from './SearchTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const SHODAN_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'shodan-exposed-assets': (t) => <SearchTile refreshInterval={t.refreshInterval} />,
};

export { SearchTile };
