import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import type { PlaidAccount } from '../../data/plaid';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

export function AccountsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ accounts: PlaidAccount[] }>('plaid-accounts', { accounts: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile plaid-accounts-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Type</th>
              <th>Balance</th>
              <th>Available</th>
              <th>Currency</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().accounts.length === 0}>
              <tr><td colspan="5" class="cell-empty">No accounts</td></tr>
            </Show>
            <For each={store().accounts}>
              {(account) => (
                <tr>
                  <td>{account.name} ···{account.mask}</td>
                  <td>{account.subtype ?? account.type}</td>
                  <td>{account.balances.iso_currency_code ?? ''} {account.balances.current.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                  <td>{account.balances.available != null ? account.balances.available.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '—'}</td>
                  <td>{account.balances.iso_currency_code ?? '—'}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
