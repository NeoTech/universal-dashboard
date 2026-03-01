import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Alpha Vantage ─────────────────────────────────────────────────────────────
let _avCache: unknown = null;
let _avCacheTime = 0;
let _avSparkCache: unknown = null;
let _avSparkCacheTime = 0;
let _avMktStatusCache: unknown = null;
let _avMktStatusCacheTime = 0;
let _avMoversCache: unknown = null;
let _avMoversCacheTime = 0;
let _avNewsCache: unknown = null;
let _avNewsCacheTime = 0;
let _avEarningsCache: unknown = null;
let _avEarningsCacheTime = 0;

async function dataAlphaVantageQuotes(): Promise<unknown> {
  const now = Date.now();
  if (_avCache && now - _avCacheTime < 3600000) return _avCache; // 1h cache
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const stocks: unknown[] = [];
  let rateLimit = false;
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // 12s delay (5/min limit)
    const r = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { rateLimit = true; continue; }
    const q = d['Global Quote'] as Record<string, string> | undefined;
    if (q) {
      stocks.push({
        symbol,
        quote: {
          symbol: q['01. symbol'],
          open: q['02. open'],
          high: q['03. high'],
          low: q['04. low'],
          price: q['05. price'],
          volume: q['06. volume'],
          latestTradingDay: q['07. latest trading day'],
          previousClose: q['08. previous close'],
          change: q['09. change'],
          changePercent: q['10. change percent'],
        },
        timeSeries: [],
      });
    }
  }
  const result = { stocks, rateLimit };
  _avCache = result;
  _avCacheTime = now;
  return result;
}

async function dataAvSparklines(): Promise<unknown> {
  const now = Date.now();
  if (_avSparkCache && now - _avSparkCacheTime < 3600000) return _avSparkCache; // 1h cache
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const sparklines: unknown[] = [];
  let rateLimit = false;
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // 12s delay (5/min limit)
    const r = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=compact&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { rateLimit = true; continue; }
    const ts = d['Time Series (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!ts) continue;
    const entries = Object.entries(ts)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30)
      .map(([date, v]) => ({ date, close: parseFloat(v['4. close']) }));
    const latestPrice = entries[0]?.close ?? 0;
    const prevDay = entries[1]?.close ?? latestPrice;
    const prevWeek = entries[6]?.close ?? latestPrice;
    const change1d = prevDay !== 0 ? ((latestPrice - prevDay) / prevDay) * 100 : 0;
    const change1w = prevWeek !== 0 ? ((latestPrice - prevWeek) / prevWeek) * 100 : 0;
    sparklines.push({ symbol, series: entries, change1d, change1w, latestPrice });
  }
  const result = { sparklines, rateLimit };
  _avSparkCache = result;
  _avSparkCacheTime = now;
  return result;
}

async function dataAvMarketStatus(): Promise<unknown> {
  const now = Date.now();
  if (_avMktStatusCache && now - _avMktStatusCacheTime < 900000) return _avMktStatusCache; // 15m
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=MARKET_STATUS&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avMktStatusCache) return _avMktStatusCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = { markets: (d['markets'] as unknown[]) ?? [] };
  _avMktStatusCache = result;
  _avMktStatusCacheTime = now;
  return result;
}

async function dataAvMarketMovers(): Promise<unknown> {
  const now = Date.now();
  if (_avMoversCache && now - _avMoversCacheTime < 900000) return _avMoversCache; // 15m
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=TOP_GAINERS_LOSERS&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avMoversCache) return _avMoversCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = {
    last_updated: d['last_updated'] ?? '',
    top_gainers: (d['top_gainers'] as unknown[]) ?? [],
    top_losers: (d['top_losers'] as unknown[]) ?? [],
    most_actively_traded: (d['most_actively_traded'] as unknown[]) ?? [],
  };
  _avMoversCache = result;
  _avMoversCacheTime = now;
  return result;
}

