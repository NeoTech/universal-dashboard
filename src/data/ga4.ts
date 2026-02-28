import { fetchResource } from './api';

export interface GA4MetricValue {
  value: string;
}

export interface GA4DimensionValue {
  value: string;
}

export interface GA4Row {
  dimensionValues: GA4DimensionValue[];
  metricValues: GA4MetricValue[];
}

export interface GA4Report {
  dimensionHeaders: Array<{ name: string }>;
  metricHeaders: Array<{ name: string; type: string }>;
  rows: GA4Row[];
  totals?: GA4Row[];
  rowCount?: number;
}

export interface GA4SessionsTrend {
  dates: string[];
  sessions: number[];
  users: number[];
  pageviews: number[];
}

export function fetchGA4Sessions(): Promise<{ trend: GA4SessionsTrend; totals: { sessions: number; users: number; pageviews: number } }> {
  return fetchResource('/api/ga4/sessions-trend');
}
