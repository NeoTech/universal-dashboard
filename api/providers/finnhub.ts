import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Finnhub ───────────────────────────────────────────────────────────────────
async function dataFinnhubQuotes(): Promise<unknown> {
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
  const quotes = await Promise.all(
    symbols.map(symbol =>
      fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`)
        .then(r => r.json())
        .then((q: unknown) => ({ ...(q as Record<string, unknown>), symbol }))
    )
  );
  return { quotes };
}

async function dataFinnhubNews(): Promise<unknown> {
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const category = process.env['FH_NEWS_CATEGORY'] ?? 'general';
  const r = await fetch(`https://finnhub.io/api/v1/news?category=${category}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub news error: ${r.status}`);
  const items = await r.json() as unknown[];
  return { news: (items as unknown[]).slice(0, 30) };
}

let _fhCompanyNewsCache: unknown = null;
let _fhCompanyNewsCacheTime = 0;

async function dataFinnhubCompanyNews(): Promise<unknown> {
  const now = Date.now();
  if (_fhCompanyNewsCache && now - _fhCompanyNewsCacheTime < 300000) return _fhCompanyNewsCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const toDate = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const allNews: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${token}`);
    if (!r.ok) continue;
    const news = await r.json() as unknown[];
    allNews.push(...news.slice(0, 5));
  }
  allNews.sort((a, b) => ((b as Record<string, number>)['datetime'] ?? 0) - ((a as Record<string, number>)['datetime'] ?? 0));
  const result = { news: allNews.slice(0, 30) };
  _fhCompanyNewsCache = result;
  _fhCompanyNewsCacheTime = now;
  return result;
}

let _fhMktNewsCache: unknown = null;
let _fhMktNewsCacheTime = 0;

async function dataFinnhubMarketNews(): Promise<unknown> {
  const now = Date.now();
  if (_fhMktNewsCache && now - _fhMktNewsCacheTime < 300000) return _fhMktNewsCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const categories = ['general', 'forex', 'crypto'];
  const byCategory: Record<string, unknown[]> = {};
  for (const cat of categories) {
    const r = await fetch(`https://finnhub.io/api/v1/news?category=${cat}&minId=0&token=${token}`);
    if (!r.ok) continue;
    const news = await r.json() as unknown[];
    byCategory[cat] = news.slice(0, 10);
  }
  const result = { byCategory };
  _fhMktNewsCache = result;
  _fhMktNewsCacheTime = now;
  return result;
}

let _fhEarnCalCache: unknown = null;
let _fhEarnCalCacheTime = 0;

async function dataFinnhubEarningsCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_fhEarnCalCache && now - _fhEarnCalCacheTime < 3600000) return _fhEarnCalCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`https://finnhub.io/api/v1/calendar/earnings?from=${today}&to=${nextMonth}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub earnings calendar error: ${r.status}`);
  const d = await r.json() as { earningsCalendar?: unknown[] };
  const result = { calendar: (d.earningsCalendar ?? []).slice(0, 30) };
  _fhEarnCalCache = result;
  _fhEarnCalCacheTime = now;
  return result;
}

let _fhEarnSurpCache: unknown = null;
let _fhEarnSurpCacheTime = 0;

