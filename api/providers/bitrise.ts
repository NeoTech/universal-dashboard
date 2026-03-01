import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Bitrise ───────────────────────────────────────────────────────────────────
async function dataBitriseBuilds(): Promise<unknown> {
  const token = process.env['BITRISE_TOKEN'];
  if (!token) throw new Error('BITRISE_TOKEN not configured');
  const headers = { Authorization: `token ${token}` };
  const appsRes = await fetch('https://api.bitrise.io/v0.1/apps?limit=10', { headers });
  const appsData = await appsRes.json() as { data?: Array<{ slug: string }> };
  const apps = appsData.data ?? [];
  if (!apps.length) return { builds: [], apps: [] };
  const buildArrays = await Promise.all(
    apps.slice(0, 3).map(app =>
      fetch(`https://api.bitrise.io/v0.1/apps/${app.slug}/builds?limit=10`, { headers })
        .then(r => r.json())
        .then((d: { data?: unknown[] }) => d.data ?? [])
    )
  );
  return { builds: (buildArrays as unknown[][]).flat(), apps };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['BITRISE_TOKEN']) {
    const ms = parseInt(process.env['BITRISE_POLL_MS'] ?? '60000', 10);
    ctx.poll('bitrise-builds', ms, dataBitriseBuilds);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/bitrise/')) return false;

    if (path === '/api/bitrise/builds' && method === 'GET') {
      await ctx.route(res, dataBitriseBuilds);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown Bitrise route: ${path}` });
    return true;
  };
}
