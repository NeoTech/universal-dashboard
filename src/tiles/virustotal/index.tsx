import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { AnalysesTile } from './AnalysesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const VIRUSTOTAL_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'virustotal-domain-scan': (t) => <AnalysesTile refreshInterval={t.refreshInterval} />,
};

export { AnalysesTile };
