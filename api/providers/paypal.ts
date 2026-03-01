import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Module-level token cache ──────────────────────────────────────────────────
let _ppToken: { access_token: string; expiresAt: number } | null = null;

// ── PayPal helpers ────────────────────────────────────────────────────────────
export async function getPayPalToken(paypalApiUrl?: string): Promise<string | null> {
  const clientId     = process.env['PAYPAL_CLIENT_ID'];
  const clientSecret = process.env['PAYPAL_CLIENT_SECRET'];
  if (!clientId || !clientSecret) return null;
  if (_ppToken && Date.now() < _ppToken.expiresAt) return _ppToken.access_token;
  const env = process.env['PAYPAL_ENV'] ?? 'sandbox';
  const base = paypalApiUrl || (env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
  const r = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) return null;
  const data = await r.json() as { access_token: string; expires_in: number };
  _ppToken = { access_token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return _ppToken.access_token;
}

export async function paypalFetch(path: string, token: string, paypalApiUrl?: string): Promise<unknown> {
  const env = process.env['PAYPAL_ENV'] ?? 'sandbox';
  const base = paypalApiUrl || (env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  if (!r.ok) { const err = await r.text(); throw new Error(err); }
  return r.json();
}

export async function getPayPalTransactions(res: ServerResponse, ctx: ServerContext): Promise<void> {
  const paypalApiUrl = ctx.PAYPAL_API_URL;
  const token = await getPayPalToken(paypalApiUrl);
  if (!token) { ctx.json(res, 503, { error: 'PayPal credentials not configured' }); return; }
  try {
    const end   = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt   = (d: Date) => d.toISOString().slice(0, 19) + '+0000';
    const data  = await paypalFetch(
      `/v1/reporting/transactions?start_date=${fmt(start)}&end_date=${fmt(end)}&fields=all&page_size=100`,
      token,
      paypalApiUrl,
    );
    ctx.json(res, 200, data);
  } catch (e) { ctx.json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

export async function getPayPalBalance(res: ServerResponse, ctx: ServerContext): Promise<void> {
  const paypalApiUrl = ctx.PAYPAL_API_URL;
  const token = await getPayPalToken(paypalApiUrl);
  if (!token) { ctx.json(res, 503, { error: 'PayPal credentials not configured' }); return; }
  try {
    const data = await paypalFetch('/v1/reporting/balances', token, paypalApiUrl);
    ctx.json(res, 200, data);
  } catch (e) { ctx.json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

export async function dataPayPal(paypalApiUrl?: string): Promise<unknown> {
  const token = await getPayPalToken(paypalApiUrl);
  if (!token) throw new Error('PayPal credentials not configured');
  const end   = new Date();
  const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fmt   = (d: Date) => d.toISOString().slice(0, 19) + '+0000';
  const [txData, balData] = await Promise.all([
    paypalFetch(`/v1/reporting/transactions?start_date=${fmt(start)}&end_date=${fmt(end)}&fields=all&page_size=100`, token, paypalApiUrl),
    paypalFetch('/v1/reporting/balances', token, paypalApiUrl),
  ]);
  return {
    transactions: (txData as { transaction_details?: unknown[] }).transaction_details ?? [],
    balances:     (balData  as { balances?: unknown[] }).balances ?? [],
  };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  const paypalApiUrl = ctx.PAYPAL_API_URL;

  if (process.env['PAYPAL_CLIENT_ID'] && process.env['PAYPAL_CLIENT_SECRET']) {
    ctx.poll('paypal-data', parseInt(process.env['PAYPAL_POLL_MS'] ?? '60000', 10), () => dataPayPal(paypalApiUrl));
  }

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, body: string): Promise<boolean> => {
    // ── Webhook receive: POST /api/webhooks/paypal ────────────────────────────
    if (path === '/api/webhooks/paypal' && method === 'POST') {
      const secret = process.env['PAYPAL_WEBHOOK_SECRET'];
      const sig    = req.headers['paypal-transmission-sig'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('node:crypto');
        const expected = createHmac('sha256', secret).update(body).digest('base64');
        if (expected !== sig) { ctx.json(res, 400, { error: 'Invalid PayPal signature' }); return true; }
      }
      const eventType = (JSON.parse(body) as { event_type?: string }).event_type ?? 'unknown';
      console.log(`  [webhook] paypal  event=${eventType}`);
      const fn = ctx.refreshRegistry.get('paypal-data');
      if (fn) { console.log('  [webhook] trigger refresh  paypal-data'); void fn(); }
      ctx.json(res, 200, { received: true });
      return true;
    }

    if (!path.startsWith('/api/paypal/')) return false;

    if (path === '/api/paypal/transactions' && method === 'GET') { await getPayPalTransactions(res, ctx); return true; }
    if (path === '/api/paypal/balance'      && method === 'GET') { await getPayPalBalance(res, ctx); return true; }
    ctx.json(res, 404, { error: `Unknown PayPal route: ${path}` });
    return true;
  };
}
