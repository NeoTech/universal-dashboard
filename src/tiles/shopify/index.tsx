import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { OrdersTile } from './OrdersTile';
import { ProductsTile } from './ProductsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const SHOPIFY_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'shopify-orders':   (t) => <OrdersTile refreshInterval={t.refreshInterval} />,
  'shopify-products': (t) => <ProductsTile refreshInterval={t.refreshInterval} />,
};

export { OrdersTile, ProductsTile };
