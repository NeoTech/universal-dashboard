import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface CoinChart {
  coinId: string;
  prices: { ts: number; price: number }[];
}

interface Props {
  refreshInterval?: number;
}

function Sparkline(props: { prices: { ts: number; price: number }[] }): JSX.Element {
  const W = 80;
  const H = 32;
  const pts = props.prices;
  if (pts.length < 2) return <svg width={W} height={H} />;

  const minP = Math.min(...pts.map(p => p.price));
  const maxP = Math.max(...pts.map(p => p.price));
  const range = maxP - minP || 1;

  const points = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * W;
    const y = H - ((p.price - minP) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });

  const first = pts[0].price;
  const last = pts[pts.length - 1].price;
  const rising = last >= first;

  return (
    <svg width={W} height={H} style={{ display: 'block' }}>
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={rising ? '#22c55e' : '#ef4444'}
        stroke-width="1.5"
      />
    </svg>
  );
}

export function PriceChartTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ charts: CoinChart[] }>(
    'coingecko-price-chart',
    { charts: [] },
  );
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile price-chart-tile">
      <>
        <Show when={store().charts.length > 1}>
          <select
            value={selectedIdx()}
            onInput={(e) => setSelectedIdx(parseInt((e.target as HTMLSelectElement).value, 10))}
            style={{ 'margin-bottom': '8px', width: '100%' }}
          >
            <For each={store().charts}>
              {(chart, i) => <option value={i()}>{chart.coinId}</option>}
            </For>
          </select>
        </Show>
        <Show
          when={store().charts.length > 0}
          fallback={<p class="tile-muted">No chart data</p>}
        >
          {(() => {
            const chart = store().charts[selectedIdx()] ?? store().charts[0];
            if (!chart) return null;
            const prices = chart.prices;
            const first = prices[0]?.price ?? 0;
            const last = prices[prices.length - 1]?.price ?? 0;
            const change = first !== 0 ? ((last - first) / first) * 100 : 0;
            const variant: BadgeVariant = change >= 0 ? 'success' : 'danger';
            return (
              <div>
                <div style={{ 'margin-bottom': '8px', 'font-weight': 600, 'text-transform': 'capitalize' }}>
                  {chart.coinId}
                </div>
                <div style={{ display: 'flex', 'align-items': 'center', gap: '12px', 'margin-bottom': '8px' }}>
                  <Sparkline prices={prices} />
                  <div>
                    <div style={{ 'font-size': '1.1em', 'font-weight': 600 }}>
                      ${last.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <Badge variant={variant}>{change >= 0 ? '+' : ''}{change.toFixed(2)}% 7d</Badge>
                  </div>
                </div>
              </div>
            );
          })()}
        </Show>
      </>
    </BaseTile>
  );
}
