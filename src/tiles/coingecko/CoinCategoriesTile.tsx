import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface CoinCategory {
  id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h: number;
  volume_24h: number;
}

interface Props {
  refreshInterval?: number;
}

function fmtMktCap(n: number): string {
  if (!n) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function CoinCategoriesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ categories: CoinCategory[] }>(
    'coingecko-categories',
    { categories: [] },
  );

  const sorted = () =>
    [...store().categories].sort(
      (a, b) => (b.market_cap_change_24h ?? 0) - (a.market_cap_change_24h ?? 0),
    );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile coin-categories-tile" skeletonLines={8}>
      <table class="tile-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Market Cap</th>
              <th>24h Change</th>
              <th>Vol 24h</th>
            </tr>
          </thead>
          <tbody>
            <For each={sorted()}>
              {(cat) => {
                const change = cat.market_cap_change_24h ?? 0;
                const variant: BadgeVariant = change >= 0 ? 'success' : 'danger';
                return (
                  <tr>
                    <td>{cat.name}</td>
                    <td>{fmtMktCap(cat.market_cap)}</td>
                    <td>
                      <Badge variant={variant}>
                        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                      </Badge>
                    </td>
                    <td>{fmtMktCap(cat.volume_24h)}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
