import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface CoinGeckoGlobalData {
  active_cryptocurrencies?: number;
  total_market_cap?: Record<string, number>;
  total_volume?: Record<string, number>;
  market_cap_percentage?: Record<string, number>;
  market_cap_change_percentage_24h_usd?: number;
  defi_market_cap?: string;
  defi_to_eth_ratio?: string;
}

interface GlobalStore {
  global: CoinGeckoGlobalData | null;
}

interface Props {
  refreshInterval?: number;
}

function formatTrillions(value: number | undefined): string {
  if (value == null) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString('en-US')}`;
}

function formatCount(value: number | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString('en-US');
}

export function GlobalTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<GlobalStore>(
    'coingecko-global',
    { global: null },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile global-tile" skeletonLines={4}>
      <Show when={store().global} fallback={<p class="cell-empty">No data</p>}>
          {(g) => {
            const data = g();
            const change24h = data.market_cap_change_percentage_24h_usd ?? 0;
            const changeVariant = change24h > 0 ? 'success' : change24h < 0 ? 'danger' : 'neutral';
            const btcDom = data.market_cap_percentage?.['btc'];
            const ethDom = data.market_cap_percentage?.['eth'];

            return (
              <div
                style={{
                  display: 'grid',
                  'grid-template-columns': '1fr 1fr',
                  gap: '8px',
                  padding: '8px',
                }}
              >
                <div
                  style={{
                    padding: '10px 12px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                  }}
                >
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary, #9ca3af)', 'margin-bottom': '4px' }}>
                    Total Market Cap
                  </div>
                  <div style={{ 'font-size': '0.95rem', 'font-weight': '600' }}>
                    {formatTrillions(data.total_market_cap?.['usd'])}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                  }}
                >
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary, #9ca3af)', 'margin-bottom': '4px' }}>
                    24h Change
                  </div>
                  <Badge variant={changeVariant}>
                    {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
                  </Badge>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                  }}
                >
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary, #9ca3af)', 'margin-bottom': '4px' }}>
                    BTC / ETH Dominance
                  </div>
                  <div style={{ 'font-size': '0.85rem', 'font-weight': '500' }}>
                    {btcDom != null ? `${btcDom.toFixed(1)}%` : '—'}
                    {' / '}
                    {ethDom != null ? `${ethDom.toFixed(1)}%` : '—'}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                  }}
                >
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary, #9ca3af)', 'margin-bottom': '4px' }}>
                    Active Coins
                  </div>
                  <div style={{ 'font-size': '0.95rem', 'font-weight': '600' }}>
                    {formatCount(data.active_cryptocurrencies)}
                  </div>
                </div>

                <div
                  style={{
                    padding: '10px 12px',
                    'border-radius': '6px',
                    background: 'var(--color-surface-raised, rgba(255,255,255,0.05))',
                    'grid-column': '1 / -1',
                  }}
                >
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary, #9ca3af)', 'margin-bottom': '4px' }}>
                    24h Volume
                  </div>
                  <div style={{ 'font-size': '0.95rem', 'font-weight': '600' }}>
                    {formatTrillions(data.total_volume?.['usd'])}
                  </div>
                </div>
              </div>
            );
          }}
        </Show>
    </BaseTile>
  );
}
