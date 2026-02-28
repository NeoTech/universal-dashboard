/**
 * Shared browser-side API client utilities.
 * All TWM data modules import fetchResource / mutateResource from here.
 *
 * API_BASE_URL defaults to '' (relative URLs) so the Vite dev-server proxy
 * forwards /api/* to http://localhost:3001 transparently.
 * Override with VITE_API_URL env var when the API lives on a different origin.
 */

export const API_BASE_URL: string = (() => {
  if (typeof import.meta !== 'undefined') {
    const env = (import.meta as { env?: Record<string, string> }).env;
    if (env?.['VITE_API_URL'] !== undefined) return env['VITE_API_URL'];
  }
  return '';
})();

export class TwmApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'TwmApiError';
  }
}

export async function fetchResource<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`);
  const data = (await res.json()) as T | { error: string };
  if (!res.ok) throw new TwmApiError(res.status, (data as { error: string }).error ?? 'API error');
  return data as T;
}

export async function mutateResource<T>(
  method: 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T | { error: string };
  if (!res.ok) throw new TwmApiError(res.status, (data as { error: string }).error ?? 'API error');
  return data as T;
}
