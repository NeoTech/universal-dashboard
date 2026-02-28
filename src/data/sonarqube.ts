import { fetchResource } from './api';

export type SonarQualityGateStatus = 'OK' | 'WARN' | 'ERROR' | 'NONE';

export interface SonarProject {
  key: string;
  name: string;
  qualifier: string;
  analysisDate?: string;
}

export interface SonarQualityGate {
  projectKey: string;
  projectName: string;
  status: SonarQualityGateStatus;
  conditions?: Array<{
    status: string;
    metricKey: string;
    comparator: string;
    actualValue: string;
    errorThreshold?: string;
  }>;
}

export interface SonarMeasure {
  component: string;
  measures: Array<{ metric: string; value: string; bestValue?: boolean }>;
}

export interface SonarIssue {
  key: string;
  rule: string;
  severity: 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'MINOR' | 'INFO';
  component: string;
  message: string;
  type: 'BUG' | 'VULNERABILITY' | 'CODE_SMELL';
  creationDate: string;
}

export function fetchSonarQuality(): Promise<{ gates: SonarQualityGate[] }> {
  return fetchResource<{ gates: SonarQualityGate[] }>('/api/sonarqube/quality');
}

export function fetchSonarMeasures(): Promise<{ measures: SonarMeasure[] }> {
  return fetchResource<{ measures: SonarMeasure[] }>('/api/sonarqube/measures');
}

export function fetchSonarIssues(): Promise<{ issues: SonarIssue[]; total: number }> {
  return fetchResource<{ issues: SonarIssue[]; total: number }>('/api/sonarqube/issues');
}
