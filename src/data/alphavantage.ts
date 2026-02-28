import { fetchResource } from './api';

export interface AlphaVantageQuote {
  symbol: string;
  open: string;
  high: string;
  low: string;
  price: string;
  volume: string;
  latestTradingDay: string;
  previousClose: string;
  change: string;
  changePercent: string;
}

export interface AlphaVantageTimeSeriesEntry {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AlphaVantageStockData {
  symbol: string;
  quote: AlphaVantageQuote;
  timeSeries: AlphaVantageTimeSeriesEntry[];
}

export function fetchAlphaVantageQuotes(): Promise<{ stocks: AlphaVantageStockData[]; rateLimit?: boolean }> {
  return fetchResource<{ stocks: AlphaVantageStockData[]; rateLimit?: boolean }>('/api/alphavantage/quotes');
}
