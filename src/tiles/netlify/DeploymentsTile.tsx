import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { NetlifyDeploy } from '../../data/netlify';
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

function contextBadge(context: NetlifyDeploy['context']): BadgeVariant {
  switch (context) {
    case 'production':    return 'success';
    case 'deploy-preview': return 'warning';
    default:              return 'neutral';
  }
}

function stateBadge(state: NetlifyDeploy['state']): BadgeVariant {
  switch (state) {
    case 'ready':    return 'success';
    case 'error':    return 'danger';
    case 'building':
    case 'uploading':
    case 'processing': return 'warning';
    default:         return 'neutral';
  }
}

export function DeploymentsTile(_props: Props): JSX.Element {
  const { data: deploys, loading, error } = useSseChannel<NetlifyDeploy[]>('netlify-deployments', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => deploys(), 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile netlify-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>Context</th>
              <th>State</th>
              <th>Branch</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={deploys().length === 0}>
              <tr><td colspan="5" class="cell-empty">No deployments found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(d) => (
                <tr
                  class="tr--link"
                  title={`Open deployment on Netlify`}
                  onClick={() => window.open(d.deploy_url || d.url, '_blank', 'noopener')}
                >
                  <td class="cell-truncate">{d.site_name}</td>
                  <td><Badge variant={contextBadge(d.context)}>{d.context}</Badge></td>
                  <td><Badge variant={stateBadge(d.state)}>{d.state}</Badge></td>
                  <td class="cell-truncate">{d.branch}</td>
                  <td>{timeAgo(d.created_at)}</td>
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
