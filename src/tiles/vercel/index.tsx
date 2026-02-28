import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { DeploymentsTile } from './DeploymentsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const VERCEL_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'vercel-deployments': (t) => <DeploymentsTile refreshInterval={t.refreshInterval} />,
};

export { DeploymentsTile };
