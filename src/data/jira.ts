import { fetchResource } from './api';

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string; colorName: string } };
    priority?: { name: string; iconUrl: string };
    issuetype: { name: string; iconUrl: string };
    assignee?: { displayName: string; accountId: string };
    reporter?: { displayName: string; accountId: string };
    created: string;
    updated: string;
    labels: string[];
    fixVersions: Array<{ name: string; released: boolean }>;
  };
  browseUrl?: string;
}

export function fetchJiraIssues(): Promise<{ issues: JiraIssue[]; total: number }> {
  return fetchResource<{ issues: JiraIssue[]; total: number }>('/api/jira/issues');
}
