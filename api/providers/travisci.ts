import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Travis CI ─────────────────────────────────────────────────────────────────
async function dataTravisBuilds(): Promise<unknown> {
  const token = process.env['TRAVIS_TOKEN'];
  const org = process.env['TRAVIS_ORG'];
  if (!token || !org) throw new Error('TRAVIS_TOKEN or TRAVIS_ORG not configured');
  const r = await fetch(`https://api.travis-ci.com/v3/owner/${org}/builds?limit=25&include=build.repository,build.branch,build.commit`, {
    headers: { 'Travis-API-Version': '3', 'Authorization': `token ${token}` },
  });
  const data = await r.json() as { builds?: unknown[] };
  return { builds: data.builds ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['TRAVIS_TOKEN']) {
    const ms = parseInt(process.env['TRAVIS_POLL_MS'] ?? '60000', 10);
    ctx.poll('travis-builds', ms, dataTravisBuilds);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/travis/')) return false;

    if (path === '/api/travis/builds' && method === 'GET') {
      await ctx.route(res, dataTravisBuilds);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown Travis CI route: ${path}` });
    return true;
  };
}
