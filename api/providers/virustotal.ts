import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── VirusTotal ────────────────────────────────────────────────────────────────
async function dataVirusTotalAnalyses(): Promise<unknown> {
  const apiKey = process.env['VIRUSTOTAL_API_KEY'];
  const domainsEnv = process.env['VT_DOMAINS'];
  if (!apiKey || !domainsEnv) throw new Error('VIRUSTOTAL_API_KEY or VT_DOMAINS not configured');
  const domains = domainsEnv.split(',').map(s => s.trim()).filter(Boolean);
  const results: unknown[] = [];
  for (const domain of domains) {
    await new Promise(r => setTimeout(r, 15000)); // 15s between requests (4/min limit)
    const r = await fetch(`https://www.virustotal.com/api/v3/domains/${domain}`, {
      headers: { 'x-apikey': apiKey },
    });
    if (!r.ok) continue;
    const d = await r.json() as { data?: { attributes?: Record<string, unknown> } };
    const attrs = d.data?.attributes ?? {};
    results.push({
      domain,
      stats: attrs['last_analysis_stats'] ?? { harmless: 0, malicious: 0, suspicious: 0, undetected: 0, timeout: 0 },
      reputation: attrs['reputation'] ?? 0,
      last_analysis_date: attrs['last_analysis_date'] ?? 0,
      categories: attrs['categories'],
      country: attrs['country'],
    });
  }
  return { results };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['VIRUSTOTAL_API_KEY'] && process.env['VT_DOMAINS']) {
    ctx.poll('virustotal-analyses', parseInt(process.env['VT_POLL_MS'] ?? '86400000', 10), dataVirusTotalAnalyses);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/virustotal/')) return false;

    const { route } = ctx;
    if (path === '/api/virustotal/analyses' && method === 'GET') { await route(res, dataVirusTotalAnalyses); return true; }

    ctx.json(res, 404, { error: `Unknown VirusTotal route: ${path}` });
    return true;
  };
}
