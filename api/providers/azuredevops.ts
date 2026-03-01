import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Azure DevOps ──────────────────────────────────────────────────────────────
async function dataAzurePipelines(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token) throw new Error('AZURE_DEVOPS_ORG or AZURE_DEVOPS_TOKEN not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const proj = project ? `${project}/` : '';
  const r = await fetch(`https://dev.azure.com/${org}/${proj}_apis/pipelines/runs?api-version=7.0&$top=25`, { headers });
  const d = await r.json() as { value?: unknown[] };
  const runs = (d.value ?? []) as Array<Record<string, unknown>>;
  return { runs: runs.map(run => ({ ...run, project: project ?? org })) };
}

async function dataAzureReleases(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token || !project) throw new Error('AZURE_DEVOPS_ORG, AZURE_DEVOPS_TOKEN, or AZURE_DEVOPS_PROJECT not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const r = await fetch(`https://vsrm.dev.azure.com/${org}/${project}/_apis/release/releases?api-version=7.0&$top=25`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const d = await r.json() as { value?: unknown[] };
  return { releases: (d.value ?? []).map((rel: unknown) => ({ ...(rel as Record<string, unknown>), project })) };
}

async function dataAzureWorkItems(): Promise<unknown> {
  const org = process.env['AZURE_DEVOPS_ORG'];
  const token = process.env['AZURE_DEVOPS_TOKEN'];
  const project = process.env['AZURE_DEVOPS_PROJECT'];
  if (!org || !token || !project) throw new Error('AZURE_DEVOPS_ORG, AZURE_DEVOPS_TOKEN, or AZURE_DEVOPS_PROJECT not configured');
  const auth = Buffer.from(`:${token}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
  const wiqlRes = await fetch(`https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query: "SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.State] != 'Closed' ORDER BY [System.ChangedDate] DESC" }),
  });
  const wiqlData = await wiqlRes.json() as { workItems?: Array<{ id: number }> };
  const ids = (wiqlData.workItems ?? []).slice(0, 25).map(w => w.id);
  if (!ids.length) return { workItems: [] };
  const batchRes = await fetch(`https://dev.azure.com/${org}/${project}/_apis/wit/workitemsbatch?api-version=7.0`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ids, fields: ['System.Id', 'System.Title', 'System.WorkItemType', 'System.State', 'System.AssignedTo', 'System.CreatedDate', 'System.ChangedDate'] }),
  });
  const batchData = await batchRes.json() as { value?: unknown[] };
  return { workItems: batchData.value ?? [] };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['AZURE_DEVOPS_ORG']) {
    const ms = parseInt(process.env['AZURE_POLL_MS'] ?? '60000', 10);
    ctx.poll('azuredevops-pipelines', ms, dataAzurePipelines);
    ctx.poll('azuredevops-releases', ms, dataAzureReleases);
    ctx.poll('azuredevops-workitems', ms, dataAzureWorkItems);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/azuredevops/')) return false;

    if (path === '/api/azuredevops/pipelines' && method === 'GET') {
      await ctx.route(res, dataAzurePipelines);
      return true;
    }
    if (path === '/api/azuredevops/releases' && method === 'GET') {
      await ctx.route(res, dataAzureReleases);
      return true;
    }
    if (path === '/api/azuredevops/workitems' && method === 'GET') {
      await ctx.route(res, dataAzureWorkItems);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown Azure DevOps route: ${path}` });
    return true;
  };
}
