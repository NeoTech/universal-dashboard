import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { TransactionsTile } from './TransactionsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const PAYPAL_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'paypal-transactions': (t) => <TransactionsTile refreshInterval={t.refreshInterval} />,
};

export { TransactionsTile };
