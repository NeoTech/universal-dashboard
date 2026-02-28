import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { PostsTile } from './PostsTile';
import { HotPostsTile } from './HotPostsTile';
import { KeywordMonitorTile } from './KeywordMonitorTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const REDDIT_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'reddit-posts':           (t) => <PostsTile refreshInterval={t.refreshInterval} />,
  'reddit-hot-posts':      (t) => <HotPostsTile refreshInterval={t.refreshInterval} />,
  'reddit-keyword-monitor':(t) => <KeywordMonitorTile keywords={t.keywords} refreshInterval={t.refreshInterval} />,
};

export { PostsTile, HotPostsTile, KeywordMonitorTile };
