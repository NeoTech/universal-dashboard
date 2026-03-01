import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Discord ───────────────────────────────────────────────────────────────────
async function dataDiscordServerStats(): Promise<unknown> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  const guildIds = process.env['DISCORD_GUILD_IDS'];
  if (!token) throw new Error('DISCORD_BOT_TOKEN not configured');
  const headers = { Authorization: `Bot ${token}` };
  const ids = guildIds ? guildIds.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (!ids.length) {
    const guildsRes = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers });
    const guilds = await guildsRes.json() as Array<{ id: string }>;
    ids.push(...guilds.slice(0, 5).map(g => g.id));
  }
  const guilds = await Promise.all(
    ids.slice(0, 5).map(id =>
      fetch(`https://discord.com/api/v10/guilds/${id}?with_counts=true`, { headers }).then(r => r.json())
    )
  );
  return { guilds };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['DISCORD_BOT_TOKEN']) {
    ctx.poll('discord-server-stats', parseInt(process.env['DISCORD_POLL_MS'] ?? '300000', 10), dataDiscordServerStats);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/discord/')) return false;

    if (path === '/api/discord/server-stats' && method === 'GET') {
      await ctx.route(res, dataDiscordServerStats);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Discord route: ${path}` });
    return true;
  };
}
