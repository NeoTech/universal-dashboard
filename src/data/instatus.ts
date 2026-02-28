import { fetchResource } from './api';

export type InstatusComponentStatus = 'operational' | 'under_maintenance' | 'degraded_performance' | 'partial_outage' | 'major_outage' | 'unknown';
export type InstatusIncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'scheduled' | 'in_progress';

export interface InstatusComponent {
  id: string;
  name: string;
  status: InstatusComponentStatus;
  description?: string;
  order: number;
  showcaseOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InstatusIncident {
  id: string;
  name: string;
  status: InstatusIncidentStatus;
  started: string;
  resolved: string | null;
  impact: 'operational' | 'degraded_performance' | 'partial_outage' | 'major_outage';
  updates: Array<{ id: string; body: string; status: InstatusIncidentStatus; createdAt: string }>;
}

export interface InstatusOverview {
  page: { id: string; name: string; url: string; status: InstatusComponentStatus };
  components: InstatusComponent[];
  activeIncidents: InstatusIncident[];
  activeMaintenances: InstatusIncident[];
}

export function fetchInstatusOverview(): Promise<InstatusOverview> {
  return fetchResource<InstatusOverview>('/api/instatus/overview');
}
