import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Instatus ──────────────────────────────────────────────────────────────────
async function dataInstatusOverview(): Promise<unknown> {
  const pageId = process.env['INSTATUS_PAGE_ID'];
  const apiKey = process.env['INSTATUS_API_KEY'];
  if (!pageId) throw new Error('INSTATUS_PAGE_ID not configured');
  if (apiKey) {
    // Authenticated API
    const headers = { Authorization: `Bearer ${apiKey}` };
    const [pageRes, componentsRes, incidentsRes] = await Promise.all([
      fetch(`https://api.instatus.com/v1/${pageId}`, { headers }),
      fetch(`https://api.instatus.com/v1/${pageId}/components`, { headers }),
      fetch(`https://api.instatus.com/v1/${pageId}/incidents?status=INVESTIGATING,IDENTIFIED,MONITORING,IN_PROGRESS`, { headers }),
    ]);
    const [page, { components }, { incidents }] = await Promise.all([
      pageRes.json() as Promise<{ id: string; name: string; url: string; status: string }>,
      componentsRes.json() as Promise<{ components?: unknown[] }>,
      incidentsRes.json() as Promise<{ incidents?: unknown[] }>,
    ]);
    return {
      page: { id: page.id, name: page.name, url: page.url, status: page.status },
      components: components ?? [],
      activeIncidents: incidents ?? [],
      activeMaintenances: [],
    };
  } else {
    // Public summary.json
    const r = await fetch(`https://${pageId}.instatus.com/summary.json`);
    const d = await r.json() as {
      page?: { id: string; name: string; url: string; status: { indicator: string } };
      components?: unknown[];
      incidents?: unknown[];
    };
    return {
      page: { id: d.page?.id ?? '', name: d.page?.name ?? '', url: d.page?.url ?? '', status: d.page?.status.indicator ?? 'operational' },
      components: d.components ?? [],
      activeIncidents: d.incidents ?? [],
      activeMaintenances: [],
    };
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['INSTATUS_PAGE_ID']) {
    ctx.poll('instatus-overview', parseInt(process.env['INSTATUS_POLL_MS'] ?? '60000', 10), dataInstatusOverview);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/instatus/')) return false;

    if (path === '/api/instatus/overview' && method === 'GET') {
      await ctx.route(res, dataInstatusOverview);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Instatus route: ${path}` });
    return true;
  };
}
