import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { DeploymentsTile } from './DeploymentsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const NETLIFY_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'netlify-deployments': (t) => <DeploymentsTile refreshInterval={t.refreshInterval} />,
};

export { DeploymentsTile };