async function dataAvNewsSentiment(): Promise<unknown> {
  const now = Date.now();
  if (_avNewsCache && now - _avNewsCacheTime < 3600000) return _avNewsCache; // 1h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const tickers = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).join(',');
  const tickerParam = tickers ? `&tickers=${tickers}` : '';
  const r = await fetch(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT${tickerParam}&limit=20&apikey=${apiKey}`);
  const d = await r.json() as Record<string, unknown>;
  if (d['Note'] || d['Information']) {
    if (_avNewsCache) return _avNewsCache;
    throw new Error('Alpha Vantage rate limit reached');
  }
  const result = { feed: (d['feed'] as unknown[]) ?? [], sentiment_score_definition: d['sentiment_score_definition'] };
  _avNewsCache = result;
  _avNewsCacheTime = now;
  return result;
}

async function dataAvEarnings(): Promise<unknown> {
  const now = Date.now();
  if (_avEarningsCache && now - _avEarningsCacheTime < 21600000) return _avEarningsCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000)); // rate limit
    const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) { continue; }
    results.push({
      symbol,
      annualEarnings: ((d['annualEarnings'] as unknown[]) ?? []).slice(0, 5),
      quarterlyEarnings: ((d['quarterlyEarnings'] as unknown[]) ?? []).slice(0, 8),
    });
  }
  const result = { earnings: results };
  _avEarningsCache = result;
  _avEarningsCacheTime = now;
  return result;
}

let _avCalendarCache: unknown = null;
let _avCalendarCacheTime = 0;

async function dataAvEarningsCalendar(): Promise<unknown> {
  const now = Date.now();
  if (_avCalendarCache && now - _avCalendarCacheTime < 86400000) return _avCalendarCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const r = await fetch(`https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${apiKey}`);
  if (!r.ok) throw new Error(`AV earnings calendar error: ${r.status}`);
  const text = await r.text();
  // Parse CSV: first line is header, remaining lines are data
  const lines = text.trim().split('\n');
  const headers = lines[0]!.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const events = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    return obj;
  }).filter(e => e['symbol'] || e['name']);
  const result = { events: events.slice(0, 50) };
  _avCalendarCache = result;
  _avCalendarCacheTime = now;
  return result;
}

let _avFundaCache: unknown = null;
let _avFundaCacheTime = 0;

async function dataAvFundamentals(): Promise<unknown> {
  const now = Date.now();
  if (_avFundaCache && now - _avFundaCacheTime < 21600000) return _avFundaCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const results: unknown[] = [];
  for (const symbol of symbols) {
    await new Promise(r => setTimeout(r, 12000));
    const r = await fetch(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information'] || !d['Symbol']) continue;
    results.push({
      symbol,
      name: d['Name'],
      sector: d['Sector'],
      industry: d['Industry'],
      exchange: d['Exchange'],
      marketCap: d['MarketCapitalization'],
      peRatio: d['PERatio'],
      eps: d['EPS'],
      dividendYield: d['DividendYield'],
      week52High: d['52WeekHigh'],
      week52Low: d['52WeekLow'],
      analystTargetPrice: d['AnalystTargetPrice'],
      beta: d['Beta'],
      profitMargin: d['ProfitMargin'],
    });
  }
  const result = { companies: results };
  _avFundaCache = result;
  _avFundaCacheTime = now;
  return result;
}

let _avForexCache: unknown = null;
let _avForexCacheTime = 0;

async function dataAvForexRates(): Promise<unknown> {
  const now = Date.now();
  if (_avForexCache && now - _avForexCacheTime < 3600000) return _avForexCache; // 1h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const pairsEnv = process.env['AV_FOREX_PAIRS'] ?? 'EUR/USD,GBP/USD,USD/JPY';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const pairs = pairsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
  const results: unknown[] = [];
  for (const pair of pairs) {
    await new Promise(r => setTimeout(r, 12000));
    const [from, to] = pair.split('/');
    if (!from || !to) continue;
    const r = await fetch(`https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&outputsize=compact&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const ts = d['Time Series FX (Daily)'] as Record<string, Record<string, string>> | undefined;
    if (!ts) continue;
    const entries = Object.entries(ts)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 30)
      .map(([date, v]) => ({ date, close: parseFloat(v['4. close'] ?? '0') }));
    const latest = entries[0];
    const prev = entries[1];
    const change = latest && prev ? latest.close - prev.close : 0;
    const changePct = prev && prev.close ? (change / prev.close) * 100 : 0;
    results.push({ pair, from, to, series: entries, currentRate: latest?.close ?? 0, change, changePct });
  }
  const result = { rates: results };
  _avForexCache = result;
  _avForexCacheTime = now;
  return result;
}

let _avCommodCache: unknown = null;
let _avCommodCacheTime = 0;

