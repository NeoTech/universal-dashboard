import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Linear ────────────────────────────────────────────────────────────────────
async function dataLinearIssues(): Promise<unknown> {
  const apiKey = process.env['LINEAR_API_KEY'];
  if (!apiKey) throw new Error('LINEAR_API_KEY not configured');
  const query = `
    query {
      issues(first: 50, orderBy: updatedAt, filter: { state: { type: { nin: ["completed", "cancelled"] } } }) {
        nodes {
          id identifier title priority
          state { id name type color }
          assignee { id name email }
          team { id name key }
          createdAt updatedAt url
          labels { nodes { id name color } }
        }
      }
    }
  `;
  const r = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const d = await r.json() as { data?: { issues?: { nodes?: unknown[] } } };
  const raw = d.data?.issues?.nodes ?? [];
  const issues = (raw as Array<Record<string, unknown>>).map(i => ({
    ...i,
    labels: ((i['labels'] as { nodes?: unknown[] } | undefined)?.nodes ?? []),
  }));
  return { issues };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['LINEAR_API_KEY']) {
    ctx.poll('linear-issues', parseInt(process.env['LINEAR_POLL_MS'] ?? '120000', 10), dataLinearIssues);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/linear/')) return false;

    if (path === '/api/linear/issues' && method === 'GET') {
      await ctx.route(res, dataLinearIssues);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Linear route: ${path}` });
    return true;
  };
}
