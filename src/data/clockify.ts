import { fetchResource } from './api';

export interface ClockifyTimeEntry {
  id: string;
  description: string;
  projectId: string;
  projectName?: string;
  userId: string;
  userName?: string;
  timeInterval: {
    start: string;
    end: string | null;
    duration: string | null;
  };
  billable: boolean;
  workspaceId: string;
}

export interface ClockifyProject {
  id: string;
  name: string;
  color: string;
  archived: boolean;
  duration?: string;
  clientName?: string;
}

export function fetchClockifyTimeEntries(): Promise<{ entries: ClockifyTimeEntry[] }> {
  return fetchResource<{ entries: ClockifyTimeEntry[] }>('/api/clockify/time-entries');
}

export function fetchClockifyProjects(): Promise<{ projects: ClockifyProject[] }> {
  return fetchResource<{ projects: ClockifyProject[] }>('/api/clockify/projects');
}
