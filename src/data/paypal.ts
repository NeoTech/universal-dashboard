/**
 * Browser-side PayPal data client.
 * Proxied through /api/paypal/* on the TWM API server, which handles OAuth.
 */

import { fetchResource } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PayPalAmount {
  currency_code: string;
  value: string;
}

export interface PayPalTransactionInfo {
  transaction_id: string;
  transaction_event_code: string;
  transaction_initiation_date: string;
  transaction_updated_date: string;
  transaction_amount: PayPalAmount;
  fee_amount?: PayPalAmount;
  ending_balance?: PayPalAmount;
  transaction_status: 'S' | 'P' | 'D' | 'V' | 'F' | string;
  transaction_note?: string;
  invoice_id?: string;
}

export interface PayPalPayerInfo {
  email_address?: string;
  payer_name?: { given_name?: string; surname?: string; alternate_full_name?: string };
}

export interface PayPalTransactionDetail {
  transaction_info: PayPalTransactionInfo;
  payer_info?: PayPalPayerInfo;
}

export interface PayPalTransactionsResponse {
  transaction_details: PayPalTransactionDetail[];
  total_items: number;
  total_pages: number;
}

export interface PayPalBalance {
  currency_code: string;
  primary: boolean;
  total_balance: PayPalAmount;
  available_balance?: PayPalAmount;
  withheld_balance?: PayPalAmount;
}

export interface PayPalBalanceResponse {
  balances: PayPalBalance[];
}

// ── Status helpers ─────────────────────────────────────────────────────────────

export function ppStatusLabel(code: string): string {
  switch (code) {
    case 'S': return 'Success';
    case 'P': return 'Pending';
    case 'D': return 'Denied';
    case 'V': return 'Reversed';
    case 'F': return 'Part. Refund';
    default:  return code;
  }
}

export function ppPayerName(payer: PayPalPayerInfo | undefined): string {
  if (!payer) return '—';
  const n = payer.payer_name;
  if (n?.alternate_full_name) return n.alternate_full_name;
  if (n?.given_name || n?.surname) return `${n.given_name ?? ''} ${n.surname ?? ''}`.trim();
  return payer.email_address ?? '—';
}

// ── Fetch endpoints ──────────────────────────────────────────────────────────

export function fetchPayPalTransactions(): Promise<PayPalTransactionsResponse> {
  return fetchResource<PayPalTransactionsResponse>('/api/paypal/transactions');
}

export function fetchPayPalBalance(): Promise<PayPalBalanceResponse> {
  return fetchResource<PayPalBalanceResponse>('/api/paypal/balance');
}
