import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Clockify ──────────────────────────────────────────────────────────────────
async function dataClockifyTimeEntries(): Promise<unknown> {
  const apiKey = process.env['CLOCKIFY_API_KEY'];
  const workspaceId = process.env['CLOCKIFY_WORKSPACE_ID'];
  const userId = process.env['CLOCKIFY_USER_ID'];
  if (!apiKey || !workspaceId) throw new Error('CLOCKIFY_API_KEY or CLOCKIFY_WORKSPACE_ID not configured');
  const headers = { 'X-Api-Key': apiKey };
  let uid = userId;
  if (!uid) {
    const meRes = await fetch('https://api.clockify.me/api/v1/user', { headers });
    const me = await meRes.json() as { id: string };
    uid = me.id;
  }
  const r = await fetch(`https://api.clockify.me/api/v1/workspaces/${workspaceId}/user/${uid}/time-entries?page-size=50`, { headers });
  const entries = await r.json() as unknown[];
  const projectNames = new Map<string, string>();
  const entriesWithNames = await Promise.all(
    (entries as Array<Record<string, unknown>>).slice(0, 20).map(async e => {
      const projId = e['projectId'] as string | undefined;
      if (projId && !projectNames.has(projId)) {
        try {
          const proj = await fetch(`https://api.clockify.me/api/v1/workspaces/${workspaceId}/projects/${projId}`, { headers });
          const projData = await proj.json() as { name: string };
          projectNames.set(projId, projData.name);
        } catch { /* skip */ }
      }
      return { ...e, projectName: projId ? projectNames.get(projId) : undefined };
    })
  );
  return { entries: entriesWithNames };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['CLOCKIFY_API_KEY'] && process.env['CLOCKIFY_WORKSPACE_ID']) {
    ctx.poll('clockify-time-entries', parseInt(process.env['CLOCKIFY_POLL_MS'] ?? '300000', 10), dataClockifyTimeEntries);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string, _body: string): Promise<boolean> => {
    if (!path.startsWith('/api/clockify/')) return false;

    if (path === '/api/clockify/time-entries' && method === 'GET') {
      await ctx.route(res, dataClockifyTimeEntries);
      return true;
    }
    ctx.json(res, 404, { error: `Unknown Clockify route: ${path}` });
    return true;
  };
}