async function dataFinnhubEarningsSurprises(): Promise<unknown> {
  const now = Date.now();
  if (_fhEarnSurpCache && now - _fhEarnSurpCacheTime < 3600000) return _fhEarnSurpCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/earnings?symbol=${symbol}&limit=4&token=${token}`);
    if (!r.ok) continue;
    const data = await r.json() as unknown[];
    if (Array.isArray(data) && data.length > 0) results.push({ symbol, quarters: data.slice(0, 4) });
  }
  const result = { surprises: results };
  _fhEarnSurpCache = result;
  _fhEarnSurpCacheTime = now;
  return result;
}

let _fhAnalysisCache: unknown = null;
let _fhAnalysisCacheTime = 0;

async function dataFinnhubAnalystConsensus(): Promise<unknown> {
  const now = Date.now();
  if (_fhAnalysisCache && now - _fhAnalysisCacheTime < 3600000) return _fhAnalysisCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const data = await r.json() as unknown[];
    if (Array.isArray(data) && data.length > 0) results.push({ symbol, recommendation: data[0] });
  }
  const result = { consensus: results };
  _fhAnalysisCache = result;
  _fhAnalysisCacheTime = now;
  return result;
}

let _fhFundaCache: unknown = null;
let _fhFundaCacheTime = 0;

async function dataFinnhubFundamentals(): Promise<unknown> {
  const now = Date.now();
  if (_fhFundaCache && now - _fhFundaCacheTime < 3600000) return _fhFundaCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { metric?: Record<string, unknown> };
    if (d.metric) {
      const m = d.metric;
      results.push({
        symbol,
        peNormalizedAnnual: m['peNormalizedAnnual'] ?? null,
        pbAnnual: m['pbAnnual'] ?? null,
        psTTM: m['psTTM'] ?? null,
        epsBasicExclExtraItemsAnnual: m['epsBasicExclExtraItemsAnnual'] ?? null,
        roaRfy: m['roaRfy'] ?? null,
        roeRfy: m['roeRfy'] ?? null,
        debtEquityAnnual: m['debtEquityAnnual'] ?? null,
        dividendYieldIndicatedAnnual: m['dividendYieldIndicatedAnnual'] ?? null,
        '52WeekHigh': m['52WeekHigh'] ?? null,
        '52WeekLow': m['52WeekLow'] ?? null,
        beta: m['beta'] ?? null,
        marketCapitalization: m['marketCapitalization'] ?? null,
      });
    }
  }
  const result = { fundamentals: results };
  _fhFundaCache = result;
  _fhFundaCacheTime = now;
  return result;
}

let _fhMktStatusCache: unknown = null;
let _fhMktStatusCacheTime = 0;

async function dataFinnhubMarketStatus(): Promise<unknown> {
  const now = Date.now();
  if (_fhMktStatusCache && now - _fhMktStatusCacheTime < 300000) return _fhMktStatusCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const exchanges = ['US', 'LSE', 'TSX', 'EURONEXT'];
  const statuses: unknown[] = [];
  for (const exchange of exchanges) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/market-status?exchange=${exchange}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    statuses.push({ exchange, ...d });
  }
  const result = { statuses };
  _fhMktStatusCache = result;
  _fhMktStatusCacheTime = now;
  return result;
}

let _fhInsiderTxCache: unknown = null;
let _fhInsiderTxCacheTime = 0;

async function dataFinnhubInsiderTransactions(): Promise<unknown> {
  const now = Date.now();
  if (_fhInsiderTxCache && now - _fhInsiderTxCacheTime < 3600000) return _fhInsiderTxCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/insider-transactions?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { data?: unknown[] };
    const txList = (d.data ?? []).slice(0, 10);
    results.push({ symbol, transactions: txList });
  }
  const result = { symbols: results };
  _fhInsiderTxCache = result;
  _fhInsiderTxCacheTime = now;
  return result;
}

let _fhInsiderSentCache: unknown = null;
let _fhInsiderSentCacheTime = 0;

async function dataFinnhubInsiderSentiment(): Promise<unknown> {
  const now = Date.now();
  if (_fhInsiderSentCache && now - _fhInsiderSentCacheTime < 3600000) return _fhInsiderSentCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = new Date().toISOString().slice(0, 10);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/insider-sentiment?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as { data?: unknown[]; symbol?: string };
    const dataArr = d.data ?? [];
    const latest = dataArr.length > 0 ? dataArr[dataArr.length - 1] : null;
    results.push({ symbol, data: dataArr, latest });
  }
  const result = { sentiments: results };
  _fhInsiderSentCache = result;
  _fhInsiderSentCacheTime = now;
  return result;
}

let _fhIpoCache: unknown = null;
let _fhIpoCacheTime = 0;

async function dataFinnhubIpoCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_fhIpoCache && now - _fhIpoCacheTime < 3600000) return _fhIpoCache;
  const token = process.env['FINNHUB_TOKEN'];
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`https://finnhub.io/api/v1/calendar/ipo?from=${today}&to=${nextMonth}&token=${token}`);
  if (!r.ok) throw new Error(`Finnhub IPO calendar error: ${r.status}`);
  const d = await r.json() as { ipoCalendar?: unknown[] };
  const result = { ipos: (d.ipoCalendar ?? []).slice(0, 20) };
  _fhIpoCache = result;
  _fhIpoCacheTime = now;
  return result;
}

let _fhFilingsCache: unknown = null;
let _fhFilingsCacheTime = 0;

async function dataFinnhubSecFilings(): Promise<unknown> {
  const now = Date.now();
  if (_fhFilingsCache && now - _fhFilingsCacheTime < 3600000) return _fhFilingsCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/filings?symbol=${symbol}&form=10-K,10-Q,8-K&limit=5&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as unknown[];
    results.push({ symbol, filings: d.slice(0, 5) });
  }
  const result = { symbols: results };
  _fhFilingsCache = result;
  _fhFilingsCacheTime = now;
  return result;
}

let _fhProfileCache: unknown = null;
let _fhProfileCacheTime = 0;

