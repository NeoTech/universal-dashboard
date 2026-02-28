import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface Commodity {
  name: string;
  unit: string;
  latestDate: string;
  latestValue: number;
  prevValue: number;
  change: number;
  changePct: number;
}

interface CommoditiesData {
  commodities: Commodity[];
}

interface Props { refreshInterval?: number; }

export function CommoditiesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<CommoditiesData>('alphavantage-commodities', { commodities: [] });

  function changeBadge(change: number): BadgeVariant {
    if (change > 0) return 'success';
    if (change < 0) return 'danger';
    return 'neutral';
  }

  function fmt(val: number): string {
    return val.toFixed(2);
  }

  function fmtPct(pct: number): string {
    return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
  }

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile commodities-tile" skeletonLines={6}>
      <table class="tile-table" style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.82rem' }}>
          <thead>
            <tr>
              <th style={{ 'text-align': 'left', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Commodity</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Price</th>
              <th style={{ 'text-align': 'left', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>Unit</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>1m Change</th>
              <th style={{ 'text-align': 'right', padding: '4px 6px', 'border-bottom': '1px solid var(--color-border)' }}>1m Change%</th>
            </tr>
          </thead>
          <tbody>
            <For each={store().commodities}>
              {(c) => (
                <tr>
                  <td style={{ padding: '4px 6px', 'font-weight': 600 }}>{c.name}</td>
                  <td style={{ padding: '4px 6px', 'text-align': 'right', 'font-variant-numeric': 'tabular-nums' }}>{fmt(c.latestValue)}</td>
                  <td style={{ padding: '4px 6px', color: 'var(--color-text-secondary)', 'font-size': '0.75rem' }}>{c.unit}</td>
                  <td style={{ padding: '4px 6px', 'text-align': 'right' }}>
                    <Badge variant={changeBadge(c.change)}>{fmt(c.change)}</Badge>
                  </td>
                  <td style={{ padding: '4px 6px', 'text-align': 'right' }}>
                    <Badge variant={changeBadge(c.changePct)}>{fmtPct(c.changePct)}</Badge>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={store().commodities.length > 0}>
          <p style={{ 'font-size': '0.7rem', color: 'var(--color-text-secondary)', 'text-align': 'right', margin: '4px 6px 0' }}>
            Latest: {store().commodities[0]?.latestDate?.substring(0, 7) ?? ''}
          </p>
        </Show>
        <Show when={store().commodities.length === 0}>
          <p class="tile-empty" style={{ padding: '16px', 'text-align': 'center', color: 'var(--color-text-secondary)' }}>
            No commodity data available. Check ALPHA_VANTAGE_KEY.
          </p>
        </Show>
    </BaseTile>
  );
}
