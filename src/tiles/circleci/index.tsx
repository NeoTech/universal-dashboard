import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PipelinesTile } from './PipelinesTile';
import { InsightsTile } from './InsightsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const CIRCLECI_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'circleci-pipelines': (t) => <PipelinesTile refreshInterval={t.refreshInterval} />,
  'circleci-insights':  (t) => <InsightsTile  refreshInterval={t.refreshInterval} />,
};

export { PipelinesTile, InsightsTile };
