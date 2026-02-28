/**
 * Browser-side Cloudflare data client.
 * Proxied through /api/cloudflare/* on the TWM API server.
 */

import { fetchResource } from './api';

// ── Cloudflare Pages types ────────────────────────────────────────────────────

export interface CFPagesDeployment {
  id: string;
  url: string;
  environment: 'production' | 'preview';
  created_on: string;
  modified_on: string;
  short_id: string;
  latest_stage: {
    name: string;
    status: 'idle' | 'active' | 'canceled' | 'success' | 'failure';
    ended_on: string | null;
  };
  deployment_trigger: {
    metadata: {
      commit_message: string;
      commit_hash: string;
      branch: string;
    } | null;
  };
}

export interface CFPagesProject {
  id: string;
  name: string;
  subdomain: string;
  domains: string[];
  production_branch: string;
  latest_deployment: CFPagesDeployment | null;
  created_on: string;
  modified_on: string;
}

// ── Cloudflare Workers types ──────────────────────────────────────────────────

export interface CFWorkerScript {
  id: string;
  etag: string;
  handlers: string[];
  modified_on: string;
  created_on: string;
  migration_tag?: string;
  usage_model: 'bundled' | 'unbound' | string;
  last_deployed_from?: string;
  routes?: Array<{ id: string; pattern: string }>;
}

// ── Fetch endpoints ──────────────────────────────────────────────────────────

export function fetchCFPagesProjects(): Promise<CFPagesProject[]> {
  return fetchResource<CFPagesProject[]>('/api/cloudflare/pages');
}

export function fetchCFPageDeployments(projectName: string): Promise<CFPagesDeployment[]> {
  return fetchResource<CFPagesDeployment[]>(`/api/cloudflare/pages/${projectName}/deployments`);
}

export function fetchCFWorkers(): Promise<CFWorkerScript[]> {
  return fetchResource<CFWorkerScript[]>('/api/cloudflare/workers');
}
