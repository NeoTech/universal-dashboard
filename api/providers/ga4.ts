import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── GA4 ───────────────────────────────────────────────────────────────────────
let _ga4TokenCache: { token: string; expiry: number } | null = null;

async function getGA4AccessToken(): Promise<string> {
  if (_ga4TokenCache && Date.now() < _ga4TokenCache.expiry) return _ga4TokenCache.token;
  const serviceAccountJson = process.env['GA4_SERVICE_ACCOUNT_JSON'];
  if (!serviceAccountJson) throw new Error('GA4_SERVICE_ACCOUNT_JSON not configured');
  const sa = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const encode = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const sigInput = `${headerB64}.${payloadB64}`;
  const keyPem = sa.private_key.replace(/\\n/g, '\n');
  const keyBuffer = Buffer.from(
    keyPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, ''),
    'base64'
  );
  const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBuffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, Buffer.from(sigInput));
  const sigB64 = Buffer.from(sig).toString('base64url');
  const jwt = `${sigInput}.${sigB64}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const tokenData = await tokenRes.json() as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) throw new Error('Failed to get GA4 access token');
  _ga4TokenCache = { token: tokenData.access_token, expiry: Date.now() + (tokenData.expires_in ?? 3600) * 1000 - 60000 };
  return tokenData.access_token;
}

async function dataGA4Sessions(): Promise<unknown> {
  const propertyId = process.env['GA4_PROPERTY_ID'];
  if (!propertyId) throw new Error('GA4_PROPERTY_ID not configured');
  const token = await getGA4AccessToken();
  const r = await fetch(`https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      dimensions: [{ name: 'date' }],
      metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }],
      dateRanges: [{ startDate: '14daysAgo', endDate: 'today' }],
    }),
  });
  const d = await r.json() as { rows?: Array<{ dimensionValues: Array<{ value: string }>; metricValues: Array<{ value: string }> }> };
  const rows = d.rows ?? [];
  const sorted = rows.sort((a, b) => a.dimensionValues[0].value.localeCompare(b.dimensionValues[0].value));
  const dates = sorted.map(r => r.dimensionValues[0].value);
  const sessions = sorted.map(r => parseInt(r.metricValues[0].value));
  const users = sorted.map(r => parseInt(r.metricValues[1].value));
  const pageviews = sorted.map(r => parseInt(r.metricValues[2].value));
  const totals = {
    sessions: sessions.reduce((a, b) => a + b, 0),
    users: users.reduce((a, b) => a + b, 0),
    pageviews: pageviews.reduce((a, b) => a + b, 0),
  };
  return { trend: { dates, sessions, users, pageviews }, totals };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['GA4_SERVICE_ACCOUNT_JSON'] && process.env['GA4_PROPERTY_ID']) {
    ctx.poll('ga4-sessions-trend', parseInt(process.env['GA4_POLL_MS'] ?? '3600000', 10), dataGA4Sessions);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/ga4/')) return false;

    if (path === '/api/ga4/sessions' && method === 'GET') {
      await ctx.route(res, dataGA4Sessions);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown GA4 route: ${path}` });
    return true;
  };
}
