import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Cloudflare helpers ────────────────────────────────────────────────────────
export function cfHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${process.env['CF_API_TOKEN'] ?? ''}`, 'Content-Type': 'application/json' };
}

export async function cfFetch(path: string, cloudflareApiUrl: string): Promise<unknown> {
  const accountId = process.env['CF_ACCOUNT_ID'] ?? '';
  const base = cloudflareApiUrl.replace(/\/$/, '');
  const r = await fetch(`${base}/accounts/${accountId}${path}`, { headers: cfHeaders() });
  const data = await r.json() as { success: boolean; result: unknown; errors: { message: string }[] };
  if (!data.success) throw new Error(data.errors?.[0]?.message ?? 'Cloudflare API error');
  return data.result;
}

export async function getCFPages(res: ServerResponse, cloudflareApiUrl: string, ctx: ServerContext): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { ctx.json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const projects = await cfFetch('/pages/projects', cloudflareApiUrl);
    ctx.json(res, 200, projects);
  } catch (e) { ctx.json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

export async function getCFPageDeployments(res: ServerResponse, projectName: string, cloudflareApiUrl: string, ctx: ServerContext): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { ctx.json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const deployments = await cfFetch(`/pages/projects/${projectName}/deployments`, cloudflareApiUrl);
    ctx.json(res, 200, deployments);
  } catch (e) { ctx.json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

export async function getCFWorkers(res: ServerResponse, cloudflareApiUrl: string, ctx: ServerContext): Promise<void> {
  const token = process.env['CF_API_TOKEN'];
  if (!token) { ctx.json(res, 503, { error: 'CF_API_TOKEN not configured' }); return; }
  try {
    const scripts = await cfFetch('/workers/scripts', cloudflareApiUrl);
    ctx.json(res, 200, scripts);
  } catch (e) { ctx.json(res, 500, { error: e instanceof Error ? e.message : 'Unknown error' }); }
}

export async function dataCFPages(cloudflareApiUrl: string): Promise<unknown> {
  if (!process.env['CF_API_TOKEN']) throw new Error('CF_API_TOKEN not configured');
  return cfFetch('/pages/projects', cloudflareApiUrl);
}

export async function dataCFWorkers(cloudflareApiUrl: string): Promise<unknown> {
  if (!process.env['CF_API_TOKEN']) throw new Error('CF_API_TOKEN not configured');
  return cfFetch('/workers/scripts', cloudflareApiUrl);
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  const apiUrl = ctx.CLOUDFLARE_API_URL || 'https://api.cloudflare.com/client/v4';

  if (process.env['CF_API_TOKEN'] && process.env['CF_ACCOUNT_ID']) {
    ctx.poll('cf-pages',   parseInt(process.env['CF_PAGES_POLL_MS']   ?? '60000',  10), () => dataCFPages(apiUrl));
    ctx.poll('cf-workers', parseInt(process.env['CF_WORKERS_POLL_MS'] ?? '120000', 10), () => dataCFWorkers(apiUrl));
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/cloudflare/')) return false;

    if (path === '/api/cloudflare/pages' && method === 'GET') {
      await getCFPages(res, apiUrl, ctx); return true;
    }
    if (path === '/api/cloudflare/workers' && method === 'GET') {
      await getCFWorkers(res, apiUrl, ctx); return true;
    }
    // /api/cloudflare/pages/{projectName}/deployments
    const cfMatch = path.match(/^\/api\/cloudflare\/pages\/([^/]+)\/deployments$/);
    if (cfMatch && method === 'GET') {
      await getCFPageDeployments(res, cfMatch[1], apiUrl, ctx); return true;
    }
    ctx.json(res, 404, { error: `Unknown Cloudflare route: ${path}` });
    return true;
  };
}
