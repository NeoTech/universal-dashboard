import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Reddit ────────────────────────────────────────────────────────────────────
async function dataRedditPosts(): Promise<unknown> {
  const subredditsEnv = process.env['REDDIT_SUBREDDITS'];
  const keywordsEnv = process.env['REDDIT_KEYWORDS'];
  if (!subredditsEnv && !keywordsEnv) throw new Error('REDDIT_SUBREDDITS or REDDIT_KEYWORDS not configured');
  const headers = { 'User-Agent': 'TWM-Dashboard/1.0' };
  const allPosts: unknown[] = [];
  if (subredditsEnv) {
    const subreddits = subredditsEnv.split(',').map(s => s.trim()).filter(Boolean);
    for (const sub of subreddits.slice(0, 3)) {
      const r = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, { headers });
      const d = await r.json() as { data?: { children?: Array<{ data: unknown }> } };
      allPosts.push(...(d.data?.children ?? []).map(c => c.data));
      await new Promise(r2 => setTimeout(r2, 1000));
    }
  }
  return { posts: allPosts.slice(0, 40) };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['REDDIT_SUBREDDITS'] || process.env['REDDIT_KEYWORDS']) {
    ctx.poll('reddit-posts', parseInt(process.env['REDDIT_POLL_MS'] ?? '300000', 10), dataRedditPosts);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/reddit/')) return false;

    const { route } = ctx;
    if (path === '/api/reddit/posts' && method === 'GET') { await route(res, dataRedditPosts); return true; }

    ctx.json(res, 404, { error: `Unknown Reddit route: ${path}` });
    return true;
  };
}
