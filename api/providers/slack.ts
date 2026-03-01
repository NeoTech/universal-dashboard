import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Slack ─────────────────────────────────────────────────────────────────────
async function dataSlackMessages(): Promise<unknown> {
  const token = process.env['SLACK_BOT_TOKEN'];
  const channelsEnv = process.env['SLACK_CHANNELS'];
  if (!token) throw new Error('SLACK_BOT_TOKEN not configured');
  const headers = { Authorization: `Bearer ${token}` };
  const channels = channelsEnv ? channelsEnv.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!channels.length) {
    const listRes = await fetch('https://slack.com/api/conversations.list?limit=5&types=public_channel', { headers });
    const listData = await listRes.json() as { channels?: Array<{ id: string; name: string }> };
    const chans = listData.channels ?? [];
    channels.push(...chans.slice(0, 3).map(c => c.id));
  }
  const allMessages: unknown[] = [];
  for (const channel of channels.slice(0, 3)) {
    const r = await fetch(`https://slack.com/api/conversations.history?channel=${channel}&limit=20`, { headers });
    const d = await r.json() as { messages?: Array<Record<string, unknown>>; ok?: boolean };
    if (d.ok && d.messages) {
      allMessages.push(...d.messages.slice(0, 10).map(m => ({ ...m, channel })));
    }
  }
  return { messages: allMessages.slice(0, 30) };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['SLACK_BOT_TOKEN']) {
    ctx.poll('slack-messages', parseInt(process.env['SLACK_POLL_MS'] ?? '30000', 10), dataSlackMessages);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/slack/')) return false;

    if (path === '/api/slack/messages' && method === 'GET') {
      await ctx.route(res, dataSlackMessages);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Slack route: ${path}` });
    return true;
  };
}
