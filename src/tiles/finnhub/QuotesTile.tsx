import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { FinnhubQuote } from '../../data/finnhub';

interface Props { refreshInterval?: number; }

function changeBadge(change: number): BadgeVariant {
  if (change > 0) return 'success';
  if (change < 0) return 'danger';
  return 'neutral';
}

export function QuotesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ quotes: FinnhubQuote[] }>('finnhub-quotes', { quotes: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-quotes-tile">
      <table class="tile-table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Price</th>
              <th>Change</th>
              <th>% Change</th>
              <th>High</th>
              <th>Low</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().quotes.length === 0}>
              <tr><td colspan="6" class="cell-empty">No symbols configured</td></tr>
            </Show>
            <For each={store().quotes}>
              {(q) => (
                <tr>
                  <td><strong>{q.symbol}</strong></td>
                  <td>${q.c.toFixed(2)}</td>
                  <td><Badge variant={changeBadge(q.d)}>{q.d >= 0 ? '+' : ''}{q.d.toFixed(2)}</Badge></td>
                  <td><Badge variant={changeBadge(q.dp)}>{q.dp >= 0 ? '+' : ''}{q.dp.toFixed(2)}%</Badge></td>
                  <td>${q.h.toFixed(2)}</td>
                  <td>${q.l.toFixed(2)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
    </BaseTile>
  );
}
