import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { VirusTotalAnalysis } from '../../data/virustotal';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function threatBadge(malicious: number, suspicious: number): BadgeVariant {
  if (malicious > 0) return 'danger';
  if (suspicious > 0) return 'warning';
  return 'success';
}

function threatLabel(malicious: number, suspicious: number): string {
  if (malicious > 0) return `${malicious} malicious`;
  if (suspicious > 0) return `${suspicious} suspicious`;
  return 'Clean';
}

export function AnalysesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ results: VirusTotalAnalysis[] }>('virustotal-analyses', { results: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().results, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile virustotal-analyses-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Domain</th>
              <th>Threat</th>
              <th>Reputation</th>
              <th>Country</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().results.length === 0}>
              <tr><td colspan="4" class="cell-empty">No domains configured</td></tr>
            </Show>
            <For each={pageItems()}>
              {(result) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://www.virustotal.com/gui/domain/${result.domain}`, '_blank')}
                >
                  <td>{result.domain}</td>
                  <td>
                    <Badge variant={threatBadge(result.stats.malicious, result.stats.suspicious)}>
                      {threatLabel(result.stats.malicious, result.stats.suspicious)}
                    </Badge>
                  </td>
                  <td>{result.reputation}</td>
                  <td>{result.country ?? '—'}</td>
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
