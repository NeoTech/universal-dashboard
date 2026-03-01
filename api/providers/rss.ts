import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── RSS Feed ─────────────────────────────────────────────────────────────────
const _rssCache = new Map<string, { data: unknown; ts: number }>();
const RSS_CACHE_MS = 5 * 60 * 1000;

function _rssTag(tag: string, chunk: string): string {
  const m = chunk.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i'));
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() : '';
}

async function dataRssFeed(feedUrl: string, maxItems = 50): Promise<unknown> {
  const cacheKey = `${feedUrl}::${maxItems}`;
  const cached = _rssCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < RSS_CACHE_MS) return cached.data;

  const r = await fetch(feedUrl, { headers: { 'User-Agent': 'TWM-Dashboard/1.0' } });
  if (!r.ok) throw new Error(`RSS fetch failed: ${r.status} ${r.statusText}`);
  const xml = await r.text();

  const isAtom = /<feed\b/i.test(xml);
  const itemTag = isAtom ? 'entry' : 'item';
  const feedTitle = _rssTag('title', xml.split(new RegExp(`<${itemTag}[\\s>]`))[0] ?? xml);

  const parts = xml.split(new RegExp(`<${itemTag}[\\s>]`)).slice(1);
  const clampedMax = Math.max(1, Math.min(200, maxItems));
  const items = parts.slice(0, clampedMax).map(part => {
    const chunk = `<${itemTag} ` + part;
    const title = _rssTag('title', chunk);
    // Atom uses <link href="..."/>, RSS uses <link>url</link>
    const linkHref = chunk.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? '';
    const linkText = _rssTag('link', chunk);
    const link = linkHref || linkText;
    const pubDate = _rssTag(isAtom ? 'published' : 'pubDate', chunk) || _rssTag('updated', chunk);
    const summary = _rssTag(isAtom ? 'summary' : 'description', chunk)
      .replace(/<[^>]+>/g, '').trim().slice(0, 220);
    return { title, link, pubDate, summary };
  }).filter(i => i.title);

  const data = { feedTitle: feedTitle || feedUrl, url: feedUrl, items, fetchedAt: new Date().toISOString() };
  _rssCache.set(cacheKey, { data, ts: Date.now() });
  return data;
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(_ctx: ServerContext): ProviderRouteHandler {
  // No poller — RSS is on-demand only

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (path !== '/api/rss/feed') return false;

    if (method === 'GET') {
      const qs = new URL(`http://x${req.url ?? ''}`).searchParams;
      const feedUrl = qs.get('url');
      if (!feedUrl) { _ctx.json(res, 400, { error: 'url query param required' }); return true; }
      const maxItems = parseInt(qs.get('maxItems') ?? '50', 10) || 50;
      try { _ctx.json(res, 200, await dataRssFeed(decodeURIComponent(feedUrl), maxItems)); } catch (e) { _ctx.json(res, 500, { error: String(e) }); }
      return true;
    }
    return false;
  };
}
