import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { CoinGeckoCoin } from '../../data/coingecko';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function changeBadge(change: number): BadgeVariant {
  if (change > 0) return 'success';
  if (change < 0) return 'danger';
  return 'neutral';
}

function formatMarketCap(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (price >= 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(8)}`;
}

export function MarketsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ coins: CoinGeckoCoin[] }>('coingecko-markets', { coins: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().coins, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile coingecko-markets-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Coin</th>
              <th>Price</th>
              <th>24h Change</th>
              <th>Market Cap</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().coins.length === 0}>
              <tr><td colspan="5" class="cell-empty">No coins configured</td></tr>
            </Show>
            <For each={pageItems()}>
              {(coin) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://www.coingecko.com/en/coins/${coin.id}`, '_blank')}
                >
                  <td>{coin.market_cap_rank}</td>
                  <td>
                    <span style={{ 'text-transform': 'uppercase', 'font-weight': 'bold' }}>{coin.symbol}</span>
                    <span style={{ 'margin-left': '6px', color: 'var(--color-text-muted)' }}>{coin.name}</span>
                  </td>
                  <td>{formatPrice(coin.current_price)}</td>
                  <td>
                    <Badge variant={changeBadge(coin.price_change_percentage_24h)}>
                      {coin.price_change_percentage_24h >= 0 ? '+' : ''}{coin.price_change_percentage_24h?.toFixed(2)}%
                    </Badge>
                  </td>
                  <td>{formatMarketCap(coin.market_cap)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
