import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { IssuesTile } from './IssuesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const JIRA_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'jira-issues': (t) => <IssuesTile refreshInterval={t.refreshInterval} />,
};

export { IssuesTile };
