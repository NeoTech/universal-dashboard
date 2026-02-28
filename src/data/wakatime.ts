import { fetchResource } from './api';

export interface WakaTimeSummary {
  grand_total: {
    decimal: string;
    digital: string;
    hours: number;
    minutes: number;
    text: string;
    total_seconds: number;
  };
  languages: Array<{
    decimal: string;
    digital: string;
    hours: number;
    minutes: number;
    name: string;
    percent: number;
    text: string;
    total_seconds: number;
  }>;
  projects: Array<{
    decimal: string;
    digital: string;
    hours: number;
    minutes: number;
    name: string;
    percent: number;
    text: string;
    total_seconds: number;
  }>;
  range: {
    date: string;
    end: string;
    start: string;
    text: string;
    timezone: string;
  };
}

export function fetchWakaTimeSummary(): Promise<{ data: WakaTimeSummary[] }> {
  return fetchResource<{ data: WakaTimeSummary[] }>('/api/wakatime/summary');
}
