import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { CircleCIWorkflow } from '../../data/circleci';
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

function workflowDuration(started_at: string, stopped_at: string | null): string {
  if (!stopped_at) return '—';
  const secs = Math.floor((new Date(stopped_at).getTime() - new Date(started_at).getTime()) / 1000);
  if (secs < 0) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function statusBadge(status: CircleCIWorkflow['status']): BadgeVariant {
  switch (status) {
    case 'success':  return 'success';
    case 'running':
    case 'failing':  return 'warning';
    case 'failed':
    case 'error':    return 'danger';
    default:         return 'neutral';
  }
}

export function InsightsTile(_props: Props): JSX.Element {
  const { data, loading, error } = useSseChannel<{ workflows: CircleCIWorkflow[] }>(
    'circleci-insights',
    { workflows: [] }
  );
  const { page, setPage, totalPages, pageItems } = usePagination(() => data().workflows, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile circleci-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Project</th>
              <th>Status</th>
              <th>Started</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            <Show when={data().workflows.length === 0}>
              <tr><td colspan="5" class="cell-empty">No workflow data found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(wf) => (
                <tr class="tr--link" title={`Workflow: ${wf.name}`}>
                  <td class="cell-truncate">{wf.name}</td>
                  <td class="cell-truncate" title={wf.project_slug}>{wf.project_slug.split('/').slice(-1)[0]}</td>
                  <td><Badge variant={statusBadge(wf.status)}>{wf.status}</Badge></td>
                  <td>{timeAgo(wf.started_at)}</td>
                  <td>{workflowDuration(wf.started_at, wf.stopped_at)}</td>
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
