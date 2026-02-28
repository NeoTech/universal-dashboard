import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Recommendation {
  buy: number;
  hold: number;
  sell: number;
  strongBuy: number;
  strongSell: number;
  period: string;
}

interface SymbolConsensus {
  symbol: string;
  recommendation: Recommendation;
}

interface Props { refreshInterval?: number; }

interface Segment {
  label: string;
  count: number;
  color: string;
}

function buildSegments(rec: Recommendation): Segment[] {
  return [
    { label: 'Strong Buy', count: rec.strongBuy, color: '#16a34a' },
    { label: 'Buy', count: rec.buy, color: '#4ade80' },
    { label: 'Hold', count: rec.hold, color: '#facc15' },
    { label: 'Sell', count: rec.sell, color: '#f97316' },
    { label: 'Strong Sell', count: rec.strongSell, color: '#dc2626' },
  ];
}

export function AnalystConsensusTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ consensus: SymbolConsensus[] }>('finnhub-analyst-consensus', { consensus: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-analyst-consensus-tile">
      <div style={{ height: '100%', overflow: 'auto' }}>
        <Show when={store().consensus.length === 0}>
            <div class="cell-empty">No analyst data available</div>
          </Show>
          <For each={store().consensus}>
            {(item) => {
              const segments = buildSegments(item.recommendation);
              const total = segments.reduce((s, seg) => s + seg.count, 0);
              return (
                <div style={{ 'margin-bottom': '16px', padding: '0 4px' }}>
                  <div style={{ 'font-weight': '700', 'margin-bottom': '4px' }}>{item.symbol}</div>
                  <div style={{ display: 'flex', height: '20px', 'border-radius': '4px', overflow: 'hidden', 'margin-bottom': '4px' }}>
                    <For each={segments}>
                      {(seg) => (
                        <Show when={seg.count > 0 && total > 0}>
                          <div
                            style={{
                              flex: String(seg.count / total),
                              background: seg.color,
                              display: 'flex',
                              'align-items': 'center',
                              'justify-content': 'center',
                              'font-size': '0.7rem',
                              color: '#fff',
                              'font-weight': '700',
                            }}
                            title={`${seg.label}: ${seg.count}`}
                          >
                            {seg.count > 0 ? seg.count : ''}
                          </div>
                        </Show>
                      )}
                    </For>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', 'font-size': '0.72rem', color: 'var(--color-text-muted)', 'flex-wrap': 'wrap' }}>
                    <For each={segments}>
                      {(seg) => (
                        <span>
                          <span style={{ display: 'inline-block', width: '8px', height: '8px', background: seg.color, 'border-radius': '2px', 'margin-right': '2px' }} />
                          {seg.label}: {seg.count}
                        </span>
                      )}
                    </For>
                  </div>
                  <div style={{ 'font-size': '0.72rem', color: 'var(--color-text-muted)', 'margin-top': '2px' }}>
                    Period: {item.recommendation.period}
                  </div>
                </div>
              );
            }}
          </For>
      </div>
    </BaseTile>
  );
}
