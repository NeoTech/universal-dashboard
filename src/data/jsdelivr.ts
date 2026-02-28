import { fetchResource } from './api';

export interface JsDelivrPackageStats {
  name: string;
  type: 'npm' | 'gh';
  hits: {
    total: number;
    dates: Record<string, number>;
  };
  bandwidth: {
    total: number;
    dates: Record<string, number>;
  };
}

export function fetchJsDelivrStats(): Promise<{ packages: JsDelivrPackageStats[] }> {
  return fetchResource<{ packages: JsDelivrPackageStats[] }>('/api/jsdelivr/stats');
}
