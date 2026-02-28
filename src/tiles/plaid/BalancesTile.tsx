import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { PlaidAccount } from '../../data/plaid';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

export function BalancesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ accounts: PlaidAccount[] }>('plaid-accounts', { accounts: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile plaid-balances-tile">
      <>
          <Show when={store().accounts.length === 0}>
            <div class="cell-empty">No accounts configured</div>
          </Show>
          <For each={store().accounts}>
            {(account) => {
              const curr = account.balances.current;
              const avail = account.balances.available;
              const currency = account.balances.iso_currency_code ?? 'USD';
              const pct = avail != null && curr > 0 ? Math.min(100, Math.round((avail / curr) * 100)) : null;
              return (
                <div class="balance-card" style={{ padding: '10px 12px', 'border-bottom': '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' }}>
                    <span><strong>{account.name}</strong> ···{account.mask}</span>
                    <Badge variant={account.type === 'credit' ? 'warning' : 'neutral'}>{account.subtype ?? account.type}</Badge>
                  </div>
                  <div style={{ 'margin-top': '6px', display: 'flex', 'justify-content': 'space-between', 'font-size': '0.9em' }}>
                    <span>Current: <strong>{currency} {curr.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong></span>
                    {avail != null && <span style={{ color: 'var(--color-text-muted)' }}>Available: {avail.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>}
                  </div>
                  {pct != null && (
                    <div style={{ 'margin-top': '6px', background: 'var(--color-border)', 'border-radius': '4px', height: '6px' }}>
                      <div style={{ background: 'var(--color-success)', width: `${pct}%`, height: '100%', 'border-radius': '4px' }} />
                    </div>
                  )}
                </div>
              );
            }}
          </For>
      </>
    </BaseTile>
  );
}
