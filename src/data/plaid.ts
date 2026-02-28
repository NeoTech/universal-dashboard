import { fetchResource } from './api';

export interface PlaidAccount {
  account_id: string;
  name: string;
  official_name: string | null;
  type: string;
  subtype: string | null;
  balances: {
    available: number | null;
    current: number;
    limit: number | null;
    iso_currency_code: string | null;
  };
  mask: string;
}

export interface PlaidTransaction {
  account_id: string;
  amount: number;
  iso_currency_code: string | null;
  category: string[];
  date: string;
  merchant_name: string | null;
  name: string;
  pending: boolean;
  transaction_id: string;
  payment_channel: string;
}

export function fetchPlaidAccounts(): Promise<{ accounts: PlaidAccount[] }> {
  return fetchResource<{ accounts: PlaidAccount[] }>('/api/plaid/accounts');
}

export function fetchPlaidTransactions(): Promise<{ transactions: PlaidTransaction[] }> {
  return fetchResource<{ transactions: PlaidTransaction[] }>('/api/plaid/transactions');
}
