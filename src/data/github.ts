/**
 * Browser-side GitHub data client.
 * API calls are proxied through /api/github/* on the TWM API server.
 */

import { fetchResource } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type GitHubRunStatus = 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
export type GitHubRunConclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | null;

export interface GitHubRun {
  id: number;
  name: string;
  workflow_name: string;
  head_branch: string;
  head_sha: string;
  status: GitHubRunStatus;
  conclusion: GitHubRunConclusion;
  repository: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  run_number: number;
  event: string;
}

export interface GitHubActionsResponse {
  total_count: number;
  runs: GitHubRun[];
}

// ── Fetch endpoints ──────────────────────────────────────────────────────────

export function fetchWorkflowRuns(): Promise<GitHubRun[]> {
  return fetchResource<GitHubRun[]>('/api/github/runs');
}
