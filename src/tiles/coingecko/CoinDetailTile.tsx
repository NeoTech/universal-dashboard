import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface CoinDetail {
  id: string;
  name: string;
  symbol: string;
  description: string;
  image: string;
  currentPrice: number;
  marketCap: number;
  priceChange24h: number;
  high24h: number;
  low24h: number;
  ath: number;
  athDate: string;
  rank: number;
}

interface Props {
  refreshInterval?: number;
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

interface KpiProps {
  label: string;
  value: string | JSX.Element;
}

function Kpi(props: KpiProps): JSX.Element {
  return (
    <div style={{
      background: 'var(--tile-bg-secondary, rgba(255,255,255,0.05))',
      'border-radius': '6px',
      padding: '6px 8px',
    }}>
      <div style={{ 'font-size': '0.68em', opacity: 0.6, 'margin-bottom': '2px' }}>{props.label}</div>
      <div style={{ 'font-weight': 600, 'font-size': '0.9em' }}>{props.value}</div>
    </div>
  );
}

export function CoinDetailTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ details: CoinDetail[] }>(
    'coingecko-coin-detail',
    { details: [] },
  );
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile coin-detail-tile" skeletonLines={6}>
      <>
        <Show when={store().details.length > 1}>
          <select
            value={selectedIdx()}
            onInput={(e) => setSelectedIdx(parseInt((e.target as HTMLSelectElement).value, 10))}
            style={{ 'margin-bottom': '8px', width: '100%' }}
          >
            <For each={store().details}>
              {(coin, i) => (
                <option value={i()}>{coin.name} ({(coin.symbol ?? '').toUpperCase()})</option>
              )}
            </For>
          </select>
        </Show>
        <Show
          when={store().details.length > 0}
          fallback={<p class="tile-muted">No coin data</p>}
        >
          {(() => {
            const coin = store().details[selectedIdx()] ?? store().details[0];
            if (!coin) return null;
            const change = coin.priceChange24h ?? 0;
            const changeVariant: BadgeVariant = change >= 0 ? 'success' : 'danger';
            const athYear = coin.athDate ? new Date(coin.athDate).getFullYear() : '';
            return (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'margin-bottom': '6px' }}>
                  <Show when={coin.image}>
                    <img src={coin.image} width="24" height="24" style={{ 'border-radius': '50%' }} alt={coin.name} />
                  </Show>
                  <span style={{ 'font-weight': 700 }}>{coin.name}</span>
                  <span style={{ opacity: 0.6, 'text-transform': 'uppercase', 'font-size': '0.8em' }}>{coin.symbol}</span>
                  <Badge variant="neutral">#{coin.rank}</Badge>
                </div>
                {/* Description */}
                <Show when={coin.description}>
                  <p style={{
                    'font-size': '0.75em',
                    opacity: 0.7,
                    'margin-bottom': '8px',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    '-webkit-line-clamp': '2',
                    '-webkit-box-orient': 'vertical',
                  }}>
                    {coin.description}
                  </p>
                </Show>
                {/* KPI grid */}
                <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px' }}>
                  <Kpi label="Price" value={fmtUsd(coin.currentPrice)} />
                  <Kpi label="24h Change" value={
                    <Badge variant={changeVariant}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </Badge>
                  } />
                  <Kpi label="Market Cap" value={fmtUsd(coin.marketCap)} />
                  <Kpi label="24h High" value={fmtUsd(coin.high24h)} />
                  <Kpi label="24h Low" value={fmtUsd(coin.low24h)} />
                  <Kpi label={`ATH${athYear ? ` (${athYear})` : ''}`} value={fmtUsd(coin.ath)} />
                </div>
              </div>
            );
          })()}
        </Show>
      </>
    </BaseTile>
  );
}
