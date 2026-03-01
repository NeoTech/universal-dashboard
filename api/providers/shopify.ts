import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Shopify ───────────────────────────────────────────────────────────────────
async function dataShopifyOrders(): Promise<unknown> {
  const shop = process.env['SHOPIFY_SHOP'];
  const accessToken = process.env['SHOPIFY_ACCESS_TOKEN'];
  if (!shop || !accessToken) throw new Error('SHOPIFY_SHOP or SHOPIFY_ACCESS_TOKEN not configured');
  const r = await fetch(`https://${shop}/admin/api/2024-07/orders.json?limit=25&status=any`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  const d = await r.json() as { orders?: unknown[] };
  return { orders: d.orders ?? [] };
}

async function dataShopifyProducts(): Promise<unknown> {
  const shop = process.env['SHOPIFY_SHOP'];
  const accessToken = process.env['SHOPIFY_ACCESS_TOKEN'];
  if (!shop || !accessToken) throw new Error('SHOPIFY_SHOP or SHOPIFY_ACCESS_TOKEN not configured');
  const r = await fetch(`https://${shop}/admin/api/2024-07/products.json?limit=25&status=active`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
  });
  const d = await r.json() as { products?: unknown[] };
  return { products: d.products ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['SHOPIFY_SHOP'] && process.env['SHOPIFY_ACCESS_TOKEN']) {
    ctx.poll('shopify-orders', parseInt(process.env['SHOPIFY_POLL_MS'] ?? '120000', 10), dataShopifyOrders);
    ctx.poll('shopify-products', parseInt(process.env['SHOPIFY_POLL_MS'] ?? '600000', 10), dataShopifyProducts);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/shopify/')) return false;

    const { route } = ctx;
    if (path === '/api/shopify/orders' && method === 'GET') { await route(res, dataShopifyOrders); return true; }
    if (path === '/api/shopify/products' && method === 'GET') { await route(res, dataShopifyProducts); return true; }

    ctx.json(res, 404, { error: `Unknown Shopify route: ${path}` });
    return true;
  };
}
