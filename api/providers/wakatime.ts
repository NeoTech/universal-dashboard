import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── WakaTime ──────────────────────────────────────────────────────────────────
async function dataWakaTimeSummary(): Promise<unknown> {
  const apiKey = process.env['WAKATIME_API_KEY'];
  if (!apiKey) throw new Error('WAKATIME_API_KEY not configured');
  const auth = Buffer.from(apiKey).toString('base64');
  const r = await fetch('https://wakatime.com/api/v1/users/current/summaries?range=last_7_days', {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as { data?: unknown[] };
  return { data: d.data ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['WAKATIME_API_KEY']) {
    ctx.poll('wakatime-summary', parseInt(process.env['WAKATIME_POLL_MS'] ?? '300000', 10), dataWakaTimeSummary);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/wakatime/')) return false;

    if (path === '/api/wakatime/summary' && method === 'GET') {
      await ctx.route(res, dataWakaTimeSummary);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown WakaTime route: ${path}` });
    return true;
  };
}
