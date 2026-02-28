import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { HibpBreach } from '../../data/hibp';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

export function BreachesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ results: HibpBreach[] }>('hibp-breaches', { results: [] });

  const totalBreaches = () => store().results.reduce((sum, r) => sum + r.breaches.length, 0);
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().results, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile hibp-breaches-tile">
      <>
          {totalBreaches() > 0 && (
            <p class="tile-alert">⚠ {totalBreaches()} breach{totalBreaches() !== 1 ? 'es' : ''} found across {store().results.filter(r => r.breaches.length > 0).length} email{store().results.filter(r => r.breaches.length > 0).length !== 1 ? 's' : ''}</p>
          )}
          {totalBreaches() === 0 && store().results.length > 0 && (
            <p class="tile-success">✓ No breaches found for monitored emails</p>
          )}
          <table class="tile-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Breaches</th>
                <th>Latest Breach</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().results.length === 0}>
                <tr><td colspan="3" class="cell-empty">No emails configured</td></tr>
              </Show>
              <For each={pageItems()}>
                {(result) => (
                  <tr>
                    <td>{result.email}</td>
                    <td>
                      <Badge variant={result.breaches.length > 0 ? 'danger' : 'success'}>
                        {result.breaches.length}
                      </Badge>
                    </td>
                    <td>
                      {result.breaches.length > 0
                        ? result.breaches.sort((a, b) => b.BreachDate.localeCompare(a.BreachDate))[0]?.Title ?? '—'
                        : '—'}
                    </td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
          <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
        </>
    </BaseTile>
  );
}
