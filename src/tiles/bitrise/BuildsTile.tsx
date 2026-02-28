import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { BitriseBuild } from '../../data/bitrise';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function statusBadge(status: BitriseBuild['status']): { variant: BadgeVariant; label: string } {
  switch (status) {
    case 1: return { variant: 'success', label: 'Passed' };
    case 2: return { variant: 'danger',  label: 'Failed' };
    case 3: return { variant: 'neutral', label: 'Aborted' };
    default: return { variant: 'warning', label: 'Running' };
  }
}

export function BuildsTile(_props: Props): JSX.Element {
  const { data, loading, error } = useSseChannel<{ builds: BitriseBuild[] }>(
    'bitrise-builds',
    { builds: [] }
  );
  const { page, setPage, totalPages, pageItems } = usePagination(() => data().builds, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile bitrise-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Branch</th>
              <th>Status</th>
              <th>Build #</th>
              <th>Commit</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={data().builds.length === 0}>
              <tr><td colspan="5" class="cell-empty">No builds found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(build) => {
                const badge = statusBadge(build.status);
                return (
                  <tr class="tr--link" title={`Build #${build.build_number} — ${build.branch}`}>
                    <td class="cell-truncate">{build.branch}</td>
                    <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td>{build.build_number}</td>
                    <td class="cell-truncate" title={build.commit_message ?? undefined}>
                      {build.commit_message ? build.commit_message.slice(0, 40) + (build.commit_message.length > 40 ? '…' : '') : '—'}
                    </td>
                    <td>{timeAgo(build.triggered_at)}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
