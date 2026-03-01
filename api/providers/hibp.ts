import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── HIBP ──────────────────────────────────────────────────────────────────────
async function dataHibpBreaches(): Promise<unknown> {
  const apiKey = process.env['HIBP_API_KEY'];
  const emailsEnv = process.env['HIBP_EMAILS'];
  if (!apiKey || !emailsEnv) throw new Error('HIBP_API_KEY or HIBP_EMAILS not configured');
  const emails = emailsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results: unknown[] = [];
  for (const email of emails) {
    await new Promise(r => setTimeout(r, 1600)); // 1.6s between requests
    const r = await fetch(`https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: { 'hibp-api-key': apiKey, 'User-Agent': 'TWM-Dashboard' },
    });
    if (r.status === 404) { results.push({ email, breaches: [] }); continue; }
    if (!r.ok) continue;
    const breaches = await r.json() as unknown[];
    results.push({ email, breaches });
  }
  return { results };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['HIBP_API_KEY'] && process.env['HIBP_EMAILS']) {
    ctx.poll('hibp-breaches', parseInt(process.env['HIBP_POLL_MS'] ?? '21600000', 10), dataHibpBreaches);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/hibp/')) return false;

    const { route } = ctx;
    if (path === '/api/hibp/breaches' && method === 'GET') { await route(res, dataHibpBreaches); return true; }

    ctx.json(res, 404, { error: `Unknown HIBP route: ${path}` });
    return true;
  };
}
