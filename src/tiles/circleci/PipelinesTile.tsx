import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { CircleCIPipeline, CircleCIWorkflow } from '../../data/circleci';
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

function pipelineStateBadge(state: CircleCIPipeline['state']): BadgeVariant {
  switch (state) {
    case 'created':      return 'neutral';
    case 'errored':      return 'danger';
    case 'pending':
    case 'setup':
    case 'setup-pending': return 'warning';
    default:             return 'neutral';
  }
}

export function PipelinesTile(_props: Props): JSX.Element {
  const { data, loading, error } = useSseChannel<{ pipelines: CircleCIPipeline[]; workflows: CircleCIWorkflow[] }>(
    'circleci-pipelines',
    { pipelines: [], workflows: [] }
  );
  const { page, setPage, totalPages, pageItems } = usePagination(() => data().pipelines, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile circleci-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Pipeline #</th>
              <th>Branch</th>
              <th>Trigger</th>
              <th>State</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={data().pipelines.length === 0}>
              <tr><td colspan="5" class="cell-empty">No pipelines found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(pipeline) => (
                <tr class="tr--link" title={`Pipeline #${pipeline.number}`}>
                  <td>{pipeline.number}</td>
                  <td class="cell-truncate">{pipeline.vcs?.branch ?? pipeline.vcs?.tag ?? '—'}</td>
                  <td>{pipeline.trigger.type}</td>
                  <td><Badge variant={pipelineStateBadge(pipeline.state)}>{pipeline.state}</Badge></td>
                  <td>{timeAgo(pipeline.created_at)}</td>
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
