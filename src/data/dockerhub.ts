import { fetchResource } from './api';

export interface DockerHubRepo {
  namespace: string;
  name: string;
  description: string | null;
  is_private: boolean;
  pull_count: number;
  star_count: number;
  last_updated: string;
  hub_user: string;
}

export interface DockerHubTag {
  name: string;
  full_size: number;
  last_updated: string;
  last_updater_username: string | null;
  images: Array<{ architecture: string; os: string; size: number }>;
}

export function fetchDockerHubRepos(): Promise<{ repos: DockerHubRepo[] }> {
  return fetchResource<{ repos: DockerHubRepo[] }>('/api/dockerhub/repositories');
}

export function fetchDockerHubTags(): Promise<{ tags: DockerHubTag[] }> {
  return fetchResource<{ tags: DockerHubTag[] }>('/api/dockerhub/tags');
}