async function dataAvCommodities(): Promise<unknown> {
  const now = Date.now();
  if (_avCommodCache && now - _avCommodCacheTime < 21600000) return _avCommodCache; // 6h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const commodities = [
    { fn: 'WTI', name: 'WTI Crude Oil', unit: 'dollars per barrel' },
    { fn: 'BRENT', name: 'Brent Crude Oil', unit: 'dollars per barrel' },
    { fn: 'NATURAL_GAS', name: 'Natural Gas', unit: 'dollars per million BTU' },
    { fn: 'COPPER', name: 'Copper', unit: 'dollars per metric ton' },
    { fn: 'WHEAT', name: 'Wheat', unit: 'dollars per metric ton' },
  ];
  const results: unknown[] = [];
  for (const c of commodities) {
    await new Promise(r => setTimeout(r, 12000));
    const r = await fetch(`https://www.alphavantage.co/query?function=${c.fn}&interval=monthly&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const data = d['data'] as { date: string; value: string }[] | undefined;
    if (!data || data.length < 2) continue;
    const latest = data[0];
    const prev = data[1];
    const latestVal = parseFloat(latest?.value ?? '0');
    const prevVal = parseFloat(prev?.value ?? '0');
    const change = latestVal - prevVal;
    const changePct = prevVal ? (change / prevVal) * 100 : 0;
    results.push({
      name: c.name,
      unit: d['unit'] ?? c.unit,
      latestDate: latest?.date ?? '',
      latestValue: latestVal,
      prevValue: prevVal,
      change,
      changePct,
    });
  }
  const result = { commodities: results };
  _avCommodCache = result;
  _avCommodCacheTime = now;
  return result;
}

let _avEconCache: unknown = null;
let _avEconCacheTime = 0;

async function dataAvEconomicIndicators(): Promise<unknown> {
  const now = Date.now();
  if (_avEconCache && now - _avEconCacheTime < 86400000) return _avEconCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const indicators = [
    { fn: 'REAL_GDP', params: 'interval=annual', name: 'Real GDP', unit: 'billions of dollars' },
    { fn: 'INFLATION', params: '', name: 'Inflation (CPI YoY)', unit: 'percent' },
    { fn: 'UNEMPLOYMENT', params: '', name: 'Unemployment Rate', unit: 'percent' },
    { fn: 'CPI', params: 'interval=monthly', name: 'Consumer Price Index', unit: 'index' },
  ];
  const results: unknown[] = [];
  for (const ind of indicators) {
    await new Promise(r => setTimeout(r, 12000));
    const params = ind.params ? `&${ind.params}` : '';
    const r = await fetch(`https://www.alphavantage.co/query?function=${ind.fn}${params}&apikey=${apiKey}`);
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) continue;
    const data = d['data'] as { date: string; value: string }[] | undefined;
    if (!data || data.length < 2) continue;
    const latest = data[0];
    const prev = data[1];
    const latestVal = parseFloat(latest?.value ?? '0');
    const prevVal = parseFloat(prev?.value ?? '0');
    results.push({
      name: ind.name,
      unit: d['unit'] ?? ind.unit,
      interval: d['interval'] ?? '',
      latestDate: latest?.date ?? '',
      latestValue: latestVal,
      prevDate: prev?.date ?? '',
      prevValue: prevVal,
    });
  }
  const result = { indicators: results };
  _avEconCache = result;
  _avEconCacheTime = now;
  return result;
}

let _avInsiderCache: unknown = null;
let _avInsiderCacheTime = 0;

