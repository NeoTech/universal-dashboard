import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── jsDelivr ──────────────────────────────────────────────────────────────────
async function dataJsDelivrStats(): Promise<unknown> {
  const pkgsEnv = process.env['JSDELIVR_PACKAGES'];
  if (!pkgsEnv) throw new Error('JSDELIVR_PACKAGES not configured');
  const packages = pkgsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(
    packages.map(async pkg => {
      const [type, name] = pkg.startsWith('gh/') ? ['gh', pkg.slice(3)] : ['npm', pkg];
      const r = await fetch(`https://data.jsdelivr.com/v1/stats/packages/${type}/${encodeURIComponent(name)}/year`);
      const d = await r.json() as { hits?: { total?: number; dates?: Record<string, number> }; bandwidth?: { total?: number; dates?: Record<string, number> } };
      return {
        name,
        type,
        hits: { total: d.hits?.total ?? 0, dates: d.hits?.dates ?? {} },
        bandwidth: { total: d.bandwidth?.total ?? 0, dates: d.bandwidth?.dates ?? {} },
      };
    })
  );
  return { packages: results };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['JSDELIVR_PACKAGES']) {
    ctx.poll('jsdelivr-hits', parseInt(process.env['JSDELIVR_POLL_MS'] ?? '3600000', 10), dataJsDelivrStats);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/jsdelivr/')) return false;

    if (path === '/api/jsdelivr/hits' && method === 'GET') {
      await ctx.route(res, dataJsDelivrStats);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown jsDelivr route: ${path}` });
    return true;
  };
}
