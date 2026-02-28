import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { QualityTile } from './QualityTile';
import { MeasuresTile } from './MeasuresTile';
import { IssuesTile } from './IssuesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const SONARQUBE_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'sonarqube-quality': (t) => <QualityTile refreshInterval={t.refreshInterval} />,
  'sonarqube-measures': (t) => <MeasuresTile refreshInterval={t.refreshInterval} />,
  'sonarqube-issues': (t) => <IssuesTile refreshInterval={t.refreshInterval} />,
};

export { QualityTile, MeasuresTile, IssuesTile };
