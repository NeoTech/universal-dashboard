import { fetchResource } from './api';

export interface ShodanHost {
  ip_str: string;
  hostnames: string[];
  os: string | null;
  ports: number[];
  vulns?: string[];
  country_name?: string;
  org?: string;
  isp?: string;
  last_update: string;
}

export interface ShodanSearchResult {
  matches: ShodanHost[];
  total: number;
  facets?: Record<string, Array<{ count: number; value: string }>>;
}

export function fetchShodanResults(): Promise<{ results: ShodanSearchResult }> {
  return fetchResource<{ results: ShodanSearchResult }>('/api/shodan/search');
}
