import { fetchResource } from './api';

export interface CircleCIPipeline {
  id: string;
  number: number;
  state: 'created' | 'errored' | 'setup-pending' | 'setup' | 'pending';
  created_at: string;
  updated_at: string;
  trigger: { type: string; received_at: string };
  vcs?: {
    branch?: string;
    tag?: string;
    commit?: { subject: string; body: string };
    origin_repository_url?: string;
    target_repository_url?: string;
    revision?: string;
    provider_name?: string;
    review_url?: string;
    review_id?: string;
  };
  errors: Array<{ type: string; message: string }>;
}

export interface CircleCIWorkflow {
  pipeline_id: string;
  id: string;
  name: string;
  project_slug: string;
  status: 'success' | 'running' | 'not_run' | 'failed' | 'error' | 'failing' | 'on_hold' | 'canceled' | 'unauthorized';
  started_at: string;
  stopped_at: string | null;
  pipeline_number: number;
  created_at: string;
}

export function fetchCircleCIPipelines(): Promise<{ pipelines: CircleCIPipeline[]; workflows: CircleCIWorkflow[] }> {
  return fetchResource('/api/circleci/pipelines');
}

export function fetchCircleCIInsights(): Promise<{ workflows: CircleCIWorkflow[] }> {
  return fetchResource('/api/circleci/insights');
}
