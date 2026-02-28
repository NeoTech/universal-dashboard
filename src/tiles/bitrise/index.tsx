import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { BuildsTile } from './BuildsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const BITRISE_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'bitrise-builds': (t) => <BuildsTile refreshInterval={t.refreshInterval} />,
};

export { BuildsTile };
