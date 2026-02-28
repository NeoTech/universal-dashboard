import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface IpoEvent {
  date: string;
  exchange: string;
  name: string;
  numberOfShares: number;
  price: string;
  status: string;
  symbol: string;
  totalSharesValue: number;
}

interface Props { refreshInterval?: number; }

function statusVariant(status: string): BadgeVariant {
  if (status === 'filed') return 'warning';
  return 'neutral';
}

export function IpoCalendarTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ ipos: IpoEvent[] }>('finnhub-ipo-calendar', { ipos: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile ipo-calendar-tile" skeletonLines={6}>
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
        <Show when={store().ipos.length === 0}>
            <div class="cell-empty">No upcoming IPOs found</div>
          </Show>
          <Show when={store().ipos.length > 0}>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.82rem' }}>
                <thead>
                  <tr>
                    {(['Date', 'Company', 'Symbol', 'Exchange', 'Price', 'Status'] as string[]).map(h => (
                      <th style={{ padding: '4px 8px', 'text-align': 'left', 'border-bottom': '1px solid var(--color-border)', color: 'var(--color-text-muted)', 'white-space': 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <For each={store().ipos}>
                    {(ipo) => (
                      <tr style={{ 'border-bottom': '1px solid var(--color-border)' }}>
                        <td style={{ padding: '4px 8px', 'white-space': 'nowrap' }}>{ipo.date}</td>
                        <td style={{ padding: '4px 8px', 'max-width': '140px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>{ipo.name}</td>
                        <td style={{ padding: '4px 8px', 'font-weight': '600' }}>{ipo.symbol}</td>
                        <td style={{ padding: '4px 8px' }}>{ipo.exchange}</td>
                        <td style={{ padding: '4px 8px' }}>{ipo.price ?? '—'}</td>
                        <td style={{ padding: '4px 8px' }}><Badge variant={statusVariant(ipo.status)}>{ipo.status}</Badge></td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
    </BaseTile>
  );
}
