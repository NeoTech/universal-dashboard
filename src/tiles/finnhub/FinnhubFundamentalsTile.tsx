import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface FhFundamentals {
  symbol: string;
  peNormalizedAnnual: number | null;
  pbAnnual: number | null;
  psTTM: number | null;
  epsBasicExclExtraItemsAnnual: number | null;
  roaRfy: number | null;
  roeRfy: number | null;
  debtEquityAnnual: number | null;
  dividendYieldIndicatedAnnual: number | null;
  '52WeekHigh': number | null;
  '52WeekLow': number | null;
  beta: number | null;
  marketCapitalization: number | null;
}

interface Props { refreshInterval?: number; }

function fmtNum(v: number | null, decimals = 2): string {
  if (v == null) return '—';
  return v.toFixed(decimals);
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return (v * 100).toFixed(2) + '%';
}

function fmtMarketCap(v: number | null): string {
  if (v == null) return '—';
  if (v > 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  return '$' + (v / 1e6).toFixed(2) + 'M';
}

export function FinnhubFundamentalsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ fundamentals: FhFundamentals[] }>('finnhub-fundamentals', { fundamentals: [] });
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selected = () => store().fundamentals[selectedIdx()] ?? null;

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-fundamentals-tile">
      <div style={{ height: '100%', display: 'flex', 'flex-direction': 'column' }}>
        <Show when={store().fundamentals.length === 0}>
            <div class="cell-empty">No fundamentals data available</div>
          </Show>
          <Show when={store().fundamentals.length > 0}>
            <Show when={store().fundamentals.length > 1}>
              <select
                value={selectedIdx()}
                onChange={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
                style={{ 'margin-bottom': '8px', padding: '4px 8px', 'font-size': '0.85rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', 'border-radius': '4px' }}
              >
                <For each={store().fundamentals}>
                  {(item, i) => <option value={i()}>{item.symbol}</option>}
                </For>
              </select>
            </Show>
            <Show when={selected()}>
              {(sym) => (
                <div style={{ overflow: 'auto', flex: '1' }}>
                  <div style={{ 'font-weight': '700', 'margin-bottom': '8px', 'font-size': '0.9rem' }}>{sym().symbol}</div>
                  <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '6px 16px', 'font-size': '0.83rem' }}>
                    <For each={[
                      { label: 'P/E', value: fmtNum(sym().peNormalizedAnnual) },
                      { label: 'P/B', value: fmtNum(sym().pbAnnual) },
                      { label: 'P/S', value: fmtNum(sym().psTTM) },
                      { label: 'EPS', value: fmtNum(sym().epsBasicExclExtraItemsAnnual) },
                      { label: 'ROA', value: fmtPct(sym().roaRfy) },
                      { label: 'ROE', value: fmtPct(sym().roeRfy) },
                      { label: 'D/E', value: fmtNum(sym().debtEquityAnnual) },
                      { label: 'Div Yield', value: fmtPct(sym().dividendYieldIndicatedAnnual) },
                      { label: '52W High', value: fmtNum(sym()['52WeekHigh']) },
                      { label: '52W Low', value: fmtNum(sym()['52WeekLow']) },
                      { label: 'Beta', value: fmtNum(sym().beta) },
                      { label: 'Market Cap', value: fmtMarketCap(sym().marketCapitalization) },
                    ]}>
                      {(kpi) => (
                        <div style={{ display: 'flex', 'justify-content': 'space-between', padding: '3px 6px', 'border-radius': '4px', background: 'var(--color-surface-alt, var(--color-surface))' }}>
                          <span style={{ color: 'var(--color-text-muted)' }}>{kpi.label}</span>
                          <span style={{ 'font-weight': '600' }}>{kpi.value}</span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </Show>
        </div>
    </BaseTile>
  );
}
