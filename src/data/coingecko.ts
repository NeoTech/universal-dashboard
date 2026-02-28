import { fetchResource } from './api';

export interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  last_updated: string;
  sparkline_in_7d?: { price: number[] };
}

export function fetchCoinGeckoMarkets(): Promise<{ coins: CoinGeckoCoin[] }> {
  return fetchResource<{ coins: CoinGeckoCoin[] }>('/api/coingecko/markets');
}
