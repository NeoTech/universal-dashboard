import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PipelinesTile } from './PipelinesTile';
import { ReleasesTile } from './ReleasesTile';
import { WorkItemsTile } from './WorkItemsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const AZUREDEVOPS_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'azuredevops-pipelines': (t) => <PipelinesTile refreshInterval={t.refreshInterval} />,
  'azuredevops-releases': (t) => <ReleasesTile refreshInterval={t.refreshInterval} />,
  'azuredevops-workitems': (t) => <WorkItemsTile refreshInterval={t.refreshInterval} />,
};

export { PipelinesTile, ReleasesTile, WorkItemsTile };
