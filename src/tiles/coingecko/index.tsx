import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { MarketsTile } from './MarketsTile';
import { PricesTile } from './PricesTile';
import { GlobalTile } from './GlobalTile';
import { TrendingCoinsTile } from './TrendingCoinsTile';
import { PriceChartTile } from './PriceChartTile';
import { DefiOverviewTile } from './DefiOverviewTile';
import { CoinCategoriesTile } from './CoinCategoriesTile';
import { CryptoExchangesTile } from './CryptoExchangesTile';
import { CoinDetailTile } from './CoinDetailTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const COINGECKO_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'coingecko-markets': (t) => <MarketsTile refreshInterval={t.refreshInterval} />,
  'coingecko-prices': (t) => <PricesTile refreshInterval={t.refreshInterval} />,
  'coingecko-global': (t) => <GlobalTile refreshInterval={t.refreshInterval} />,
  'coingecko-trending': (t) => <TrendingCoinsTile refreshInterval={t.refreshInterval} />,
  'coingecko-price-chart': (t) => <PriceChartTile refreshInterval={t.refreshInterval} />,
  'coingecko-defi-overview': (t) => <DefiOverviewTile refreshInterval={t.refreshInterval} />,
  'coingecko-categories': (t) => <CoinCategoriesTile refreshInterval={t.refreshInterval} />,
  'coingecko-exchanges': (t) => <CryptoExchangesTile refreshInterval={t.refreshInterval} />,
  'coingecko-coin-detail': (t) => <CoinDetailTile refreshInterval={t.refreshInterval} />,
};

export { MarketsTile, PricesTile, GlobalTile, TrendingCoinsTile, PriceChartTile, DefiOverviewTile, CoinCategoriesTile, CryptoExchangesTile, CoinDetailTile };
