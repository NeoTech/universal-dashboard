import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { TravisBuild } from '../../data/travisci';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function timeAgo(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDuration(secs: number | null): string {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function stateBadge(state: TravisBuild['state']): BadgeVariant {
  switch (state) {
    case 'passed':   return 'success';
    case 'failed':
    case 'errored':  return 'danger';
    case 'started':  return 'warning';
    default:         return 'neutral';
  }
}

export function BuildsTile(_props: Props): JSX.Element {
  const { data, loading, error } = useSseChannel<{ builds: TravisBuild[] }>(
    'travis-builds',
    { builds: [] }
  );
  const { page, setPage, totalPages, pageItems } = usePagination(() => data().builds, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile travisci-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Branch</th>
              <th>State</th>
              <th>Duration</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={data().builds.length === 0}>
              <tr><td colspan="5" class="cell-empty">No builds found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(build) => (
                <tr
                  class="tr--link"
                  title={`${build.repository.slug} #${build.number}`}
                  onClick={() => build.commit?.compare_url && window.open(build.commit.compare_url, '_blank', 'noopener')}
                >
                  <td class="cell-truncate">{build.repository.slug}</td>
                  <td class="cell-truncate">{build.branch?.name ?? '—'}</td>
                  <td><Badge variant={stateBadge(build.state)}>{build.state}</Badge></td>
                  <td>{formatDuration(build.duration)}</td>
                  <td>{timeAgo(build.finished_at ?? build.started_at)}</td>
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
