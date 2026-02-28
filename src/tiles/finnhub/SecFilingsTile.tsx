import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface Filing {
  form: string;
  filedDate: string;
  reportUrl: string;
  documentUrl: string;
}

interface SymbolFilings {
  symbol: string;
  filings: Filing[];
}

interface Props { refreshInterval?: number; }

function formVariant(form: string): BadgeVariant {
  if (form === '10-K') return 'success';
  if (form === '8-K') return 'warning';
  return 'neutral';
}

export function SecFilingsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ symbols: SymbolFilings[] }>('finnhub-sec-filings', { symbols: [] });
  const [selectedIdx, setSelectedIdx] = createSignal(0);

  const selected = () => store().symbols[selectedIdx()] ?? null;

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile sec-filings-tile">
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
        <Show when={store().symbols.length > 1}>
            <select
              value={selectedIdx()}
              onChange={(e) => setSelectedIdx(parseInt(e.currentTarget.value, 10))}
              style={{ 'margin-bottom': '8px', padding: '4px 8px', 'font-size': '0.85rem', background: 'var(--color-surface)', color: 'var(--color-text)', border: '1px solid var(--color-border)', 'border-radius': '4px' }}
            >
              <For each={store().symbols}>
                {(s, i) => <option value={i()}>{s.symbol}</option>}
              </For>
            </select>
          </Show>
          <Show when={selected() !== null} fallback={<div class="cell-empty">No SEC filings data</div>}>
            <div style={{ overflow: 'auto', flex: 1 }}>
              <table style={{ width: '100%', 'border-collapse': 'collapse', 'font-size': '0.82rem' }}>
                <thead>
                  <tr>
                    {(['Form', 'Filed Date', 'Links'] as string[]).map(h => (
                      <th style={{ padding: '4px 8px', 'text-align': 'left', 'border-bottom': '1px solid var(--color-border)', color: 'var(--color-text-muted)', 'white-space': 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <For each={selected()?.filings ?? []}>
                    {(filing) => (
                      <tr style={{ 'border-bottom': '1px solid var(--color-border)' }}>
                        <td style={{ padding: '4px 8px' }}><Badge variant={formVariant(filing.form)}>{filing.form}</Badge></td>
                        <td style={{ padding: '4px 8px', 'white-space': 'nowrap' }}>{filing.filedDate}</td>
                        <td style={{ padding: '4px 8px', display: 'flex', gap: '8px' }}>
                          {filing.reportUrl && (
                            <a href={filing.reportUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent, #3b82f6)', 'text-decoration': 'none', 'font-size': '0.8rem' }}>Report</a>
                          )}
                          {filing.documentUrl && (
                            <a href={filing.documentUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent, #3b82f6)', 'text-decoration': 'none', 'font-size': '0.8rem' }}>Doc</a>
                          )}
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
          </Show>
        </div>
    </BaseTile>
  );
}
