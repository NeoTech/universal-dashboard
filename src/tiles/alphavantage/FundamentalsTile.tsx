import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Fundamental {
  symbol: string;
  name: string;
  sector: string;
  industry: string;
  exchange: string;
  marketCap: string;
  peRatio: string;
  eps: string;
  dividendYield: string;
  week52High: string;
  week52Low: string;
  analystTargetPrice: string;
  beta: string;
  profitMargin: string;
}

interface FundamentalsData {
  companies: Fundamental[];
}

interface Props {
  refreshInterval?: number;
}

function formatMarketCap(raw: string): string {
  const n = parseFloat(raw);
  if (isNaN(n)) return raw || '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toFixed(0)}`;
}

function fmtVal(val: string): string {
  return val && val !== 'None' && val !== '-' ? val : '—';
}

function KpiCell(props: { label: string; value: string }): JSX.Element {
  return (
    <div style={{ padding: '8px', background: 'var(--color-surface)', 'border-radius': '6px', border: '1px solid var(--color-border)' }}>
      <div style={{ 'font-size': '0.7rem', color: 'var(--color-text-muted)', 'margin-bottom': '2px' }}>{props.label}</div>
      <div style={{ 'font-size': '0.9rem', 'font-weight': '600' }}>{props.value}</div>
    </div>
  );
}

export function FundamentalsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<FundamentalsData>(
    'alphavantage-fundamentals',
    { companies: [] },
  );

  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const company = () => store().companies[selectedIdx()] as Fundamental | undefined;

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile fundamentals-tile" skeletonLines={6}>
      <Show
        when={store().companies.length > 0}
        fallback={<p class="tile-empty">No fundamentals data</p>}
      >
          <Show when={store().companies.length > 1}>
            <div style={{ padding: '4px 8px' }}>
              <select
                style={{
                  width: '100%',
                  padding: '4px 6px',
                  background: 'var(--color-surface)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  'border-radius': '4px',
                  'font-size': '0.85rem',
                }}
                value={selectedIdx()}
                onInput={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
              >
                <For each={store().companies}>
                  {(c, i) => <option value={i()}>{c.symbol} — {c.name}</option>}
                </For>
              </select>
            </div>
          </Show>

          <Show when={company()}>
            {(c) => (
              <>
                <div style={{ padding: '4px 8px 2px' }}>
                  <strong>{c().symbol}</strong>
                  <span style={{ 'font-size': '0.75rem', color: 'var(--color-text-muted)', 'margin-left': '6px' }}>
                    {c().exchange} · {c().sector}
                  </span>
                </div>
                <div
                  class="kpi-grid"
                  style={{ display: 'grid', 'grid-template-columns': 'repeat(2, 1fr)', gap: '8px', padding: '8px', 'overflow-y': 'auto' }}
                >
                  <KpiCell label="PE Ratio" value={fmtVal(c().peRatio)} />
                  <KpiCell label="EPS" value={fmtVal(c().eps)} />
                  <KpiCell label="Market Cap" value={formatMarketCap(c().marketCap)} />
                  <KpiCell label="Dividend Yield" value={fmtVal(c().dividendYield)} />
                  <KpiCell label="52W High" value={fmtVal(c().week52High)} />
                  <KpiCell label="52W Low" value={fmtVal(c().week52Low)} />
                  <KpiCell label="Beta" value={fmtVal(c().beta)} />
                  <KpiCell label="Profit Margin" value={fmtVal(c().profitMargin)} />
                  <KpiCell label="Analyst Target" value={fmtVal(c().analystTargetPrice)} />
                </div>
              </>
            )}
          </Show>
        </Show>
    </BaseTile>
  );
}
