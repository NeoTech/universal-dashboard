import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── CoinGecko ─────────────────────────────────────────────────────────────────
let _cgCache: unknown = null;
let _cgCacheTime = 0;
let _cgGlobalCache: unknown = null;
let _cgGlobalCacheTime = 0;

async function dataCoinGeckoMarkets(): Promise<unknown> {
  const now = Date.now();
  if (_cgCache && now - _cgCacheTime < 300000) return _cgCache; // 5m cache
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin,ethereum,solana,cardano,polkadot';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).join(',');
  const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${coins}&order=market_cap_desc&per_page=20&page=1&sparkline=false`);
  if (r.status === 429) {
    if (_cgCache) return _cgCache; // fallback to stale cache
    throw new Error('CoinGecko rate limit reached');
  }
  const data = await r.json() as unknown[];
  const result = { coins: data };
  _cgCache = result;
  _cgCacheTime = now;
  return result;
}

async function dataCoinGeckoGlobal(): Promise<unknown> {
  const now = Date.now();
  if (_cgGlobalCache && now - _cgGlobalCacheTime < 600000) return _cgGlobalCache; // 10m cache
  const r = await fetch('https://api.coingecko.com/api/v3/global');
  if (r.status === 429) {
    if (_cgGlobalCache) return _cgGlobalCache;
    throw new Error('CoinGecko rate limit reached');
  }
  const d = await r.json() as { data?: Record<string, unknown> };
  const result = { global: d.data ?? {} };
  _cgGlobalCache = result;
  _cgGlobalCacheTime = now;
  return result;
}

let _cgTrendingCache: unknown = null;
let _cgTrendingCacheTime = 0;

async function dataCoinGeckoTrending(): Promise<unknown> {
  const now = Date.now();
  if (_cgTrendingCache && now - _cgTrendingCacheTime < 900000) return _cgTrendingCache; // 15m
  const r = await fetch('https://api.coingecko.com/api/v3/search/trending');
  if (r.status === 429) {
    if (_cgTrendingCache) return _cgTrendingCache;
    throw new Error('CoinGecko rate limit');
  }
  if (!r.ok) throw new Error(`CoinGecko trending error: ${r.status}`);
  const d = await r.json() as { coins?: { item: Record<string, unknown> }[] };
  const trending = (d.coins ?? []).slice(0, 7).map((c) => c.item);
  const result = { trending };
  _cgTrendingCache = result;
  _cgTrendingCacheTime = now;
  return result;
}

let _cgChartCache: unknown = null;
let _cgChartCacheTime = 0;

async function dataCoinGeckoPriceChart(): Promise<unknown> {
  const now = Date.now();
  if (_cgChartCache && now - _cgChartCacheTime < 600000) return _cgChartCache; // 10m
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin,ethereum';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const charts: unknown[] = [];
  for (const coinId of coins) {
    if (charts.length > 0) await new Promise(r => setTimeout(r, 2000)); // rate limit delay
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
    if (r.status === 429) { if (_cgChartCache) return _cgChartCache; break; }
    if (!r.ok) continue;
    const d = await r.json() as { prices?: [number, number][] };
    const prices = (d.prices ?? []).map(([ts, price]) => ({ ts, price }));
    charts.push({ coinId, prices });
  }
  const result = { charts };
  _cgChartCache = result;
  _cgChartCacheTime = now;
  return result;
}

let _cgDefiCache: unknown = null;
let _cgDefiCacheTime = 0;

async function dataCoinGeckoDefi(): Promise<unknown> {
  const now = Date.now();
  if (_cgDefiCache && now - _cgDefiCacheTime < 600000) return _cgDefiCache; // 10m
  const r = await fetch('https://api.coingecko.com/api/v3/global/decentralized_finance_defi');
  if (r.status === 429) { if (_cgDefiCache) return _cgDefiCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko DeFi error: ${r.status}`);
  const d = await r.json() as { data?: Record<string, unknown> };
  const result = { defi: d.data ?? {} };
  _cgDefiCache = result;
  _cgDefiCacheTime = now;
  return result;
}

let _cgCatCache: unknown = null;
let _cgCatCacheTime = 0;

