import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

// ── Plaid ─────────────────────────────────────────────────────────────────────
async function dataPlaidAccounts(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/accounts/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { accounts?: unknown[] };
  return { accounts: d.accounts ?? [] };
}

async function dataPlaidTransactions(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken, start_date: startDate, end_date: endDate, options: { count: 50, offset: 0 } }),
  });
  const d = await r.json() as { transactions?: unknown[] };
  return { transactions: d.transactions ?? [] };
}

// ── Plaid Extended ────────────────────────────────────────────────────────────
let _plaidHoldingsCache: { data: unknown; ts: number } | null = null;
async function dataPlaidInvestmentPortfolio(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidHoldingsCache && Date.now() - _plaidHoldingsCache.ts < 600_000) return _plaidHoldingsCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/investments/holdings/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { holdings?: { account_id: string; security_id: string; quantity: number; institution_price: number; institution_value: number; cost_basis?: number }[]; securities?: { security_id: string; name: string; ticker_symbol?: string; type?: string; close_price?: number }[]; accounts?: unknown[] };
  const holdings = d.holdings ?? [];
  const securitiesMap = new Map((d.securities ?? []).map(s => [s.security_id, s]));
  const enriched = holdings.map(h => {
    const sec = securitiesMap.get(h.security_id);
    return {
      account_id: h.account_id,
      security_id: h.security_id,
      name: sec?.name ?? h.security_id,
      ticker_symbol: sec?.ticker_symbol ?? '',
      type: sec?.type ?? '',
      quantity: h.quantity,
      institution_price: h.institution_price,
      institution_value: h.institution_value,
      cost_basis: h.cost_basis ?? 0,
      unrealized_gain: h.institution_value - (h.cost_basis ?? 0),
    };
  }).sort((a, b) => b.institution_value - a.institution_value);
  const data = { holdings: enriched };
  _plaidHoldingsCache = { data, ts: Date.now() };
  return data;
}

