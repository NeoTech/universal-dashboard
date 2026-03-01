import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── CircleCI ──────────────────────────────────────────────────────────────────
async function dataCircleCIPipelines(): Promise<unknown> {
  const token = process.env['CIRCLECI_TOKEN'];
  const orgSlug = process.env['CIRCLECI_ORG_SLUG'];
  if (!token || !orgSlug) throw new Error('CIRCLECI_TOKEN or CIRCLECI_ORG_SLUG not configured');
  const r = await fetch(`https://circleci.com/api/v2/pipeline?org-slug=${orgSlug}&mine=false`, {
    headers: { 'Circle-Token': token },
  });
  const data = await r.json() as { items?: unknown[] };
  const pipelines = data.items ?? [];
  const workflowResults = await Promise.all(
    (pipelines as Array<{ id: string }>).slice(0, 10).map(p =>
      fetch(`https://circleci.com/api/v2/pipeline/${p.id}/workflow`, { headers: { 'Circle-Token': token } })
        .then(r2 => r2.json())
        .then((d: { items?: unknown[] }) => d.items ?? [])
    )
  );
  return { pipelines, workflows: workflowResults.flat() };
}

async function dataCircleCIInsights(): Promise<unknown> {
  const token = process.env['CIRCLECI_TOKEN'];
  const orgSlug = process.env['CIRCLECI_ORG_SLUG'];
  if (!token || !orgSlug) throw new Error('CIRCLECI_TOKEN or CIRCLECI_ORG_SLUG not configured');
  const r = await fetch(`https://circleci.com/api/v2/insights/${orgSlug}/workflows?reporting-window=last-30-days`, {
    headers: { 'Circle-Token': token },
  });
  const data = await r.json() as { items?: unknown[] };
  return { insights: data.items ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['CIRCLECI_TOKEN']) {
    const ms = parseInt(process.env['CIRCLECI_POLL_MS'] ?? '60000', 10);
    ctx.poll('circleci-pipelines', ms, dataCircleCIPipelines);
    ctx.poll('circleci-insights', ms, dataCircleCIInsights);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/circleci/')) return false;

    if (path === '/api/circleci/pipelines' && method === 'GET') {
      await ctx.route(res, dataCircleCIPipelines);
      return true;
    }
    if (path === '/api/circleci/insights' && method === 'GET') {
      await ctx.route(res, dataCircleCIInsights);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown CircleCI route: ${path}` });
    return true;
  };
}
