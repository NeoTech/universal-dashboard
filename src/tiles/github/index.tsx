import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { WorkflowRunsTile } from './WorkflowRunsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const GITHUB_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'github-actions': (t) => <WorkflowRunsTile refreshInterval={t.refreshInterval} />,
};

export { WorkflowRunsTile };
