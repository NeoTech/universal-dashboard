import { For } from 'solid-js';
import type { JSX } from 'solid-js';

interface BarChartItem {
  label: string;
  value: number;
  color?: string;
}

interface Props {
  items: BarChartItem[];
  maxItems?: number;
  height?: number;
  showValues?: boolean;
  formatValue?: (v: number) => string;
}

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
