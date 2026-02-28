import { fetchResource } from './api';

export interface BitriseBuild {
  slug: string;
  trigger_summary: string;
  triggered_at: string;
  started_on_worker_at: string | null;
  finished_at: string | null;
  status: 0 | 1 | 2 | 3; // 0=not_finished, 1=success, 2=error, 3=aborted
  status_text: string;
  is_on_hold: boolean;
  branch: string;
  build_number: number;
  commit_hash: string | null;
  commit_message: string | null;
  source_map?: { source: string };
}

export interface BitriseApp {
  slug: string;
  title: string;
  project_type: string;
  provider: string;
  repo_slug: string;
}

export function fetchBitriseBuilds(): Promise<{ builds: BitriseBuild[]; apps: BitriseApp[] }> {
  return fetchResource('/api/bitrise/builds');
}
