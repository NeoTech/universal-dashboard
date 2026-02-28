import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface ForexRate {
  pair: string;
  from: string;
  to: string;
  series: { date: string; close: number }[];
  currentRate: number;
  change: number;
  changePct: number;
}

interface ForexData {
  rates: ForexRate[];
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

export function ForexRatesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<ForexData>(
    'alphavantage-forex-rates',
    { rates: [] },
  );

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile forex-rates-tile">
      <Show
        when={store().rates.length > 0}
        fallback={<p class="tile-empty">No forex data</p>}
      >
          <table class="tile-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>Rate</th>
                <th>1d Change</th>
                <th>1d %</th>
                <th>Trend</th>
              </tr>
            </thead>
            <tbody>
              <For each={store().rates}>
                {(rate) => (
                  <tr>
                    <td>
                      <strong>{rate.pair}</strong>
                    </td>
                    <td>{rate.currentRate.toFixed(4)}</td>
                    <td>
                      <Badge variant={changeBadgeVariant(rate.change)}>
                        {rate.change >= 0 ? '+' : ''}{rate.change.toFixed(4)}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={changeBadgeVariant(rate.changePct)}>
                        {rate.changePct >= 0 ? '+' : ''}{rate.changePct.toFixed(2)}%
                      </Badge>
                    </td>
                    <td>
                      <MiniSparkline series={rate.series} />
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
    </BaseTile>
  );
}
