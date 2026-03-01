import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── HackerNews ────────────────────────────────────────────────────────────────
async function dataHNTopStories(): Promise<unknown> {
  const r = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
  const ids = await r.json() as number[];
  const top = ids.slice(0, 30);
  const stories = await Promise.all(
    top.map((id, rank) =>
      fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
        .then(r2 => r2.json())
        .then((s: unknown) => ({ ...(s as Record<string, unknown>), rank: rank + 1 }))
    )
  );
  return { stories };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  ctx.poll('hn-top-stories', parseInt(process.env['HN_POLL_MS'] ?? '300000', 10), dataHNTopStories); // always on

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/hackernews/')) return false;

    if (path === '/api/hackernews/top-stories' && method === 'GET') {
      await ctx.route(res, dataHNTopStories);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown HackerNews route: ${path}` });
    return true;
  };
}
