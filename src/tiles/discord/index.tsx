import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { ServerStatsTile } from './ServerStatsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const DISCORD_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'discord-server-stats': (t) => <ServerStatsTile refreshInterval={t.refreshInterval} />,
};

export { ServerStatsTile };
