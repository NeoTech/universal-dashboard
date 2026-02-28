/**
 * Netlify data client — SCAFFOLDED, not yet implemented.
 * When implemented, set NETLIFY_TOKEN in .env and fill in the API calls.
 */

import { fetchResource } from './api';

export interface NetlifyDeploy {
  id: string;
  site_id: string;
  site_name: string;
  state: 'new' | 'pending_review' | 'enqueued' | 'building' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'error' | 'rejected';
  name: string;
  url: string;
  deploy_url: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  context: 'production' | 'deploy-preview' | 'branch-deploy';
  branch: string;
  commit_ref?: string;
  commit_url?: string;
  committer?: string;
  title?: string;
  error_message?: string;
}

export function fetchNetlifyDeployments(): Promise<NetlifyDeploy[]> {
  return fetchResource<NetlifyDeploy[]>('/api/netlify/deployments');
}
