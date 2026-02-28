import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface QuarterlyEarning {
  fiscalDateEnding: string;
  reportedDate: string;
  reportedEPS: string;
  estimatedEPS: string;
  surprise: string;
  surprisePercentage: string;
}

interface EarningsData {
  symbol: string;
  annualEarnings: { fiscalDateEnding: string; reportedEPS: string }[];
  quarterlyEarnings: QuarterlyEarning[];
}

interface Props {
  refreshInterval?: number;
}

function surpriseVariant(surprise: string): BadgeVariant {
  const n = parseFloat(surprise);
  if (isNaN(n)) return 'neutral';
  if (n > 0) return 'success';
  if (n < 0) return 'danger';
  return 'neutral';
}

export function EarningsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ earnings: EarningsData[] }>('alphavantage-earnings', { earnings: [] });
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  const selected = () => store().earnings[selectedIndex()];
  const quarters = () => selected()?.quarterlyEarnings ?? [];

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile earnings-tile">
      <>
        <Show when={store().earnings.length === 0}>
            <p class="cell-empty">No earnings data — set AV_SYMBOLS env var</p>
          </Show>
          <Show when={store().earnings.length > 0}>
            <Show when={store().earnings.length > 1}>
              <div style={{ display: 'flex', gap: '6px', 'margin-bottom': '8px' }}>
                <For each={store().earnings}>{(e, i) => (
                  <button
                    style={{
                      padding: '4px 10px',
                      cursor: 'pointer',
                      background: selectedIndex() === i() ? 'var(--color-primary)' : 'transparent',
                      border: '1px solid var(--color-border)',
                      'border-radius': '4px',
                    }}
                    onClick={() => setSelectedIndex(i())}
                  >
                    {e.symbol}
                  </button>
                )}</For>
              </div>
            </Show>
            <table class="tile-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th>EPS</th>
                  <th>Estimate</th>
                  <th>Surprise</th>
                  <th>Surprise%</th>
                </tr>
              </thead>
              <tbody>
                <Show when={quarters().length === 0}>
                  <tr><td colspan="5" class="cell-empty">No quarterly data</td></tr>
                </Show>
                <For each={quarters()}>{(q) => (
                  <tr>
                    <td>{q.fiscalDateEnding}</td>
                    <td>{q.reportedEPS}</td>
                    <td>{q.estimatedEPS}</td>
                    <td>
                      <Badge variant={surpriseVariant(q.surprise)}>
                        {q.surprise}
                      </Badge>
                    </td>
                    <td>{q.surprisePercentage}</td>
                  </tr>
                )}</For>
              </tbody>
            </table>
          </Show>
      </>
    </BaseTile>
  );
}
