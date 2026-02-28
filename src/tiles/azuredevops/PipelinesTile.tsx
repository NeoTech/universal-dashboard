import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { AzurePipelineRun } from '../../data/azuredevops';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function resultBadge(result: AzurePipelineRun['result'], state: AzurePipelineRun['state']): BadgeVariant {
  if (state === 'inProgress' || state === 'canceling') return 'warning';
  if (result === 'succeeded') return 'success';
  if (result === 'failed') return 'danger';
  if (result === 'canceled') return 'neutral';
  return 'neutral';
}

function resultLabel(result: AzurePipelineRun['result'], state: AzurePipelineRun['state']): string {
  if (state === 'inProgress') return 'In Progress';
  if (state === 'canceling') return 'Canceling';
  if (result === 'succeeded') return 'Succeeded';
  if (result === 'failed') return 'Failed';
  if (result === 'canceled') return 'Canceled';
  return 'Unknown';
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function PipelinesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ runs: AzurePipelineRun[] }>('azuredevops-pipelines', { runs: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().runs, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile azuredevops-pipelines-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Project</th>
              <th>Pipeline</th>
              <th>Result</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().runs.length === 0}>
              <tr><td colspan="4" class="cell-empty">No pipeline runs</td></tr>
            </Show>
            <For each={pageItems()}>
              {(run) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => run._links.web.href && window.open(run._links.web.href, '_blank')}
                >
                  <td>{run.project}</td>
                  <td>{run.pipeline.name}</td>
                  <td><Badge variant={resultBadge(run.result, run.state)}>{resultLabel(run.result, run.state)}</Badge></td>
                  <td>{timeAgo(run.createdDate)}</td>
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
