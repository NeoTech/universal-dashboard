import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { MessagesTile } from './MessagesTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const SLACK_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'slack-messages': (t) => <MessagesTile refreshInterval={t.refreshInterval} />,
};

export { MessagesTile };
