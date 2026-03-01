import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Docker Hub ────────────────────────────────────────────────────────────────
async function dataDockerHubRepos(): Promise<unknown> {
  const username = process.env['DOCKERHUB_USERNAME'];
  if (!username) throw new Error('DOCKERHUB_USERNAME not configured');
  const token = process.env['DOCKERHUB_TOKEN'];
  const headers: Record<string, string> = {};
  if (token) {
    // Get JWT via login
    const loginRes = await fetch('https://hub.docker.com/v2/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: token }),
    });
    const loginData = await loginRes.json() as { token?: string };
    if (loginData.token) headers['Authorization'] = `Bearer ${loginData.token}`;
  }
  const r = await fetch(`https://hub.docker.com/v2/repositories/${username}/?page_size=25`, { headers });
  const data = await r.json() as { results?: unknown[] };
  return { repos: data.results ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['DOCKERHUB_USERNAME']) {
    const ms = parseInt(process.env['DOCKERHUB_POLL_MS'] ?? '60000', 10);
    ctx.poll('dockerhub-repositories', ms, dataDockerHubRepos);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/dockerhub/')) return false;

    if (path === '/api/dockerhub/repositories' && method === 'GET') {
      await ctx.route(res, dataDockerHubRepos);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown Docker Hub route: ${path}` });
    return true;
  };
}