async function dataFinnhubCompanyProfile(): Promise<unknown> {
  const now = Date.now();
  if (_fhProfileCache && now - _fhProfileCacheTime < 21600000) return _fhProfileCache;
  const token = process.env['FINNHUB_TOKEN'];
  const symbolsEnv = process.env['FH_SYMBOLS'] ?? '';
  if (!token) throw new Error('FINNHUB_TOKEN not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    const r = await fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${symbol}&token=${token}`);
    if (!r.ok) continue;
    const d = await r.json() as Record<string, unknown>;
    if (d['ticker']) results.push(d);
  }
  const result = { profiles: results };
  _fhProfileCache = result;
  _fhProfileCacheTime = now;
  return result;
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['FINNHUB_TOKEN']) {
    ctx.poll('finnhub-quotes', parseInt(process.env['FINNHUB_POLL_MS'] ?? '60000', 10), dataFinnhubQuotes);
    ctx.poll('finnhub-news', parseInt(process.env['FH_NEWS_POLL_MS'] ?? '300000', 10), dataFinnhubNews);
    ctx.poll('finnhub-market-news', parseInt(process.env['FH_MKTNS_POLL_MS'] ?? '300000', 10), dataFinnhubMarketNews);
    ctx.poll('finnhub-earnings-calendar', parseInt(process.env['FH_EARNCAL_POLL_MS'] ?? '3600000', 10), dataFinnhubEarningsCalendar);
    ctx.poll('finnhub-market-status', parseInt(process.env['FH_MKTSTATUS_POLL_MS'] ?? '300000', 10), dataFinnhubMarketStatus);
    ctx.poll('finnhub-ipo-calendar', parseInt(process.env['FH_IPO_POLL_MS'] ?? '3600000', 10), dataFinnhubIpoCalendar);

    if (process.env['FH_SYMBOLS']) {
      ctx.poll('finnhub-company-news', parseInt(process.env['FH_CNEWS_POLL_MS'] ?? '300000', 10), dataFinnhubCompanyNews);
      ctx.poll('finnhub-earnings-surprises', parseInt(process.env['FH_EARNSU_POLL_MS'] ?? '3600000', 10), dataFinnhubEarningsSurprises);
      ctx.poll('finnhub-analyst-consensus', parseInt(process.env['FH_ANALYST_POLL_MS'] ?? '3600000', 10), dataFinnhubAnalystConsensus);
      ctx.poll('finnhub-fundamentals', parseInt(process.env['FH_FUNDA_POLL_MS'] ?? '3600000', 10), dataFinnhubFundamentals);
      ctx.poll('finnhub-insider-transactions', parseInt(process.env['FH_INSIDERTX_POLL_MS'] ?? '3600000', 10), dataFinnhubInsiderTransactions);
      ctx.poll('finnhub-insider-sentiment', parseInt(process.env['FH_INSIDERST_POLL_MS'] ?? '3600000', 10), dataFinnhubInsiderSentiment);
      ctx.poll('finnhub-sec-filings', parseInt(process.env['FH_FILINGS_POLL_MS'] ?? '3600000', 10), dataFinnhubSecFilings);
      ctx.poll('finnhub-company-profile', parseInt(process.env['FH_PROFILE_POLL_MS'] ?? '21600000', 10), dataFinnhubCompanyProfile);
    }
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/finnhub/')) return false;

    const { route } = ctx;
    if (path === '/api/finnhub/quotes' && method === 'GET') { await route(res, dataFinnhubQuotes); return true; }
    if (path === '/api/finnhub/news' && method === 'GET') { await route(res, dataFinnhubNews); return true; }
    if (path === '/api/finnhub/company-news' && method === 'GET') { await route(res, dataFinnhubCompanyNews); return true; }
    if (path === '/api/finnhub/market-news' && method === 'GET') { await route(res, dataFinnhubMarketNews); return true; }
    if (path === '/api/finnhub/earnings-calendar' && method === 'GET') { await route(res, dataFinnhubEarningsCalendar); return true; }
    if (path === '/api/finnhub/earnings-surprises' && method === 'GET') { await route(res, dataFinnhubEarningsSurprises); return true; }
    if (path === '/api/finnhub/analyst-consensus' && method === 'GET') { await route(res, dataFinnhubAnalystConsensus); return true; }
    if (path === '/api/finnhub/fundamentals' && method === 'GET') { await route(res, dataFinnhubFundamentals); return true; }
    if (path === '/api/finnhub/market-status' && method === 'GET') { await route(res, dataFinnhubMarketStatus); return true; }
    if (path === '/api/finnhub/insider-transactions' && method === 'GET') { await route(res, dataFinnhubInsiderTransactions); return true; }
    if (path === '/api/finnhub/insider-sentiment' && method === 'GET') { await route(res, dataFinnhubInsiderSentiment); return true; }
    if (path === '/api/finnhub/ipo-calendar' && method === 'GET') { await route(res, dataFinnhubIpoCalendar); return true; }
    if (path === '/api/finnhub/sec-filings' && method === 'GET') { await route(res, dataFinnhubSecFilings); return true; }
    if (path === '/api/finnhub/company-profile' && method === 'GET') { await route(res, dataFinnhubCompanyProfile); return true; }

    ctx.json(res, 404, { error: `Unknown Finnhub route: ${path}` });
    return true;
  };
}
