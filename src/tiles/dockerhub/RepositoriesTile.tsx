import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import type { DockerHubRepo } from '../../data/dockerhub';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function RepositoriesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ repos: DockerHubRepo[] }>('dockerhub-repositories', { repos: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().repos, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile dockerhub-repos-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Repository</th>
              <th>Pulls</th>
              <th>Stars</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().repos.length === 0}>
              <tr><td colspan="4" class="cell-empty">No repositories</td></tr>
            </Show>
            <For each={pageItems()}>
              {(repo) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://hub.docker.com/r/${repo.namespace}/${repo.name}`, '_blank')}
                >
                  <td>
                    {repo.is_private && <span title="Private">🔒 </span>}
                    {repo.namespace}/{repo.name}
                  </td>
                  <td>{formatNumber(repo.pull_count)}</td>
                  <td>{repo.star_count}</td>
                  <td>{timeAgo(repo.last_updated)}</td>
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
