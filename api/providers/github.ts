import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Module-level rate-limit cache ─────────────────────────────────────────────
/** Last successful github-runs payload — served stale on rate-limit errors. */
let _ghRunsCache: unknown = null;
/** Epoch ms when the GitHub rate limit resets; 0 = not known / not limited. */
let _ghRateLimitResetAt = 0;

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GHApiRun {
  id: number; name: string; head_branch: string; head_sha: string;
  run_number: number; event: string; status: string; conclusion: string | null;
  html_url: string; created_at: string; updated_at: string; display_title?: string;
  repository: { full_name: string };
}

export function normalizeGHRun(r: GHApiRun) {
  return {
    id: r.id, name: r.display_title ?? r.name, workflow_name: r.name,
    head_branch: r.head_branch, head_sha: r.head_sha, run_number: r.run_number,
    event: r.event, status: r.status, conclusion: r.conclusion,
    repository: r.repository.full_name, html_url: r.html_url,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

/**
 * Run `tasks` in batches of `concurrency` at a time, in order.
 * Avoids blasting the GitHub API with 100 simultaneous requests.
 */
export async function batchConcurrent<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += concurrency) {
    const slice = tasks.slice(i, i + concurrency).map((fn) => fn());
    results.push(...await Promise.all(slice));
  }
  return results;
}

export async function fetchGithubRunsForUser(token: string, user: string, githubApiUrl: string): Promise<GHApiRun[]> {
  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'TWM-API/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  const reposRes = await fetch(`${githubApiUrl}/users/${user}/repos?type=owner&per_page=100`, { headers: ghHeaders });
  if (!reposRes.ok) {
    if (reposRes.status === 403 || reposRes.status === 429) {
      const reset = Number(reposRes.headers.get('x-ratelimit-reset') ?? '0');
      if (reset) _ghRateLimitResetAt = reset * 1000;
      throw new Error(`GitHub rate limit (repos list) — resets at ${new Date(_ghRateLimitResetAt).toISOString()}`);
    }
    throw new Error(await reposRes.text());
  }
  // Track remaining quota from headers.
  const remaining = Number(reposRes.headers.get('x-ratelimit-remaining') ?? '-1');
  const reset = Number(reposRes.headers.get('x-ratelimit-reset') ?? '0');
  if (reset) _ghRateLimitResetAt = reset * 1000;

  const repos = await reposRes.json() as { full_name: string }[];
  const capped = repos.slice(0, 50); // cap at 50 repos to preserve quota

  // Warn early if we're close to the limit before firing per-repo requests.
  if (remaining >= 0 && remaining < capped.length + 10) {
    console.warn(`  [github] only ${remaining} API calls remaining — skipping per-repo run fetches to avoid rate limit`);
    return [];
  }

  const tasks = capped.map((repo) => async () => {
    const r = await fetch(`${githubApiUrl}/repos/${repo.full_name}/actions/runs?per_page=10`, { headers: ghHeaders });
    if (!r.ok) {
      if (r.status === 403 || r.status === 429) {
        const rs = Number(r.headers.get('x-ratelimit-reset') ?? '0');
        if (rs) _ghRateLimitResetAt = rs * 1000;
        throw new Error(`GitHub rate limit hit on ${repo.full_name}`);
      }
      return [] as GHApiRun[];
    }
    const body = await r.json() as { workflow_runs?: GHApiRun[] };
    return body.workflow_runs ?? [] as GHApiRun[];
  });

  // Fetch 5 repos at a time to stay well within burst limits.
  const runArrays = await batchConcurrent(tasks, 5);
  return runArrays.flat().sort((a, b) => b.run_number - a.run_number).slice(0, 50);
}

