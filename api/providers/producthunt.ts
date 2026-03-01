import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Product Hunt ──────────────────────────────────────────────────────────────
async function dataProductHuntLaunches(): Promise<unknown> {
  const token = process.env['PRODUCTHUNT_API_TOKEN'];
  if (!token) throw new Error('PRODUCTHUNT_API_TOKEN not configured');
  const query = `
    query {
      posts(order: VOTES, first: 20) {
        edges {
          node {
            id name tagline description votesCount commentsCount
            createdAt featuredAt url website
            thumbnail { url }
            topics { edges { node { name } } }
            user { name username }
          }
        }
      }
    }
  `;
  const r = await fetch('https://api.producthunt.com/v2/api/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json() as { data?: { posts?: { edges?: Array<{ node: unknown }> } } };
  const posts = (d.data?.posts?.edges ?? []).map(e => e.node);
  return { posts };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['PRODUCTHUNT_API_TOKEN']) {
    ctx.poll('producthunt-top-launches', parseInt(process.env['PH_POLL_MS'] ?? '3600000', 10), dataProductHuntLaunches);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/producthunt/')) return false;

    const { route } = ctx;
    if (path === '/api/producthunt/launches' && method === 'GET') { await route(res, dataProductHuntLaunches); return true; }

    ctx.json(res, 404, { error: `Unknown Product Hunt route: ${path}` });
    return true;
  };
}