async function dataCoinGeckoCategories(): Promise<unknown> {
  const now = Date.now();
  if (_cgCatCache && now - _cgCatCacheTime < 1800000) return _cgCatCache; // 30m
  const r = await fetch('https://api.coingecko.com/api/v3/coins/categories?order=market_cap_desc');
  if (r.status === 429) { if (_cgCatCache) return _cgCatCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko categories error: ${r.status}`);
  const d = await r.json() as unknown[];
  const result = { categories: d.slice(0, 20) };
  _cgCatCache = result;
  _cgCatCacheTime = now;
  return result;
}

let _cgExchCache: unknown = null;
let _cgExchCacheTime = 0;

async function dataCoinGeckoExchanges(): Promise<unknown> {
  const now = Date.now();
  if (_cgExchCache && now - _cgExchCacheTime < 1800000) return _cgExchCache; // 30m
  const r = await fetch('https://api.coingecko.com/api/v3/exchanges?per_page=10&page=1');
  if (r.status === 429) { if (_cgExchCache) return _cgExchCache; throw new Error('CoinGecko rate limit'); }
  if (!r.ok) throw new Error(`CoinGecko exchanges error: ${r.status}`);
  const d = await r.json() as unknown[];
  const result = { exchanges: d.slice(0, 10) };
  _cgExchCache = result;
  _cgExchCacheTime = now;
  return result;
}

let _cgDetailCache: unknown = null;
let _cgDetailCacheTime = 0;

async function dataCoinGeckoCoinDetail(): Promise<unknown> {
  const now = Date.now();
  if (_cgDetailCache && now - _cgDetailCacheTime < 300000) return _cgDetailCache; // 5m
  const coinsEnv = process.env['COINGECKO_COINS'] ?? 'bitcoin';
  const coins = coinsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const details: unknown[] = [];
  for (const coinId of coins) {
    if (details.length > 0) await new Promise(r => setTimeout(r, 2000));
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`);
    if (r.status === 429) { if (_cgDetailCache) return _cgDetailCache; break; }
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    const mktData = d['market_data'] as Record<string, unknown> | undefined;
    details.push({
      id: d['id'],
      name: d['name'],
      symbol: d['symbol'],
      description: (d['description'] as Record<string, string> | undefined)?.['en']?.slice(0, 200) ?? '',
      image: (d['image'] as Record<string, string> | undefined)?.['small'] ?? '',
      currentPrice: (mktData?.['current_price'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      marketCap: (mktData?.['market_cap'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      priceChange24h: mktData?.['price_change_percentage_24h'] ?? 0,
      high24h: (mktData?.['high_24h'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      low24h: (mktData?.['low_24h'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      ath: (mktData?.['ath'] as Record<string, number> | undefined)?.['usd'] ?? 0,
      athDate: (mktData?.['ath_date'] as Record<string, string> | undefined)?.['usd'] ?? '',
      rank: d['market_cap_rank'] ?? 0,
    });
  }
  const result = { details };
  _cgDetailCache = result;
  _cgDetailCacheTime = now;
  return result;
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  ctx.poll('coingecko-markets', parseInt(process.env['CG_POLL_MS'] ?? '300000', 10), dataCoinGeckoMarkets);
  ctx.poll('coingecko-global', parseInt(process.env['CG_POLL_MS'] ?? '600000', 10), dataCoinGeckoGlobal);
  ctx.poll('coingecko-trending', parseInt(process.env['CG_TRENDING_POLL_MS'] ?? '900000', 10), dataCoinGeckoTrending);
  ctx.poll('coingecko-defi-overview', parseInt(process.env['CG_DEFI_POLL_MS'] ?? '600000', 10), dataCoinGeckoDefi);
  ctx.poll('coingecko-categories', parseInt(process.env['CG_CAT_POLL_MS'] ?? '1800000', 10), dataCoinGeckoCategories);
  ctx.poll('coingecko-exchanges', parseInt(process.env['CG_EXCH_POLL_MS'] ?? '1800000', 10), dataCoinGeckoExchanges);

  if (process.env['COINGECKO_COINS']) {
    ctx.poll('coingecko-price-chart', parseInt(process.env['CG_CHART_POLL_MS'] ?? '600000', 10), dataCoinGeckoPriceChart);
    ctx.poll('coingecko-coin-detail', parseInt(process.env['CG_DETAIL_POLL_MS'] ?? '300000', 10), dataCoinGeckoCoinDetail);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/coingecko/')) return false;

    const { route } = ctx;
    if (path === '/api/coingecko/markets' && method === 'GET') { await route(res, dataCoinGeckoMarkets); return true; }
    if (path === '/api/coingecko/global' && method === 'GET') { await route(res, dataCoinGeckoGlobal); return true; }
    if (path === '/api/coingecko/trending' && method === 'GET') { await route(res, dataCoinGeckoTrending); return true; }
    if (path === '/api/coingecko/price-chart' && method === 'GET') { await route(res, dataCoinGeckoPriceChart); return true; }
    if (path === '/api/coingecko/defi' && method === 'GET') { await route(res, dataCoinGeckoDefi); return true; }
    if (path === '/api/coingecko/categories' && method === 'GET') { await route(res, dataCoinGeckoCategories); return true; }
    if (path === '/api/coingecko/exchanges' && method === 'GET') { await route(res, dataCoinGeckoExchanges); return true; }
    if (path === '/api/coingecko/coin-detail' && method === 'GET') { await route(res, dataCoinGeckoCoinDetail); return true; }

    ctx.json(res, 404, { error: `Unknown CoinGecko route: ${path}` });
    return true;
  };
}