let _plaidInvTxCache: { data: unknown; ts: number } | null = null;
async function dataPlaidInvestmentTransactions(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidInvTxCache && Date.now() - _plaidInvTxCache.ts < 600_000) return _plaidInvTxCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const r = await fetch(`${baseUrl}/investments/transactions/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken, start_date: startDate, end_date: endDate }),
  });
  const d = await r.json() as { investment_transactions?: { investment_transaction_id: string; account_id: string; security_id?: string; date: string; name: string; quantity: number; amount: number; fees?: number; type: string; subtype: string }[]; securities?: { security_id: string; name: string; ticker_symbol?: string }[] };
  const securitiesMap = new Map((d.securities ?? []).map(s => [s.security_id, s]));
  const txs = (d.investment_transactions ?? []).map(tx => ({
    ...tx,
    ticker_symbol: securitiesMap.get(tx.security_id ?? '')?.ticker_symbol ?? '',
  })).sort((a, b) => b.date.localeCompare(a.date));
  const data = { transactions: txs };
  _plaidInvTxCache = { data, ts: Date.now() };
  return data;
}

let _plaidLiabCache: { data: unknown; ts: number } | null = null;
async function dataPlaidLiabilities(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidLiabCache && Date.now() - _plaidLiabCache.ts < 1_800_000) return _plaidLiabCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { credit?: { account_id: string; balances?: { current?: number } }[]; mortgage?: { account_id: string; balances?: { current?: number } }[]; student?: { account_id: string; balances?: { current?: number } }[] }; accounts?: { account_id: string; name: string; balances?: { current?: number; limit?: number } }[] };
  const liab = d.liabilities ?? {};
  const creditTotal = (liab.credit ?? []).reduce((s, c) => s + (c.balances?.current ?? 0), 0);
  const mortgageTotal = (liab.mortgage ?? []).reduce((s, m) => s + (m.balances?.current ?? 0), 0);
  const studentTotal = (liab.student ?? []).reduce((s, st) => s + (st.balances?.current ?? 0), 0);
  const totalOwed = creditTotal + mortgageTotal + studentTotal;
  const accounts = (d.accounts ?? []).map(a => ({ account_id: a.account_id, name: a.name, balance: a.balances?.current ?? 0 }));
  const data = { totalOwed, byType: { credit: creditTotal, mortgage: mortgageTotal, student: studentTotal }, accounts };
  _plaidLiabCache = { data, ts: Date.now() };
  return data;
}

let _plaidCCCache: { data: unknown; ts: number } | null = null;
async function dataPlaidCreditCards(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidCCCache && Date.now() - _plaidCCCache.ts < 1_800_000) return _plaidCCCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { credit?: { account_id: string; balances?: { current?: number; limit?: number }; last_statement_balance?: number; last_payment_date?: string; last_payment_amount?: number; minimum_payment_amount?: number; next_payment_due_date?: string; is_overdue?: boolean }[] }; accounts?: { account_id: string; name: string }[] };
  const accountNames = new Map((d.accounts ?? []).map(a => [a.account_id, a.name]));
  const cards = (d.liabilities?.credit ?? []).map(cc => {
    const current = cc.balances?.current ?? 0;
    const limit = cc.balances?.limit ?? 0;
    const utilization = limit > 0 ? Math.round((current / limit) * 100) : 0;
    return {
      account_id: cc.account_id,
      name: accountNames.get(cc.account_id) ?? cc.account_id,
      current,
      limit,
      utilization,
      last_statement_balance: cc.last_statement_balance ?? 0,
      last_payment_date: cc.last_payment_date ?? '',
      last_payment_amount: cc.last_payment_amount ?? 0,
      minimum_payment_amount: cc.minimum_payment_amount ?? 0,
      next_payment_due_date: cc.next_payment_due_date ?? '',
      is_overdue: cc.is_overdue ?? false,
    };
  });
  const data = { cards };
  _plaidCCCache = { data, ts: Date.now() };
  return data;
}

let _plaidMortgCache: { data: unknown; ts: number } | null = null;
async function dataPlaidMortgage(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidMortgCache && Date.now() - _plaidMortgCache.ts < 3_600_000) return _plaidMortgCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  const r = await fetch(`${baseUrl}/liabilities/get`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
  });
  const d = await r.json() as { liabilities?: { mortgage?: { account_id: string; origination_principal_amount?: number; outstanding_principal_balance?: number; last_payment_amount?: number; last_payment_date?: string; current_late_fee?: number; maturity_date?: string; interest_rate?: { percentage?: number; type?: string }; next_payment_due_date?: string; next_monthly_payment?: number; property_address?: { city?: string; state?: string } }[] } };
  const mortgages = (d.liabilities?.mortgage ?? []).map(m => ({
    account_id: m.account_id,
    origination_principal_amount: m.origination_principal_amount ?? 0,
    outstanding_principal_balance: m.outstanding_principal_balance ?? 0,
    last_payment_amount: m.last_payment_amount ?? 0,
    last_payment_date: m.last_payment_date ?? '',
    current_late_fee: m.current_late_fee ?? 0,
    maturity_date: m.maturity_date ?? '',
    interest_rate_percentage: m.interest_rate?.percentage ?? 0,
    interest_rate_type: m.interest_rate?.type ?? '',
    next_payment_due_date: m.next_payment_due_date ?? '',
    next_monthly_payment: m.next_monthly_payment ?? 0,
    city: m.property_address?.city ?? '',
    state: m.property_address?.state ?? '',
  }));
  const data = { mortgages };
  _plaidMortgCache = { data, ts: Date.now() };
  return data;
}

let _plaidStmtCache: { data: unknown; ts: number } | null = null;
async function dataPlaidStatements(): Promise<unknown> {
  const accessToken = process.env['PLAID_ACCESS_TOKEN'];
  const clientId = process.env['PLAID_CLIENT_ID'];
  const secret = process.env['PLAID_SECRET'];
  const env = process.env['PLAID_ENV'] ?? 'sandbox';
  if (!accessToken || !clientId || !secret) throw new Error('PLAID_ACCESS_TOKEN, PLAID_CLIENT_ID, or PLAID_SECRET not configured');
  if (_plaidStmtCache && Date.now() - _plaidStmtCache.ts < 3_600_000) return _plaidStmtCache.data;
  const baseUrl = env === 'production' ? 'https://production.plaid.com' : env === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com';
  try {
    const r = await fetch(`${baseUrl}/statements/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: accessToken }),
    });
    if (!r.ok) {
      const data = { accounts: [], note: 'Statements not available in this Plaid environment.' };
      _plaidStmtCache = { data, ts: Date.now() };
      return data;
    }
    const d = await r.json() as { accounts?: { account_id: string; account_name: string; statements?: { statement_id: string; month: number; year: number; pdf_url?: string }[] }[] };
    const data = { accounts: d.accounts ?? [], note: '' };
    _plaidStmtCache = { data, ts: Date.now() };
    return data;
  } catch {
    const data = { accounts: [], note: 'Statements not available in sandbox mode.' };
    _plaidStmtCache = { data, ts: Date.now() };
    return data;
  }
}

