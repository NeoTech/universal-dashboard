import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Data fetcher ──────────────────────────────────────────────────────────────
export async function dataNetlifyDeployments(): Promise<unknown> {
  const token = process.env['NETLIFY_TOKEN'];
  if (!token) throw new Error('NETLIFY_TOKEN not configured');
  const headers = { Authorization: `Bearer ${token}` };
  const sitesRes = await fetch('https://api.netlify.com/api/v1/sites?per_page=10', { headers });
  const sites = await sitesRes.json() as Array<{ id: string }>;
  const deployArrays = await Promise.all(
    sites.slice(0, 5).map(s =>
      fetch(`https://api.netlify.com/api/v1/sites/${s.id}/deploys?per_page=5`, { headers })
        .then(r => r.json())
    )
  );
  return (deployArrays as unknown[][]).flat();
}

export async function getNetlifyDeployments(res: ServerResponse, ctx: ServerContext): Promise<void> {
  const token = process.env['NETLIFY_TOKEN'];
  if (!token) { ctx.json(res, 503, { error: 'NETLIFY_TOKEN not set' }); return; }
  try {
    const data = await dataNetlifyDeployments();
    ctx.json(res, 200, data);
  } catch (e) {
    ctx.json(res, 502, { error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['NETLIFY_TOKEN']) {
    ctx.poll('netlify-deployments', parseInt(process.env['NETLIFY_POLL_MS'] ?? '30000', 10), dataNetlifyDeployments);
  }

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, body: string): Promise<boolean> => {
    // ── Webhook receive: POST /api/webhooks/netlify ───────────────────────────
    if (path === '/api/webhooks/netlify' && method === 'POST') {
      const secret = process.env['NETLIFY_WEBHOOK_SECRET'];
      const sig    = req.headers['x-webhook-signature'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('node:crypto');
        const expected = createHmac('sha256', secret).update(body).digest('hex');
        if (expected !== sig) { ctx.json(res, 400, { error: 'Invalid Netlify signature' }); return true; }
      }
      const eventType = (JSON.parse(body) as { event?: string }).event ?? 'unknown';
      console.log(`  [webhook] netlify event=${eventType}`);
      const fn = ctx.refreshRegistry.get('netlify-deployments');
      if (fn) { console.log('  [webhook] trigger refresh  netlify-deployments'); void fn(); }
      ctx.json(res, 200, { received: true });
      return true;
    }

    if (!path.startsWith('/api/netlify/')) return false;

    if (path === '/api/netlify/deployments' && method === 'GET') {
      await ctx.route(res, dataNetlifyDeployments); return true;
    }
    ctx.json(res, 404, { error: `Unknown Netlify route: ${path}` });
    return true;
  };
}
