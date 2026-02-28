import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PostsTile } from './PostsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const REDDIT_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'reddit-posts': (t) => <PostsTile refreshInterval={t.refreshInterval} />,
};

export { PostsTile };
