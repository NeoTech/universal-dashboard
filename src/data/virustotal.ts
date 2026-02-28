import { fetchResource } from './api';

export interface VirusTotalAnalysis {
  domain: string;
  stats: {
    harmless: number;
    malicious: number;
    suspicious: number;
    undetected: number;
    timeout: number;
  };
  reputation: number;
  last_analysis_date: number;
  categories?: Record<string, string>;
  country?: string;
  last_https_certificate_date?: number;
}

export function fetchVirusTotalAnalyses(): Promise<{ results: VirusTotalAnalysis[] }> {
  return fetchResource<{ results: VirusTotalAnalysis[] }>('/api/virustotal/analyses');
}
