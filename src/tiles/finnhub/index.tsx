import type { JSX } from 'solid-js';
import type { TileConfig, TileType } from '../TileConfig';
import { QuotesTile } from './QuotesTile';
import { NewsTile } from './NewsTile';
import { CompanyNewsTile } from './CompanyNewsTile';
import { MarketNewsTile } from './MarketNewsTile';
import { FinnhubEarningsCalendarTile } from './FinnhubEarningsCalendarTile';
import { EarningsSurprisesTile } from './EarningsSurprisesTile';
import { AnalystConsensusTile } from './AnalystConsensusTile';
import { FinnhubFundamentalsTile } from './FinnhubFundamentalsTile';
import { FinnhubMarketStatusTile } from './FinnhubMarketStatusTile';
import { InsiderTxTile } from './InsiderTxTile';
import { InsiderSentimentTile } from './InsiderSentimentTile';
import { IpoCalendarTile } from './IpoCalendarTile';
import { SecFilingsTile } from './SecFilingsTile';
import { CompanyProfileTile } from './CompanyProfileTile';

export type TileFactory = (tile: TileConfig) => JSX.Element;

export const FINNHUB_TILE_FACTORIES: Partial<Record<TileType, TileFactory>> = {
  'finnhub-quotes': (t) => <QuotesTile refreshInterval={t.refreshInterval} />,
  'finnhub-news': (t) => <NewsTile refreshInterval={t.refreshInterval} />,
  'finnhub-company-news': (t) => <CompanyNewsTile refreshInterval={t.refreshInterval} />,
  'finnhub-market-news': (t) => <MarketNewsTile refreshInterval={t.refreshInterval} />,
  'finnhub-earnings-calendar': (t) => <FinnhubEarningsCalendarTile refreshInterval={t.refreshInterval} />,
  'finnhub-earnings-surprises': (t) => <EarningsSurprisesTile refreshInterval={t.refreshInterval} />,
  'finnhub-analyst-consensus': (t) => <AnalystConsensusTile refreshInterval={t.refreshInterval} />,
  'finnhub-fundamentals': (t) => <FinnhubFundamentalsTile refreshInterval={t.refreshInterval} />,
  'finnhub-market-status': (t) => <FinnhubMarketStatusTile refreshInterval={t.refreshInterval} />,
  'finnhub-insider-transactions': (t) => <InsiderTxTile refreshInterval={t.refreshInterval} />,
  'finnhub-insider-sentiment': (t) => <InsiderSentimentTile refreshInterval={t.refreshInterval} />,
  'finnhub-ipo-calendar': (t) => <IpoCalendarTile refreshInterval={t.refreshInterval} />,
  'finnhub-sec-filings': (t) => <SecFilingsTile refreshInterval={t.refreshInterval} />,
  'finnhub-company-profile': (t) => <CompanyProfileTile refreshInterval={t.refreshInterval} />,
};

export { QuotesTile, NewsTile, CompanyNewsTile, MarketNewsTile, FinnhubEarningsCalendarTile, EarningsSurprisesTile, AnalystConsensusTile, FinnhubFundamentalsTile, FinnhubMarketStatusTile, InsiderTxTile, InsiderSentimentTile, IpoCalendarTile, SecFilingsTile, CompanyProfileTile };
