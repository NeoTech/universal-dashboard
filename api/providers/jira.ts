import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Jira ──────────────────────────────────────────────────────────────────────
async function dataJiraIssues(): Promise<unknown> {
  const host = process.env['JIRA_HOST'];
  const email = process.env['JIRA_EMAIL'];
  const token = process.env['JIRA_API_TOKEN'];
  const jql = process.env['JIRA_JQL'] ?? 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC';
  if (!host || !email || !token) throw new Error('JIRA_HOST, JIRA_EMAIL, or JIRA_API_TOKEN not configured');
  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const r = await fetch(`https://${host}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary,status,priority,issuetype,assignee,reporter,created,updated,labels,fixVersions`, {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  });
  const d = await r.json() as { issues?: unknown[]; total?: number };
  const issues = ((d.issues ?? []) as Array<Record<string, unknown>>).map(issue => ({
    ...issue,
    browseUrl: `https://${host}/browse/${issue['key'] as string}`,
  }));
  return { issues, total: d.total ?? 0 };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['JIRA_HOST'] && process.env['JIRA_EMAIL'] && process.env['JIRA_API_TOKEN']) {
    ctx.poll('jira-issues', parseInt(process.env['JIRA_POLL_MS'] ?? '120000', 10), dataJiraIssues);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/jira/')) return false;

    if (path === '/api/jira/issues' && method === 'GET') {
      await ctx.route(res, dataJiraIssues);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Jira route: ${path}` });
    return true;
  };
}
