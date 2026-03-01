import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Data fetcher ──────────────────────────────────────────────────────────────
export async function dataVercelDeployments(): Promise<unknown> {
  const token = process.env['VERCEL_TOKEN'];
  if (!token) throw new Error('VERCEL_TOKEN not configured');
  const teamQuery = process.env['VERCEL_TEAM_ID'] ? `&teamId=${process.env['VERCEL_TEAM_ID']}` : '';
  const r = await fetch(`https://api.vercel.com/v6/deployments?limit=20${teamQuery}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await r.json() as { deployments?: unknown[] };
  return data.deployments ?? [];
}

export async function getVercelDeployments(res: ServerResponse, ctx: ServerContext): Promise<void> {
  const token = process.env['VERCEL_TOKEN'];
  if (!token) { ctx.json(res, 503, { error: 'VERCEL_TOKEN not set' }); return; }
  try {
    const data = await dataVercelDeployments();
    ctx.json(res, 200, data);
  } catch (e) {
    ctx.json(res, 502, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['VERCEL_TOKEN']) {
    ctx.poll('vercel-deployments', parseInt(process.env['VERCEL_POLL_MS'] ?? '30000', 10), dataVercelDeployments);
  }

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, body: string): Promise<boolean> => {
    // ── Webhook receive: POST /api/webhooks/vercel ────────────────────────────
    if (path === '/api/webhooks/vercel' && method === 'POST') {
      const secret = process.env['VERCEL_WEBHOOK_SECRET'];
      const sig    = req.headers['x-vercel-signature'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('node:crypto');
        const expected = createHmac('sha1', secret).update(body).digest('hex');
        if (expected !== sig) { ctx.json(res, 400, { error: 'Invalid Vercel signature' }); return true; }
      }
      const eventType = (JSON.parse(body) as { type?: string }).type ?? 'unknown';
      console.log(`  [webhook] vercel  event=${eventType}`);
      const fn = ctx.refreshRegistry.get('vercel-deployments');
      if (fn) { console.log('  [webhook] trigger refresh  vercel-deployments'); void fn(); }
      ctx.json(res, 200, { received: true });
      return true;
    }

    if (!path.startsWith('/api/vercel/')) return false;

    if (path === '/api/vercel/deployments' && method === 'GET') {
      await ctx.route(res, dataVercelDeployments); return true;
    }
    ctx.json(res, 404, { error: `Unknown Vercel route: ${path}` });
    return true;
  };
}
