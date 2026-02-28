import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface SparklineItem {
  symbol: string;
  series: { date: string; close: number }[];
  change1d: number;
  change1w: number;
  latestPrice: number;
}

interface SparklineData {
  sparklines: SparklineItem[];
  rateLimit?: boolean;
}

interface Props {
  refreshInterval?: number;
}

function MiniSparkline(props: { series: { date: string; close: number }[] }): JSX.Element {
  const WIDTH = 60;
  const HEIGHT = 20;
  const series = () => props.series;

  return (
    <Show when={series().length > 1} fallback={<span class="cell-empty">—</span>}>
      {(() => {
        const s = series();
        const prices = s.map(p => p.close);
        const minP = Math.min(...prices);
        const maxP = Math.max(...prices);
        const range = maxP - minP || 1;
        const points = s
          .slice()
          .reverse()
          .map((p, i) => {
            const x = (i / (s.length - 1)) * WIDTH;
            const y = HEIGHT - ((p.close - minP) / range) * HEIGHT;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          })
          .join(' ');
        const lastPrice = s[0]?.close ?? 0;
        const firstPrice = s[s.length - 1]?.close ?? lastPrice;
        const color = lastPrice >= firstPrice ? '#22c55e' : '#ef4444';
        return (
          <svg width={WIDTH} height={HEIGHT} style={{ display: 'block' }}>
            <polyline
              points={points}
              fill="none"
              stroke={color}
              stroke-width="1.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />
          </svg>
        );
      })()}
    </Show>
  );
}

function changeBadgeVariant(change: number): BadgeVariant {
  if (change > 0) return 'success';
  if (change < 0) return 'danger';
  return 'neutral';
}

export function SparklinesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<SparklineData>(
    'alphavantage-sparklines',
    { sparklines: [], rateLimit: false },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile sparklines-tile">
      <>
        <Show when={store().rateLimit}>
            <p class="tile-warning" style={{ padding: '4px 8px', color: 'var(--color-warning, #f59e0b)', 'font-size': '0.75rem' }}>
              Rate limit reached — showing cached data
            </p>
          </Show>
          <table class="tile-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>1d</th>
                <th>1w</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().sparklines.length === 0}>
                <tr>
                  <td colspan="5" class="cell-empty">No data</td>
                </tr>
              </Show>
              <For each={store().sparklines}>
                {(item) => (
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(`https://finance.yahoo.com/quote/${item.symbol}`, '_blank')}
                  >
                    <td>
                      <strong>{item.symbol}</strong>
                    </td>
                    <td>${item.latestPrice.toFixed(2)}</td>
                    <td>
                      <Badge variant={changeBadgeVariant(item.change1d)}>
                        {item.change1d >= 0 ? '+' : ''}{item.change1d.toFixed(2)}%
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={changeBadgeVariant(item.change1w)}>
                        {item.change1w >= 0 ? '+' : ''}{item.change1w.toFixed(2)}%
                      </Badge>
                    </td>
                    <td>
                      <MiniSparkline series={item.series} />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
      </>
    </BaseTile>
  );
}
