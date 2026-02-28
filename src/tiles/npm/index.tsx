import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { DownloadsTile } from './DownloadsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const NPM_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'npm-downloads': (t) => <DownloadsTile refreshInterval={t.refreshInterval} />,
};

export { DownloadsTile };
