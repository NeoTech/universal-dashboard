import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { CoinGeckoCoin } from '../../data/coingecko';

interface CoinGeckoData {
  coins: CoinGeckoCoin[];
}

interface Props {
  refreshInterval?: number;
}

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })}`;
}

export function PricesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<CoinGeckoData>(
    'coingecko-markets',
    { coins: [] },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile prices-tile">
      <div
        class="coin-prices-strip"
        style={{ display: 'flex', 'flex-wrap': 'wrap', gap: '8px', padding: '8px' }}
      >
          <Show when={store().coins.length === 0}>
            <span class="cell-empty">No data</span>
          </Show>
          <For each={store().coins.slice(0, 20)}>
            {(coin) => {
              const change = coin.price_change_percentage_24h ?? 0;
              const variant = change > 0 ? 'success' : change < 0 ? 'danger' : 'neutral';
              return (
                <div
                  class="coin-ticker"
                  style={{
                    display: 'flex',
                    'flex-direction': 'column',
                    'align-items': 'center',
                    gap: '2px',
                    padding: '6px 10px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                    'min-width': '80px',
                    cursor: 'pointer',
                  }}
                  onClick={() => window.open(`https://www.coingecko.com/en/coins/${coin.id}`, '_blank')}
                >
                  <span style={{ 'font-size': '0.7rem', 'font-weight': '600', 'letter-spacing': '0.05em', 'text-transform': 'uppercase', color: 'var(--color-text-secondary, #9ca3af)' }}>
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span style={{ 'font-size': '0.8rem', 'font-weight': '500' }}>
                    {formatPrice(coin.current_price)}
                  </span>
                  <Badge variant={variant}>
                    {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                  </Badge>
                </div>
              );
            }}
          </For>
      </div>
    </BaseTile>
  );
}
