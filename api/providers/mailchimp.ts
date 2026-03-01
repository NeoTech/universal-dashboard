import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Mailchimp ─────────────────────────────────────────────────────────────────
async function dataMailchimpCampaigns(): Promise<unknown> {
  const apiKey = process.env['MAILCHIMP_API_KEY'];
  if (!apiKey) throw new Error('MAILCHIMP_API_KEY not configured');
  const server = apiKey.split('-').pop() ?? 'us1';
  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const r = await fetch(`https://${server}.api.mailchimp.com/3.0/campaigns?count=25&sort_field=send_time&sort_dir=DESC`, { headers });
  const d = await r.json() as { campaigns?: unknown[]; total_items?: number };
  return { campaigns: d.campaigns ?? [], total_items: d.total_items ?? 0 };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['MAILCHIMP_API_KEY']) {
    ctx.poll('mailchimp-campaigns', parseInt(process.env['MAILCHIMP_POLL_MS'] ?? '300000', 10), dataMailchimpCampaigns);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/mailchimp/')) return false;

    if (path === '/api/mailchimp/campaigns' && method === 'GET') {
      await ctx.route(res, dataMailchimpCampaigns);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Mailchimp route: ${path}` });
    return true;
  };
}
