import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── WooCommerce ───────────────────────────────────────────────────────────────
async function dataWooCommerceOrders(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/orders?per_page=25&orderby=date&order=desc`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const orders = await r.json() as unknown[];
  return { orders };
}

async function dataWooSalesSummary(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/reports/sales?date_min=${startDate}&date_max=${endDate}`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as unknown[];
  return { summary: Array.isArray(d) ? (d[0] ?? {}) : {} };
}

async function dataWooTopSellers(): Promise<unknown> {
  const baseUrl = process.env['WC_BASE_URL'];
  const consumerKey = process.env['WC_CONSUMER_KEY'];
  const consumerSecret = process.env['WC_CONSUMER_SECRET'];
  if (!baseUrl || !consumerKey || !consumerSecret) throw new Error('WC_BASE_URL, WC_CONSUMER_KEY, or WC_CONSUMER_SECRET not configured');
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const r = await fetch(`${baseUrl}/wp-json/wc/v3/reports/top_sellers?period=month&number=20`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as unknown[];
  return { sellers: Array.isArray(d) ? d : [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['WC_BASE_URL'] && process.env['WC_CONSUMER_KEY'] && process.env['WC_CONSUMER_SECRET']) {
    ctx.poll('woocommerce-orders', parseInt(process.env['WC_POLL_MS'] ?? '120000', 10), dataWooCommerceOrders);
    ctx.poll('woocommerce-sales-summary', parseInt(process.env['WC_POLL_MS'] ?? '600000', 10), dataWooSalesSummary);
    ctx.poll('woocommerce-top-sellers', parseInt(process.env['WC_POLL_MS'] ?? '1800000', 10), dataWooTopSellers);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/woocommerce/')) return false;

    const { route } = ctx;
    if (path === '/api/woocommerce/orders' && method === 'GET') { await route(res, dataWooCommerceOrders); return true; }
    if (path === '/api/woocommerce/sales-summary' && method === 'GET') { await route(res, dataWooSalesSummary); return true; }
    if (path === '/api/woocommerce/top-sellers' && method === 'GET') { await route(res, dataWooTopSellers); return true; }

    ctx.json(res, 404, { error: `Unknown WooCommerce route: ${path}` });
    return true;
  };
}
