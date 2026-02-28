/**
 * Vercel data client — SCAFFOLDED, not yet implemented.
 * When implemented, set VERCEL_TOKEN in .env and fill in the API calls.
 */

import { fetchResource } from './api';

export interface VercelDeployment {
  uid: string;
  name: string;
  url: string;
  state: 'BUILDING' | 'ERROR' | 'INITIALIZING' | 'QUEUED' | 'READY' | 'CANCELED';
  type: 'LAMBDAS';
  created: number;
  buildingAt?: number;
  ready?: number;
  target?: 'production' | 'staging';
  creator: { email: string };
  meta?: Record<string, string>;
}

export function fetchVercelDeployments(): Promise<VercelDeployment[]> {
  return fetchResource<VercelDeployment[]>('/api/vercel/deployments');
}
