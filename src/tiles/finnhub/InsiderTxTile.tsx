import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface InsiderTx {
  name: string;
  share: number;
  change: number;
  filingDate: string;
  transactionDate: string;
  transactionCode: string;
  transactionPrice: number;
}

interface SymbolInsider {
  symbol: string;
  transactions: InsiderTx[];
}

interface Props { refreshInterval?: number; }

export function InsiderTxTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ symbols: SymbolInsider[] }>('finnhub-insider-transactions', { symbols: [] });
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selected = () => store().symbols[selectedIdx()] ?? null;

  function codeBadge(code: string): { variant: BadgeVariant; label: string } {
    if (code === 'P') return { variant: 'success', label: 'Buy' };
    if (code === 'S') return { variant: 'danger', label: 'Sell' };
    return { variant: 'neutral', label: code };
  }

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile insider-tx-tile" skeletonLines={6}>
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
        <Show when={store().symbols.length > 1}>
            <select
              value={selectedIdx()}
              onChange={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
              style={{ 'margin-bottom': '8px', padding: '4px 8px', 'font-size': '0.85rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', 'border-radius': '4px' }}
            >
              <For each={store().symbols}>
                {(s, i) => <option value={i()}>{s.symbol}</option>}
              </For>
            </select>
          </Show>
          <Show when={selected() !== null} fallback={<div class="cell-empty">No insider transaction data</div>}>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.82rem' }}>
                <thead>
                  <tr>
                    {(['Date', 'Person', 'Shares', 'Code', 'Price'] as string[]).map(h => (
                      <th style={{ padding: '4px 8px', 'text-align': 'left', 'border-bottom': '1px solid var(--color-border)', color: 'var(--color-text-muted)', 'white-space': 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <For each={selected()?.transactions ?? []}>
                    {(tx) => {
                      const { variant, label } = codeBadge(tx.transactionCode);
                      return (
                        <tr style={{ 'border-bottom': '1px solid var(--color-border)' }}>
                          <td style={{ padding: '4px 8px', 'white-space': 'nowrap' }}>{tx.transactionDate}</td>
                          <td style={{ padding: '4px 8px', 'max-width': '120px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{tx.name}</td>
                          <td style={{ padding: '4px 8px', 'text-align': 'right' }}>{tx.share.toLocaleString()}</td>
                          <td style={{ padding: '4px 8px' }}><Badge variant={variant}>{label}</Badge></td>
                          <td style={{ padding: '4px 8px', 'text-align': 'right' }}>{tx.transactionPrice ? `$${tx.transactionPrice.toFixed(2)}` : '—'}</td>
                        </tr>
                      );
                    }}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
    </BaseTile>
  );
}