export async function dataGithubRuns(githubApiUrl: string): Promise<unknown> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token || token.startsWith('ghp_your')) throw new Error('GITHUB_TOKEN not configured');
  const org  = process.env['GITHUB_ORG'];
  const user = process.env['GITHUB_USER'];
  if (!org && !user) throw new Error('Set GITHUB_ORG or GITHUB_USER in .env');

  // If we know the rate limit hasn't reset yet, return cached data immediately.
  if (_ghRateLimitResetAt > 0 && Date.now() < _ghRateLimitResetAt) {
    const waitSec = Math.ceil((_ghRateLimitResetAt - Date.now()) / 1000);
    console.warn(`  [github] rate-limited — skipping fetch, resets in ${waitSec}s  (serving cached data)`);
    if (_ghRunsCache) return _ghRunsCache;
    throw new Error(`GitHub rate limit active, resets in ${waitSec}s`);
  }

  const ghHeaders = { Authorization: `Bearer ${token}`, 'User-Agent': 'TWM-API/1.0', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    let runs: unknown;
    if (org) {
      const apiUrl = `${githubApiUrl}/orgs/${org}/actions/runs?per_page=50`;
      const ghRes = await fetch(apiUrl, { headers: ghHeaders });
      if (!ghRes.ok) {
        if (ghRes.status === 403 || ghRes.status === 429) {
          const reset = Number(ghRes.headers.get('x-ratelimit-reset') ?? '0');
          if (reset) _ghRateLimitResetAt = reset * 1000;
          const waitSec = reset ? Math.ceil((reset * 1000 - Date.now()) / 1000) : '?';
          console.warn(`  [github] rate limit hit (org runs) — resets in ${waitSec}s`);
          if (_ghRunsCache) { console.warn('  [github] serving stale cache'); return _ghRunsCache; }
        }
        throw new Error(await ghRes.text());
      }
      const body = await ghRes.json() as { workflow_runs: GHApiRun[] };
      runs = (body.workflow_runs ?? []).map(normalizeGHRun);
    } else {
      const rawRuns = await fetchGithubRunsForUser(token, user!, githubApiUrl);
      runs = rawRuns.map(normalizeGHRun);
    }
    _ghRunsCache = runs; // update cache on success
    _ghRateLimitResetAt = 0; // clear any previous rate-limit timer
    return runs;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if ((msg.includes('rate limit') || msg.includes('403')) && _ghRunsCache) {
      console.warn(`  [github] error — ${msg}  (serving stale cache)`);
      return _ghRunsCache;
    }
    throw e;
  }
}

async function getGitHubRuns(res: ServerResponse, githubApiUrl: string, ctx: ServerContext): Promise<void> {
  const token = process.env['GITHUB_TOKEN'];
  if (!token || token.startsWith('ghp_your')) { ctx.json(res, 503, { error: 'GITHUB_TOKEN not configured' }); return; }
  const org  = process.env['GITHUB_ORG'];
  const user = process.env['GITHUB_USER'];
  if (!org && !user) { ctx.json(res, 503, { error: 'Set GITHUB_ORG or GITHUB_USER in .env' }); return; }
  try {
    const runs = await dataGithubRuns(githubApiUrl);
    ctx.json(res, 200, runs);
  } catch (err) {
    ctx.json(res, 503, { error: err instanceof Error ? err.message : String(err) });
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  const githubApiUrl = ctx.GITHUB_API_URL || 'https://api.github.com';

  if (process.env['GITHUB_TOKEN'] && (process.env['GITHUB_ORG'] || process.env['GITHUB_USER'])) {
    ctx.poll('github-runs', parseInt(process.env['GITHUB_POLL_MS'] ?? '30000', 10), () => dataGithubRuns(githubApiUrl));
  }

  return async (req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, body: string): Promise<boolean> => {
    // ── Webhook receive: POST /api/webhooks/github ────────────────────────────
    if (path === '/api/webhooks/github' && method === 'POST') {
      const secret = process.env['GITHUB_WEBHOOK_SECRET'];
      const sig    = req.headers['x-hub-signature-256'] as string | undefined;
      if (secret && sig) {
        const { createHmac } = await import('node:crypto');
        const expected = 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
        if (expected !== sig) { ctx.json(res, 400, { error: 'Invalid GitHub signature' }); return true; }
      }
      const event = req.headers['x-github-event'] as string | undefined;
      console.log(`  [webhook] github  event=${event ?? 'unknown'}`);
      const fn = ctx.refreshRegistry.get('github-runs');
      if (fn) { console.log('  [webhook] trigger refresh  github-runs'); void fn(); }
      ctx.json(res, 200, { received: true });
      return true;
    }

    if (!path.startsWith('/api/github/')) return false;

    if (path === '/api/github/runs' && method === 'GET') {
      await getGitHubRuns(res, githubApiUrl, ctx); return true;
    }
    ctx.json(res, 404, { error: `Unknown GitHub route: ${path}` });
    return true;
  };
}
