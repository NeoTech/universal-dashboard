import { For } from 'solid-js';
import type { JSX } from 'solid-js';

/** A single row in a {@link BarChart}. */
interface BarChartItem {
  /** Row label shown to the left of the bar. */
  label: string;
  /** Numeric value that determines bar width relative to the maximum. */
  value: number;
  /** Optional CSS colour string for this bar; falls back to `--color-accent`. */
  color?: string;
}

/** Props for {@link BarChart}. */
interface Props {
  /** Data rows to render. */
  items: BarChartItem[];
  /** Maximum number of rows to display; excess items are sliced off. Default: 10. */
  maxItems?: number;
  /** Row height in pixels. Default: 14. */
  height?: number;
  /** Show the numeric value to the right of each bar. Default: `true`. */
  showValues?: boolean;
  /** Custom value formatter. Default: `String(v)`. */
  formatValue?: (v: number) => string;
}

/**
 * Horizontal bar chart for ranked list data.
 *
 * Bar widths are proportional to the maximum value in the current dataset.
 * Ideal for leaderboards, top-N breakdowns, and similar ranked views.
 *
 * @param props - See {@link Props}.
 * @returns A flex column of labelled, animated bar rows.
 */
export function BarChart(props: Props): JSX.Element {
  const items = () => props.items.slice(0, props.maxItems ?? 10);
  const maxVal = () => Math.max(...items().map(i => i.value), 1);
  const fmt = () => props.formatValue ?? ((v: number) => String(v));

  return (
    <div class="bar-chart" style={{ display: 'flex', 'flex-direction': 'column', gap: '4px' }}>
      <For each={items()}>
        {(item) => {
          const pct = () => Math.max((item.value / maxVal()) * 100, 1);
          return (
            <div class="bar-chart-row" style={{ display: 'flex', 'align-items': 'center', gap: '8px', 'font-size': '12px' }}>
              <span class="bar-label" style={{ 'min-width': '100px', 'max-width': '120px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap', 'text-align': 'right' }} title={item.label}>
                {item.label}
              </span>
              <div class="bar-track" style={{ flex: 1, background: 'var(--color-bg-secondary, rgba(255,255,255,0.1))', 'border-radius': '3px', height: `${props.height ?? 14}px`, overflow: 'hidden' }}>
                <div
                  class="bar-fill"
                  style={{
                    width: `${pct()}%`,
                    height: '100%',
                    background: item.color ?? 'var(--color-accent, #4f8ef7)',
                    'border-radius': '3px',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
              {props.showValues !== false && (
                <span class="bar-value" style={{ 'min-width': '50px', 'font-variant-numeric': 'tabular-nums' }}>
                  {fmt()(item.value)}
                </span>
              )}
            </div>
          );
        }}
      </For>
    </div>
  );
}
