import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  score: number;
  data?: {
    price?: string;
    price_change_percentage_24h?: { usd?: number };
    market_cap?: string;
  };
}

interface Props {
  refreshInterval?: number;
}

export function TrendingCoinsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ trending: TrendingCoin[] }>(
    'coingecko-trending',
    { trending: [] },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile trending-coins-tile" skeletonLines={7}>
      <table class="tile-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Name</th>
              <th>Symbol</th>
              <th>Price</th>
              <th>24h</th>
            </tr>
          </thead>
          <tbody>
            <For each={store().trending}>
              {(coin) => {
                const change = coin.data?.price_change_percentage_24h?.usd ?? 0;
                const variant: BadgeVariant = change >= 0 ? 'success' : 'danger';
                const changeLabel = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                return (
                  <tr>
                    <td>{coin.market_cap_rank ?? '—'}</td>
                    <td>{coin.name}</td>
                    <td style={{ 'text-transform': 'uppercase' }}>{coin.symbol}</td>
                    <td>{coin.data?.price ?? '—'}</td>
                    <td>
                      <Badge variant={variant}>{changeLabel}</Badge>
                    </td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
