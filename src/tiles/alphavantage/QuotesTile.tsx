import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { AlphaVantageStockData } from '../../data/alphavantage';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

interface SseData { stocks: AlphaVantageStockData[]; rateLimit?: boolean }

function changeBadge(change: string): BadgeVariant {
  const n = parseFloat(change);
  if (n > 0) return 'success';
  if (n < 0) return 'danger';
  return 'neutral';
}

export function QuotesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<SseData>('alphavantage-quotes', { stocks: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile alphavantage-quotes-tile">
      <>
        {store().rateLimit && (
            <p class="tile-warning">⚠ Rate limit reached — showing cached data</p>
          )}
          <table class="tile-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Price</th>
                <th>Change</th>
                <th>% Change</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().stocks.length === 0}>
                <tr><td colspan="5" class="cell-empty">No stocks configured</td></tr>
              </Show>
              <For each={store().stocks}>
                {(stock) => (
                  <tr>
                    <td><strong>{stock.symbol}</strong></td>
                    <td>${parseFloat(stock.quote.price).toFixed(2)}</td>
                    <td>
                      <Badge variant={changeBadge(stock.quote.change)}>
                        {parseFloat(stock.quote.change) >= 0 ? '+' : ''}{parseFloat(stock.quote.change).toFixed(2)}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={changeBadge(stock.quote.changePercent)}>
                        {stock.quote.changePercent}
                      </Badge>
                    </td>
                    <td>{parseInt(stock.quote.volume).toLocaleString()}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
      </>
    </BaseTile>
  );
}
