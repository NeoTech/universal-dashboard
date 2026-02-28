import { fetchResource } from './api';

export interface HibpBreach {
  email: string;
  breaches: Array<{
    Name: string;
    Title: string;
    Domain: string;
    BreachDate: string;
    AddedDate: string;
    Description: string;
    DataClasses: string[];
    IsVerified: boolean;
    IsFabricated: boolean;
    IsSensitive: boolean;
    IsRetired: boolean;
    IsSpamList: boolean;
  }>;
}

export function fetchHibpBreaches(): Promise<{ results: HibpBreach[] }> {
  return fetchResource<{ results: HibpBreach[] }>('/api/hibp/breaches');
}
