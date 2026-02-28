import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface SentimentMonth {
  year: number;
  month: number;
  change: number;
  mspr: number;
}

interface SymbolSentiment {
  symbol: string;
  data: SentimentMonth[];
  latest: SentimentMonth | null;
}

interface Props { refreshInterval?: number; }

function msprColor(mspr: number): string {
  if (mspr > 0.2) return 'var(--color-success, #22c55e)';
  if (mspr < -0.2) return 'var(--color-danger, #ef4444)';
  return 'var(--color-warning, #eab308)';
}

function msprLabel(mspr: number): string {
  if (mspr > 0.2) return 'Bullish';
  if (mspr < -0.2) return 'Bearish';
  return 'Neutral';
}

export function InsiderSentimentTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ sentiments: SymbolSentiment[] }>('finnhub-insider-sentiment', { sentiments: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile insider-sentiment-tile">
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%', gap: '12px', 'overflow-y': 'auto' }}>
        <Show when={store().sentiments.length === 0}>
            <div class="cell-empty">No insider sentiment data</div>
          </Show>
          <For each={store().sentiments}>
            {(s) => {
              const mspr = s.latest?.mspr ?? 0;
              const gaugeWidth = `${Math.min(100, Math.max(0, Math.abs(mspr) * 50 + 50))}%`;
              const color = msprColor(mspr);
              const last3 = s.data.slice(-3);
              return (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', 'border-radius': '8px', padding: '10px', display: 'flex', 'flex-direction': 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', 'align-items': 'center', gap: '8px' }}>
                    <span style={{ 'font-weight': '600' }}>{s.symbol}</span>
                    <span style={{ 'font-size': '0.8rem', color: 'var(--color-text-muted)' }}>MSPR: {mspr.toFixed(3)}</span>
                    <span style={{ 'font-size': '0.8rem', color, 'font-weight': '500' }}>{msprLabel(mspr)}</span>
                  </div>
                  <div style={{ background: 'var(--color-border)', height: '8px', 'border-radius': '4px', overflow: 'hidden' }}>
                    <div style={{ width: gaugeWidth, height: '100%', background: color, 'border-radius': '4px', transition: 'width 0.3s ease' }} />
                  </div>
                  <Show when={last3.length > 0}>
                    <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.78rem' }}>
                      <thead>
                        <tr>
                          {(['Year/Month', 'MSPR', 'Change'] as string[]).map(h => (
                            <th style={{ padding: '2px 6px', 'text-align': 'left', color: 'var(--color-text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <For each={last3}>
                          {(row) => (
                            <tr>
                              <td style={{ padding: '2px 6px' }}>{row.year}/{String(row.month).padStart(2, '0')}</td>
                              <td style={{ padding: '2px 6px' }}>{row.mspr.toFixed(3)}</td>
                              <td style={{ padding: '2px 6px' }}>{row.change.toLocaleString()}</td>
                            </tr>
                          )}
                        </For>
                      </tbody>
                    </table>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
    </BaseTile>
  );
}
