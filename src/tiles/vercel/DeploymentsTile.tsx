import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { VercelDeployment } from '../../data/vercel';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function timeAgo(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function stateBadge(state: VercelDeployment['state']): BadgeVariant {
  switch (state) {
    case 'READY':        return 'success';
    case 'ERROR':        return 'danger';
    case 'BUILDING':
    case 'INITIALIZING':
    case 'QUEUED':       return 'warning';
    default:             return 'neutral';
  }
}

function targetBadge(target: VercelDeployment['target']): BadgeVariant {
  return target === 'production' ? 'success' : 'warning';
}

export function DeploymentsTile(_props: Props): JSX.Element {
  const { data: deployments, loading, error } = useSseChannel<VercelDeployment[]>('vercel-deployments', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => deployments(), 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile vercel-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Target</th>
              <th>State</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={deployments().length === 0}>
              <tr><td colspan="4" class="cell-empty">No deployments found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(d) => (
                <tr
                  class="tr--link"
                  title={`Open deployment on Vercel`}
                  onClick={() => window.open('https://vercel.com/' + d.url, '_blank', 'noopener')}
                >
                  <td class="cell-truncate">{d.name}</td>
                  <td>
                    <Show when={d.target} fallback={<Badge variant="neutral">—</Badge>}>
                      <Badge variant={targetBadge(d.target)}>{d.target}</Badge>
                    </Show>
                  </td>
                  <td><Badge variant={stateBadge(d.state)}>{d.state}</Badge></td>
                  <td>{timeAgo(d.created)}</td>
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
