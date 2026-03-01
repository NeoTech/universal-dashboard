import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';
import { getAllRedditSubreddits, getRedditMaxFetchLimit } from '../mcp-layout.ts';

// ── Reddit ────────────────────────────────────────────────────────────────────
async function dataRedditPosts(): Promise<unknown> {
  // Collect subreddits from tile configs stored in the DB (across all users/workspaces).
  // Fall back to REDDIT_SUBREDDITS env var only if no tile has a subreddits config.
  const fromTiles = getAllRedditSubreddits();
  const envFallback = process.env['REDDIT_SUBREDDITS'];
  const targets = fromTiles.length > 0
    ? fromTiles
    : envFallback ? envFallback.split(',').map(s => s.trim()).filter(Boolean) : [];
  if (targets.length === 0) {
    console.log('  [reddit] no subreddits configured in any tile — returning empty feed');
    return { posts: [] };
  }
  const headers = { 'User-Agent': 'TWM-Dashboard/1.0' };
  const allPosts: unknown[] = [];
  // Determine how many posts per subreddit based on the highest fetchLimit
  // any reddit tile has set. Reddit API max per request is 100.
  const maxFetch = getRedditMaxFetchLimit();
  const perSub = maxFetch > 0
    ? Math.min(100, Math.ceil(maxFetch / Math.max(1, targets.length)))
    : 25;
  for (const sub of targets) {
    const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=${perSub}`, { headers });
    const d = await r.json() as { data?: { children?: Array<{ data: unknown }> } };
    allPosts.push(...(d.data?.children ?? []).map(c => c.data));
    await new Promise(r2 => setTimeout(r2, 1000));
  }
  return { posts: allPosts };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  // Always register the poller — subreddits are sourced from the tile layout DB at runtime.
  ctx.poll('reddit-posts', parseInt(process.env['REDDIT_POLL_MS'] ?? '300000', 10), dataRedditPosts);

  return async (_req: IncomingMessage, res: ServerResponse, url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/reddit/')) return false;

    const { route } = ctx;
    if (path === '/api/reddit/posts' && method === 'GET') {
      await route(res, () => dataRedditPosts());
      return true;
    }

    ctx.json(res, 404, { error: `Unknown Reddit route: ${path}` });
    return true;
  };
}
