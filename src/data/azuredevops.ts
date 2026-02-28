import { fetchResource } from './api';

export interface AzurePipelineRun {
  id: number;
  name: string;
  state: 'unknown' | 'inProgress' | 'canceling' | 'completed';
  result: 'unknown' | 'succeeded' | 'failed' | 'canceled' | null;
  createdDate: string;
  finishedDate: string | null;
  pipeline: { id: number; name: string; folder: string };
  project: string;
  _links: { web: { href: string } };
}

export interface AzureRelease {
  id: number;
  name: string;
  status: 'abandoned' | 'active' | 'draft' | 'undefined';
  createdOn: string;
  modifiedOn: string;
  releaseDefinition: { id: number; name: string };
  project: string;
  environments: Array<{
    id: number;
    name: string;
    status: 'notDeployed' | 'inProgress' | 'succeeded' | 'failed' | 'canceled' | 'rejected' | 'queued';
  }>;
}

export interface AzureWorkItem {
  id: number;
  fields: {
    'System.Title': string;
    'System.WorkItemType': string;
    'System.State': string;
    'System.AssignedTo'?: { displayName: string };
    'System.CreatedDate': string;
    'System.ChangedDate': string;
  };
  url: string;
}

export function fetchAzurePipelines(): Promise<{ runs: AzurePipelineRun[] }> {
  return fetchResource<{ runs: AzurePipelineRun[] }>('/api/azuredevops/pipelines');
}

export function fetchAzureReleases(): Promise<{ releases: AzureRelease[] }> {
  return fetchResource<{ releases: AzureRelease[] }>('/api/azuredevops/releases');
}

export function fetchAzureWorkItems(): Promise<{ workItems: AzureWorkItem[] }> {
  return fetchResource<{ workItems: AzureWorkItem[] }>('/api/azuredevops/workitems');
}
