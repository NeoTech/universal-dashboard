import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { QuotesTile } from './QuotesTile';
import { SparklinesTile } from './SparklinesTile';
import { MarketStatusTile } from './MarketStatusTile';
import { MarketMoversTile } from './MarketMoversTile';
import { NewsSentimentTile } from './NewsSentimentTile';
import { EarningsTile } from './EarningsTile';
import { EarningsCalendarTile } from './EarningsCalendarTile';
import { FundamentalsTile } from './FundamentalsTile';
import { ForexRatesTile } from './ForexRatesTile';
import { CommoditiesTile } from './CommoditiesTile';
import { EconomicIndicatorsTile } from './EconomicIndicatorsTile';
import { InsiderTransactionsTile } from './InsiderTransactionsTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const ALPHAVANTAGE_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'alphavantage-quotes': (t) => <QuotesTile refreshInterval={t.refreshInterval} />,
  'alphavantage-sparklines': (t) => <SparklinesTile refreshInterval={t.refreshInterval} />,
  'alphavantage-market-status': (t) => <MarketStatusTile refreshInterval={t.refreshInterval} />,
  'alphavantage-market-movers': (t) => <MarketMoversTile refreshInterval={t.refreshInterval} />,
  'alphavantage-news-sentiment': (t) => <NewsSentimentTile refreshInterval={t.refreshInterval} />,
  'alphavantage-earnings': (t) => <EarningsTile refreshInterval={t.refreshInterval} />,
  'alphavantage-earnings-calendar': (t) => <EarningsCalendarTile refreshInterval={t.refreshInterval} />,
  'alphavantage-fundamentals': (t) => <FundamentalsTile refreshInterval={t.refreshInterval} />,
  'alphavantage-forex-rates': (t) => <ForexRatesTile refreshInterval={t.refreshInterval} />,
  'alphavantage-commodities': (t) => <CommoditiesTile refreshInterval={t.refreshInterval} />,
  'alphavantage-economic-indicators': (t) => <EconomicIndicatorsTile refreshInterval={t.refreshInterval} />,
  'alphavantage-insider-transactions': (t) => <InsiderTransactionsTile refreshInterval={t.refreshInterval} />,
};

export { QuotesTile, SparklinesTile, MarketStatusTile, MarketMoversTile, NewsSentimentTile, EarningsTile, EarningsCalendarTile, FundamentalsTile, ForexRatesTile, CommoditiesTile, EconomicIndicatorsTile, InsiderTransactionsTile };
