import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── npm ───────────────────────────────────────────────────────────────────────
async function dataNpmDownloads(): Promise<unknown> {
  const pkgsEnv = process.env['NPM_PACKAGES'];
  if (!pkgsEnv) throw new Error('NPM_PACKAGES not configured');
  const packages = pkgsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results = await Promise.all(
    packages.map(async pkg => {
      const r = await fetch(`https://api.npmjs.org/downloads/point/last-month/${encodeURIComponent(pkg)}`);
      const d = await r.json() as { downloads?: number; package?: string; start?: string; end?: string; error?: string };
      if (d.error) return { package: pkg, downloads: 0, period: 'last-month', start: '', end: '' };
      return { package: d.package ?? pkg, downloads: d.downloads ?? 0, period: 'last-month', start: d.start ?? '', end: d.end ?? '' };
    })
  );
  return { packages: results };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['NPM_PACKAGES']) {
    ctx.poll('npm-downloads', parseInt(process.env['NPM_POLL_MS'] ?? '3600000', 10), dataNpmDownloads);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/npm/')) return false;

    if (path === '/api/npm/downloads' && method === 'GET') {
      await ctx.route(res, dataNpmDownloads);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown npm route: ${path}` });
    return true;
  };
}
