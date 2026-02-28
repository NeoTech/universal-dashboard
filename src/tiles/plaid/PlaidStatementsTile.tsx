import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Statement {
  statement_id: string;
  month: number;
  year: number;
  pdf_url?: string;
}

interface StatementAccount {
  account_id: string;
  account_name: string;
  statements: Statement[];
}

interface StatementsData {
  accounts: StatementAccount[];
  note: string;
}

const DEFAULT: StatementsData = { accounts: [], note: '' };

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function PlaidStatementsTile(_props: { refreshInterval?: number }): JSX.Element {
  const { data: store, loading, error } = useSseChannel<StatementsData>('plaid-statements', DEFAULT);

  return (
    <BaseTile loading={loading()} error={error()} style={{ height: '100%', overflow: 'auto', padding: '4px' }}>
      {store().note && store().accounts.length === 0 ? (
        <div style={{ display: 'flex', 'flex-direction': 'column', 'align-items': 'center', 'justify-content': 'center', height: '100%', gap: '8px', color: 'var(--text-secondary)', 'text-align': 'center' }}>
          <div style={{ 'font-size': '32px' }}>🔒</div>
          <div style={{ 'font-size': '13px' }}>{store().note}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', 'flex-direction': 'column', gap: '16px' }}>
          {store().accounts.length === 0 && !store().note && (
            <div style={{ 'text-align': 'center', color: 'var(--text-secondary)', 'font-size': '13px', padding: '20px' }}>No statements available</div>
          )}
          {store().accounts.map(acc => (
            <div>
              <div style={{ 'font-weight': '600', 'font-size': '13px', 'margin-bottom': '8px', color: 'var(--text-primary)' }}>{acc.account_name}</div>
              <div style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
                {acc.statements.map(stmt => (
                  <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center', padding: '4px 0', 'border-bottom': '1px solid var(--border-color)', 'font-size': '12px' }}>
                    <span>{MONTH_NAMES[(stmt.month - 1) % 12]} {stmt.year}</span>
                    {stmt.pdf_url && (
                      <a href={stmt.pdf_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-color, #60a5fa)', 'text-decoration': 'none', 'font-size': '11px' }}>
                        Download PDF
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </BaseTile>
  );
}
