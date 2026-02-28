import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface EconIndicator {
  name: string;
  unit: string;
  interval: string;
  latestDate: string;
  latestValue: number;
  prevDate: string;
  prevValue: number;
}

interface EconData {
  indicators: EconIndicator[];
}

interface Props { refreshInterval?: number; }

function formatValue(val: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u.includes('percent')) return val.toFixed(2) + '%';
  if (u.includes('billion')) {
    if (val >= 1000) return '$' + (val / 1000).toFixed(1) + 'T';
    return '$' + val.toFixed(0) + 'B';
  }
  return val.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function EconomicIndicatorsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<EconData>('alphavantage-economic-indicators', { indicators: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile economic-indicators-tile" skeletonLines={4}>
      <div style={{ display: 'grid', 'grid-template-columns': 'repeat(2, 1fr)', gap: '8px', padding: '8px' }}>
          <For each={store().indicators}>
            {(ind) => {
              const change = ind.latestValue - ind.prevValue;
              const isPositive = change > 0;
              const isNegative = change < 0;
              return (
                <div style={{
                  background: 'var(--color-surface-raised, var(--color-surface))',
                  border: '1px solid var(--color-border)',
                  'border-radius': '6px',
                  padding: '10px',
                  display: 'flex',
                  'flex-direction': 'column',
                  gap: '4px',
                }}>
                  <div style={{ 'font-weight': 600, 'font-size': '0.78rem', color: 'var(--color-text-secondary)' }}>{ind.name}</div>
                  <div style={{ display: 'flex', 'align-items': 'baseline', gap: '4px' }}>
                    <span style={{ 'font-size': '1.35rem', 'font-weight': 700, 'font-variant-numeric': 'tabular-nums' }}>
                      {formatValue(ind.latestValue, ind.unit)}
                    </span>
                    <Show when={change !== 0}>
                      <span style={{ 'font-size': '0.78rem', color: isPositive ? 'var(--color-success, #22c55e)' : isNegative ? 'var(--color-danger, #ef4444)' : 'inherit' }}>
                        {isPositive ? '↑' : '↓'}
                      </span>
                    </Show>
                  </div>
                  <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary)' }}>
                    {ind.latestDate}
                  </div>
                  <Show when={ind.prevValue !== 0}>
                    <div style={{ 'font-size': '0.7rem', color: isPositive ? 'var(--color-success, #22c55e)' : isNegative ? 'var(--color-danger, #ef4444)' : 'var(--color-text-secondary)' }}>
                      {isPositive ? '+' : ''}{formatValue(change, ind.unit)} from {ind.prevDate}
                    </div>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
        <Show when={store().indicators.length === 0}>
          <p class="tile-empty" style={{ padding: '16px', 'text-align': 'center', color: 'var(--color-text-secondary)' }}>
            No economic data available. Check ALPHA_VANTAGE_KEY.
          </p>
        </Show>
    </BaseTile>
  );
}
