import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Shodan ────────────────────────────────────────────────────────────────────
async function dataShodanSearch(): Promise<unknown> {
  const apiKey = process.env['SHODAN_API_KEY'];
  const query = process.env['SHODAN_QUERY'] ?? 'apache';
  if (!apiKey) throw new Error('SHODAN_API_KEY not configured');
  const r = await fetch(`https://api.shodan.io/shodan/host/search?key=${apiKey}&query=${encodeURIComponent(query)}&minify=true`);
  const d = await r.json() as { matches?: unknown[]; total?: number };
  return { results: { matches: d.matches ?? [], total: d.total ?? 0 } };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['SHODAN_API_KEY']) {
    ctx.poll('shodan-search', parseInt(process.env['SHODAN_POLL_MS'] ?? '3600000', 10), dataShodanSearch);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/shodan/')) return false;

    const { route } = ctx;
    if (path === '/api/shodan/search' && method === 'GET') { await route(res, dataShodanSearch); return true; }

    ctx.json(res, 404, { error: `Unknown Shodan route: ${path}` });
    return true;
  };
}
