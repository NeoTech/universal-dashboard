import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface Mover {
  ticker: string;
  price: string;
  change_amount: string;
  change_percentage: string;
  volume: string;
}

interface MoversData {
  top_gainers: Mover[];
  top_losers: Mover[];
  most_actively_traded: Mover[];
  last_updated: string;
}

interface Props {
  refreshInterval?: number;
}

type Tab = 'gainers' | 'losers' | 'active';

function changeVariant(changeAmount: string, tab: Tab): BadgeVariant {
  if (tab === 'gainers') return 'success';
  if (tab === 'losers') return 'danger';
  const n = parseFloat(changeAmount);
  if (n > 0) return 'success';
  if (n < 0) return 'danger';
  return 'neutral';
}

function tabButtonStyle(active: boolean): JSX.CSSProperties {
  return {
    padding: '4px 10px',
    cursor: 'pointer',
    background: active ? 'var(--color-primary)' : 'transparent',
    border: '1px solid var(--color-border)',
    'border-radius': '4px',
  };
}

export function MarketMoversTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<MoversData>('alphavantage-market-movers', {
    top_gainers: [],
    top_losers: [],
    most_actively_traded: [],
    last_updated: '',
  });
  const [tab, setTab] = createSignal<Tab>('gainers');

  const items = () => {
    const d = store();
    if (tab() === 'gainers') return d.top_gainers.slice(0, 10);
    if (tab() === 'losers') return d.top_losers.slice(0, 10);
    return d.most_actively_traded.slice(0, 10);
  };

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile market-movers-tile">
      <>
        <div style={{ display: 'flex', gap: '6px', 'margin-bottom': '8px' }}>
            <button style={tabButtonStyle(tab() === 'gainers')} onClick={() => setTab('gainers')}>Gainers</button>
            <button style={tabButtonStyle(tab() === 'losers')} onClick={() => setTab('losers')}>Losers</button>
            <button style={tabButtonStyle(tab() === 'active')} onClick={() => setTab('active')}>Active</button>
          </div>
          <table class="tile-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Price</th>
                <th>Change</th>
                <th>Change%</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              <Show when={items().length === 0}>
                <tr><td colspan="5" class="cell-empty">No data</td></tr>
              </Show>
              <For each={items()}>{(mover) => (
                <tr>
                  <td>{mover.ticker}</td>
                  <td>{mover.price}</td>
                  <td>
                    <Badge variant={changeVariant(mover.change_amount, tab())}>
                      {mover.change_amount}
                    </Badge>
                  </td>
                  <td>{mover.change_percentage}</td>
                  <td>{mover.volume}</td>
                </tr>
              )}</For>
            </tbody>
          </table>
      </>
    </BaseTile>
  );
}
