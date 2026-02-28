import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface Quarter {
  actual: number;
  estimate: number;
  period: string;
  quarter: number;
  surprisePercent: number;
  year: number;
}

interface SymbolEarnings {
  symbol: string;
  quarters: Quarter[];
}

interface Props { refreshInterval?: number; }

function surpriseVariant(pct: number): BadgeVariant {
  if (pct > 0) return 'success';
  if (pct < 0) return 'danger';
  return 'neutral';
}

export function EarningsSurprisesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ surprises: SymbolEarnings[] }>('finnhub-earnings-surprises', { surprises: [] });
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selected = () => store().surprises[selectedIdx()] ?? null;

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-earnings-surprises-tile">
      <div style={{ height: '100%', display: 'flex', 'flex-direction': 'column' }}>
        <Show when={store().surprises.length === 0}>
            <div class="cell-empty">No earnings data available</div>
          </Show>
          <Show when={store().surprises.length > 0}>
            <Show when={store().surprises.length > 1}>
              <select
                value={selectedIdx()}
                onChange={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
                style={{ 'margin-bottom': '8px', padding: '4px 8px', 'font-size': '0.85rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', 'border-radius': '4px' }}
              >
                <For each={store().surprises}>
                  {(item, i) => <option value={i()}>{item.symbol}</option>}
                </For>
              </select>
            </Show>
            <Show when={selected()}>
              {(sym) => (
                <div style={{ overflow: 'auto', flex: '1' }}>
                  <div style={{ 'font-weight': '700', 'margin-bottom': '8px' }}>{sym().symbol}</div>
                  <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.83rem' }}>
                    <thead>
                      <tr>
                        <th style={{ 'text-align': 'left', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Period</th>
                        <th style={{ 'text-align': 'right', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Actual</th>
                        <th style={{ 'text-align': 'right', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Estimate</th>
                        <th style={{ 'text-align': 'right', padding: '4px 8px', 'border-bottom': '1px solid var(--color-border)' }}>Surprise%</th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={sym().quarters}>
                        {(q) => (
                          <tr>
                            <td style={{ padding: '4px 8px' }}>{q.period}</td>
                            <td style={{ padding: '4px 8px', 'text-align': 'right' }}>{q.actual.toFixed(2)}</td>
                            <td style={{ padding: '4px 8px', 'text-align': 'right' }}>{q.estimate.toFixed(2)}</td>
                            <td style={{ padding: '4px 8px', 'text-align': 'right' }}>
                              <Badge variant={surpriseVariant(q.surprisePercent)}>
                                {q.surprisePercent > 0 ? '+' : ''}{q.surprisePercent.toFixed(2)}%
                              </Badge>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              )}
            </Show>
          </Show>
        </div>
    </BaseTile>
  );
}
