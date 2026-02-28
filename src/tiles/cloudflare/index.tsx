import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PagesTile } from './PagesTile';
import { FunctionsTile } from './FunctionsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const CF_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'cloudflare-pages':     (t) => <PagesTile refreshInterval={t.refreshInterval} />,
  'cloudflare-functions': (t) => <FunctionsTile refreshInterval={t.refreshInterval} />,
};

export { PagesTile, FunctionsTile };
