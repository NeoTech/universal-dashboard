import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { RepositoriesTile } from './RepositoriesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const DOCKERHUB_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'dockerhub-repositories': (t) => <RepositoriesTile refreshInterval={t.refreshInterval} />,
  'dockerhub-tags': (t) => <RepositoriesTile refreshInterval={t.refreshInterval} />,
};

export { RepositoriesTile };