// ── register ──────────────────────────────────────────────────────────────────
export function register(ctx: ServerContext): ProviderRouteHandler {
  if (process.env['PLAID_ACCESS_TOKEN'] && process.env['PLAID_CLIENT_ID'] && process.env['PLAID_SECRET']) {
    ctx.poll('plaid-accounts', parseInt(process.env['PLAID_POLL_MS'] ?? '300000', 10), dataPlaidAccounts);
    ctx.poll('plaid-transactions', parseInt(process.env['PLAID_POLL_MS'] ?? '300000', 10), dataPlaidTransactions);
    ctx.poll('plaid-investment-portfolio', parseInt(process.env['PLAID_INV_POLL_MS'] ?? '600000', 10), dataPlaidInvestmentPortfolio);
    ctx.poll('plaid-investment-transactions', parseInt(process.env['PLAID_INVTX_POLL_MS'] ?? '600000', 10), dataPlaidInvestmentTransactions);
    ctx.poll('plaid-liabilities-overview', parseInt(process.env['PLAID_LIAB_POLL_MS'] ?? '1800000', 10), dataPlaidLiabilities);
    ctx.poll('plaid-credit-card-details', parseInt(process.env['PLAID_CC_POLL_MS'] ?? '1800000', 10), dataPlaidCreditCards);
    ctx.poll('plaid-mortgage-tracker', parseInt(process.env['PLAID_MORT_POLL_MS'] ?? '3600000', 10), dataPlaidMortgage);
    ctx.poll('plaid-statements', parseInt(process.env['PLAID_STMT_POLL_MS'] ?? '3600000', 10), dataPlaidStatements);
  }

  return async (_req: IncomingMessage, res: ServerResponse, _url: URL, path: string, method: string): Promise<boolean> => {
    if (!path.startsWith('/api/plaid/')) return false;

    const { route } = ctx;
    if (path === '/api/plaid/accounts' && method === 'GET') { await route(res, dataPlaidAccounts); return true; }
    if (path === '/api/plaid/transactions' && method === 'GET') { await route(res, dataPlaidTransactions); return true; }
    if (path === '/api/plaid/investment-portfolio' && method === 'GET') { await route(res, dataPlaidInvestmentPortfolio); return true; }
    if (path === '/api/plaid/investment-transactions' && method === 'GET') { await route(res, dataPlaidInvestmentTransactions); return true; }
    if (path === '/api/plaid/liabilities-overview' && method === 'GET') { await route(res, dataPlaidLiabilities); return true; }
    if (path === '/api/plaid/credit-card-details' && method === 'GET') { await route(res, dataPlaidCreditCards); return true; }
    if (path === '/api/plaid/mortgage-tracker' && method === 'GET') { await route(res, dataPlaidMortgage); return true; }
    if (path === '/api/plaid/statements' && method === 'GET') { await route(res, dataPlaidStatements); return true; }

    ctx.json(res, 404, { error: `Unknown Plaid route: ${path}` });
    return true;
  };
}
