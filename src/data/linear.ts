import { fetchResource } from './api';

export type LinearIssueState = 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled' | 'triage';
export type LinearIssuePriority = 0 | 1 | 2 | 3 | 4; // 0=none, 1=urgent, 2=high, 3=medium, 4=low

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  priority: LinearIssuePriority;
  state: {
    id: string;
    name: string;
    type: LinearIssueState;
    color: string;
  };
  assignee?: { id: string; name: string; email: string };
  team: { id: string; name: string; key: string };
  createdAt: string;
  updatedAt: string;
  url: string;
  labels: Array<{ id: string; name: string; color: string }>;
}

export function fetchLinearIssues(): Promise<{ issues: LinearIssue[] }> {
  return fetchResource<{ issues: LinearIssue[] }>('/api/linear/issues');
}
