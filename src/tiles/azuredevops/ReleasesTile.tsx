import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { AzureRelease } from '../../data/azuredevops';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function statusBadge(status: AzureRelease['status']): BadgeVariant {
  if (status === 'active') return 'success';
  if (status === 'abandoned') return 'danger';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function ReleasesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ releases: AzureRelease[] }>('azuredevops-releases', { releases: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().releases, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile azuredevops-releases-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Release</th>
              <th>Definition</th>
              <th>Status</th>
              <th>Modified</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().releases.length === 0}>
              <tr><td colspan="5" class="cell-empty">No releases</td></tr>
            </Show>
            <For each={pageItems()}>
              {(release) => (
                <tr>
                  <td>{release.project}</td>
                  <td>{release.name}</td>
                  <td>{release.releaseDefinition.name}</td>
                  <td><Badge variant={statusBadge(release.status)}>{release.status}</Badge></td>
                  <td>{timeAgo(release.modifiedOn)}</td>
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
