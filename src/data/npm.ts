import { fetchResource } from './api';

export interface NpmPackageDownloads {
  package: string;
  downloads: number;
  period: string;
  start: string;
  end: string;
}

export interface NpmPackageInfo {
  name: string;
  version: string;
  description: string;
  keywords: string[];
  author?: { name: string };
  license: string;
  downloads?: number;
}

export function fetchNpmDownloads(): Promise<{ packages: NpmPackageDownloads[] }> {
  return fetchResource<{ packages: NpmPackageDownloads[] }>('/api/npm/downloads');
}

export function fetchNpmPackages(): Promise<{ packages: NpmPackageInfo[] }> {
  return fetchResource<{ packages: NpmPackageInfo[] }>('/api/npm/packages');
}
