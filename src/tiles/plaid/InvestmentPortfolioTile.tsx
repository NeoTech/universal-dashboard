import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Holding {
  account_id: string;
  security_id: string;
  name: string;
  ticker_symbol: string;
  type: string;
  quantity: number;
  institution_price: number;
  institution_value: number;
  cost_basis: number;
  unrealized_gain: number;
}

interface InvestmentPortfolioData {
  holdings: Holding[];
}

const DEFAULT: InvestmentPortfolioData = { holdings: [] };

export function InvestmentPortfolioTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<InvestmentPortfolioData>('plaid-investment-portfolio', DEFAULT);

  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

  return (
    <BaseTile loading={loading()} error={error()} style={{ height: '100%', overflow: 'hidden' }}>
      <div style={{ 'overflow-y': 'auto', flex: '1' }}>
        <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '12px' }}>
          <thead>
            <tr style={{ 'border-bottom': '1px solid var(--border-color)' }}>
              <th style={{ 'text-align': 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Security</th>
              <th style={{ 'text-align': 'left', padding: '4px 6px', color: 'var(--text-secondary)' }}>Ticker</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Qty</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Price</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Value</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Cost Basis</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', color: 'var(--text-secondary)' }}>Gain/Loss</th>
            </tr>
          </thead>
          <tbody>
            {store().holdings.length === 0 && (
              <tr>
                <td colspan={7} style={{ 'text-align': 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No holdings data
                </td>
              </tr>
            )}
            {store().holdings.map(h => (
              <tr style={{ 'border-bottom': '1px solid var(--border-color)' }}>
                <td style={{ padding: '4px 6px', 'max-width': '140px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{h.name}</td>
                <td style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>{h.ticker_symbol}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right' }}>{h.quantity.toFixed(4)}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right' }}>{fmt(h.institution_price)}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right', 'font-weight': '600' }}>{fmt(h.institution_value)}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right', color: 'var(--text-secondary)' }}>{fmt(h.cost_basis)}</td>
                <td style={{ padding: '4px 6px', 'text-align': 'right' }}>
                  <span style={{
                    color: h.unrealized_gain >= 0 ? 'var(--success-color, #22c55e)' : 'var(--danger-color, #ef4444)',
                    'font-weight': '600',
                  }}>
                    {h.unrealized_gain >= 0 ? '+' : ''}{fmt(h.unrealized_gain)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BaseTile>
  );
}
