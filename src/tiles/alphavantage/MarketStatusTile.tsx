import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface Market {
  market_type: string;
  region: string;
  primary_exchanges: string;
  forex_market: string;
  equity_market: string;
  market_open: string;
  current_status: string;
  notes?: string;
}

interface Props {
  refreshInterval?: number;
}

function statusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === 'open') return 'success';
  if (s === 'closed') return 'neutral';
  return 'warning';
}

export function MarketStatusTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ markets: Market[] }>('alphavantage-market-status', { markets: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile market-status-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Region</th>
              <th>Type</th>
              <th>Exchanges</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().markets.length === 0}>
              <tr><td colspan="4" class="cell-empty">No market data</td></tr>
            </Show>
            <For each={store().markets.slice(0, 20)}>{(market) => (
              <tr>
                <td>{market.region}</td>
                <td>{market.market_type}</td>
                <td>{market.primary_exchanges}</td>
                <td>
                  <Badge variant={statusVariant(market.current_status)}>
                    {market.current_status.toUpperCase()}
                  </Badge>
                </td>
              </tr>
            )}</For>
          </tbody>
        </table>
    </BaseTile>
  );
}
