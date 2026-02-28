import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { OverviewTile } from './OverviewTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const INSTATUS_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'instatus-overview': (t) => <OverviewTile refreshInterval={t.refreshInterval} />,
};

export { OverviewTile };
