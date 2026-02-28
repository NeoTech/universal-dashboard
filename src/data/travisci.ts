import { fetchResource } from './api';

export interface TravisBuild {
  id: number;
  number: string;
  state: 'created' | 'received' | 'started' | 'passed' | 'failed' | 'errored' | 'canceled';
  result: number | null;
  duration: number | null;
  event_type: string;
  previous_state: string | null;
  pull_request_title: string | null;
  pull_request_number: number | null;
  started_at: string | null;
  finished_at: string | null;
  repository: { id: number; name: string; slug: string };
  branch: { name: string } | null;
  commit: { id: number; sha: string; message: string; compare_url: string; committed_at: string } | null;
}

export function fetchTravisBuilds(): Promise<{ builds: TravisBuild[] }> {
  return fetchResource('/api/travis/builds');
}
