import { fetchResource } from './api';

export interface FinnhubQuote {
  c: number;  // current price
  d: number;  // change
  dp: number; // percent change
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
  symbol: string;
}

export interface FinnhubNewsItem {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export function fetchFinnhubQuotes(): Promise<{ quotes: FinnhubQuote[] }> {
  return fetchResource<{ quotes: FinnhubQuote[] }>('/api/finnhub/quotes');
}

export function fetchFinnhubNews(): Promise<{ news: FinnhubNewsItem[] }> {
  return fetchResource<{ news: FinnhubNewsItem[] }>('/api/finnhub/news');
}
