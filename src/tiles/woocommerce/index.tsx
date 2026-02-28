import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { OrdersTile } from './OrdersTile';
import { SalesSummaryTile } from './SalesSummaryTile';
import { TopSellersTile } from './TopSellersTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const WOOCOMMERCE_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'woocommerce-orders':         (t) => <OrdersTile refreshInterval={t.refreshInterval} />,
  'woocommerce-sales-summary':  (t) => <SalesSummaryTile refreshInterval={t.refreshInterval} />,
  'woocommerce-top-sellers':    (t) => <TopSellersTile refreshInterval={t.refreshInterval} />,
};

export { OrdersTile, SalesSummaryTile, TopSellersTile };
