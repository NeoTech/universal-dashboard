import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface EarnEvent {
  symbol: string;
  date: string;
  epsEstimate: number | null;
  hour: string;
  quarter: number;
  year: number;
}

interface Props { refreshInterval?: number; }

function formatHour(hour: string): string {
  if (hour === 'bmo') return 'Pre-market';
  if (hour === 'amc') return 'After-market';
  return 'During';
}

export function FinnhubEarningsCalendarTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ calendar: EarnEvent[] }>('finnhub-earnings-calendar', { calendar: [] });

  const sorted = () =>
    [...store().calendar].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-earnings-calendar-tile">
      <div style={{ height: '100%', overflow: 'auto' }}>
        <Show when={store().calendar.length === 0}>
            <div class="cell-empty">No upcoming earnings</div>
          </Show>
          <Show when={store().calendar.length > 0}>
            <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.83rem' }}>
              <thead>
                <tr>
                  <th style={{ 'text-align': 'left', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Symbol</th>
                  <th style={{ 'text-align': 'left', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Date</th>
                  <th style={{ 'text-align': 'left', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Quarter</th>
                  <th style={{ 'text-align': 'left', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>When</th>
                  <th style={{ 'text-align': 'right', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>EPS Est.</th>
                </tr>
              </thead>
              <tbody>
                <For each={sorted()}>
                  {(item) => (
                    <tr>
                      <td style={{ padding: '4px 8px', 'font-weight': '600' }}>{item.symbol}</td>
                      <td style={{ padding: '4px 8px' }}>{item.date}</td>
                      <td style={{ padding: '4px 8px' }}>Q{item.quarter} {item.year}</td>
                      <td style={{ padding: '4px 8px' }}>{formatHour(item.hour)}</td>
                      <td style={{ padding: '4px 8px', 'text-align': 'right' }}>
                        {item.epsEstimate != null ? item.epsEstimate.toFixed(2) : '—'}
                      </td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </Show>
        </div>
    </BaseTile>
  );
}
