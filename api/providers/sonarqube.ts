import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── SonarQube ─────────────────────────────────────────────────────────────────
async function dataSonarQubeQuality(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const projectsRes = await fetch(`${url}/api/projects/search?ps=50`, { headers });
  const projectsData = await projectsRes.json() as { components?: Array<{ key: string; name: string }> };
  const projects = projectsData.components ?? [];
  const gates = await Promise.all(
    projects.slice(0, 20).map(async p => {
      const gateRes = await fetch(`${url}/api/qualitygates/project_status?projectKey=${p.key}`, { headers });
      const gateData = await gateRes.json() as { projectStatus?: { status: string; conditions?: unknown[] } };
      return {
        projectKey: p.key,
        projectName: p.name,
        status: gateData.projectStatus?.status ?? 'NONE',
        conditions: gateData.projectStatus?.conditions ?? [],
      };
    })
  );
  return { gates };
}

async function dataSonarQubeMeasures(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const metrics = 'bugs,vulnerabilities,code_smells,coverage,duplicated_lines_density';
  const projectsRes = await fetch(`${url}/api/projects/search?ps=10`, { headers });
  const projectsData = await projectsRes.json() as { components?: Array<{ key: string }> };
  const projects = projectsData.components ?? [];
  const measures = await Promise.all(
    projects.slice(0, 5).map(async p => {
      const r = await fetch(`${url}/api/measures/component?component=${p.key}&metricKeys=${metrics}`, { headers });
      const d = await r.json() as { component?: { measures?: unknown[] } };
      return { component: p.key, measures: d.component?.measures ?? [] };
    })
  );
  return { measures };
}

async function dataSonarQubeIssues(): Promise<unknown> {
  const url = process.env['SONARQUBE_URL'];
  const token = process.env['SONARQUBE_TOKEN'];
  if (!url || !token) throw new Error('SONARQUBE_URL or SONARQUBE_TOKEN not configured');
  const auth = Buffer.from(`${token}:`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };
  const r = await fetch(`${url}/api/issues/search?ps=50&statuses=OPEN,CONFIRMED&severities=BLOCKER,CRITICAL,MAJOR`, { headers });
  const d = await r.json() as { issues?: unknown[]; total?: number };
  return { issues: d.issues ?? [], total: d.total ?? 0 };
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['SONARQUBE_URL']) {
    const ms = parseInt(process.env['SONARQUBE_POLL_MS'] ?? '60000', 10);
    ctx.poll('sonarqube-quality', ms, dataSonarQubeQuality);
    ctx.poll('sonarqube-measures', ms, dataSonarQubeMeasures);
    ctx.poll('sonarqube-issues', ms, dataSonarQubeIssues);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/sonarqube/')) return false;

    if (path === '/api/sonarqube/quality' && method === 'GET') {
      await ctx.route(res, dataSonarQubeQuality);
      return true;
    }
    if (path === '/api/sonarqube/measures' && method === 'GET') {
      await ctx.route(res, dataSonarQubeMeasures);
      return true;
    }
    if (path === '/api/sonarqube/issues' && method === 'GET') {
      await ctx.route(res, dataSonarQubeIssues);
      return true;
    }

    ctx.json(res, 404, { error: `Unknown SonarQube route: ${path}` });
    return true;
  };
}
