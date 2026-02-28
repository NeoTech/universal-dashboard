import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { RssFeedTile } from './RssFeedTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const RSS_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'rss-feed': (t) => (
    <RssFeedTile
      url={t.rss?.url}
      maxItems={t.rss?.maxItems}
      refreshInterval={t.refreshInterval}
    />
  ),
};

export { RssFeedTile };