async function dataAvInsiderTransactions(): Promise<unknown> {
  const now = Date.now();
  if (_avInsiderCache && now - _avInsiderCacheTime < 86400000) return _avInsiderCache; // 24h
  const apiKey = process.env['ALPHA_VANTAGE_KEY'];
  const symbolsEnv = process.env['AV_SYMBOLS'] ?? '';
  if (!apiKey) throw new Error('ALPHA_VANTAGE_KEY not configured');
  const symbols = symbolsEnv.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5).join(',');
  try {
    const r = await fetch(`https://www.alphavantage.co/query?function=ANALYTICS_FIXED_WINDOW&SYMBOLS=${symbols}&RANGE=6month&OHLC=close&CALCULATIONS=PERCENT_CHANGE&apikey=${apiKey}`);
    if (!r.ok) {
      const result = { transactions: [], note: 'This endpoint requires Alpha Vantage Premium.' };
      _avInsiderCache = result;
      _avInsiderCacheTime = now;
      return result;
    }
    const d = await r.json() as Record<string, unknown>;
    if (d['Note'] || d['Information']) {
      const result = { transactions: [], note: String(d['Note'] ?? d['Information'] ?? 'Premium endpoint required.') };
      _avInsiderCache = result;
      _avInsiderCacheTime = now;
      return result;
    }
    const payload = d['payload'] as unknown[] | undefined;
    const result = { transactions: payload ?? [], note: '' };
    _avInsiderCache = result;
    _avInsiderCacheTime = now;
    return result;
  } catch {
    return { transactions: [], note: 'Failed to fetch insider data.' };
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['ALPHA_VANTAGE_KEY']) {
    ctx.poll('alphavantage-quotes', parseInt(process.env['AV_POLL_MS'] ?? '3600000', 10), dataAlphaVantageQuotes);
    ctx.poll('alphavantage-sparklines', parseInt(process.env['AV_SPARK_POLL_MS'] ?? '3600000', 10), dataAvSparklines);
    ctx.poll('alphavantage-market-status', parseInt(process.env['AV_MKTSTATUS_POLL_MS'] ?? '900000', 10), dataAvMarketStatus);
    ctx.poll('alphavantage-market-movers', parseInt(process.env['AV_MOVERS_POLL_MS'] ?? '900000', 10), dataAvMarketMovers);
    ctx.poll('alphavantage-news-sentiment', parseInt(process.env['AV_NEWS_POLL_MS'] ?? '3600000', 10), dataAvNewsSentiment);
    ctx.poll('alphavantage-earnings', parseInt(process.env['AV_EARNINGS_POLL_MS'] ?? '21600000', 10), dataAvEarnings);
    ctx.poll('alphavantage-earnings-calendar', parseInt(process.env['AV_CALENDAR_POLL_MS'] ?? '86400000', 10), dataAvEarningsCalendar);
    ctx.poll('alphavantage-fundamentals', parseInt(process.env['AV_FUNDA_POLL_MS'] ?? '21600000', 10), dataAvFundamentals);
    ctx.poll('alphavantage-forex-rates', parseInt(process.env['AV_FOREX_POLL_MS'] ?? '3600000', 10), dataAvForexRates);
    ctx.poll('alphavantage-commodities', parseInt(process.env['AV_COMMOD_POLL_MS'] ?? '21600000', 10), dataAvCommodities);
    ctx.poll('alphavantage-economic-indicators', parseInt(process.env['AV_ECON_POLL_MS'] ?? '86400000', 10), dataAvEconomicIndicators);
    ctx.poll('alphavantage-insider-transactions', parseInt(process.env['AV_INSIDER_POLL_MS'] ?? '86400000', 10), dataAvInsiderTransactions);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/alphavantage/')) return false;

    const { route } = ctx;
    if (path === '/api/alphavantage/quotes' && method === 'GET') { await route(res, dataAlphaVantageQuotes); return true; }
    if (path === '/api/alphavantage/sparklines' && method === 'GET') { await route(res, dataAvSparklines); return true; }
    if (path === '/api/alphavantage/market-status' && method === 'GET') { await route(res, dataAvMarketStatus); return true; }
    if (path === '/api/alphavantage/market-movers' && method === 'GET') { await route(res, dataAvMarketMovers); return true; }
    if (path === '/api/alphavantage/news-sentiment' && method === 'GET') { await route(res, dataAvNewsSentiment); return true; }
    if (path === '/api/alphavantage/earnings' && method === 'GET') { await route(res, dataAvEarnings); return true; }
    if (path === '/api/alphavantage/earnings-calendar' && method === 'GET') { await route(res, dataAvEarningsCalendar); return true; }
    if (path === '/api/alphavantage/fundamentals' && method === 'GET') { await route(res, dataAvFundamentals); return true; }
    if (path === '/api/alphavantage/forex-rates' && method === 'GET') { await route(res, dataAvForexRates); return true; }
    if (path === '/api/alphavantage/commodities' && method === 'GET') { await route(res, dataAvCommodities); return true; }
    if (path === '/api/alphavantage/economic-indicators' && method === 'GET') { await route(res, dataAvEconomicIndicators); return true; }
    if (path === '/api/alphavantage/insider-transactions' && method === 'GET') { await route(res, dataAvInsiderTransactions); return true; }

    ctx.json(res, 404, { error: `Unknown Alpha Vantage route: ${path}` });
    return true;
  };
}
