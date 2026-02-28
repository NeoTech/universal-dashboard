import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { IssuesTile } from './IssuesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const LINEAR_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'linear-issues': (t) => <IssuesTile refreshInterval={t.refreshInterval} />,
};

export { IssuesTile };
