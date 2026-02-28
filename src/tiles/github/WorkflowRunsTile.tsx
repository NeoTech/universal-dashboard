import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { GitHubRun, GitHubRunConclusion, GitHubRunStatus } from '../../data/github';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { usePagination, PaginationBar } from '../usePagination';
import { useTileConfig } from '../TileConfigContext';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function runBadge(status: GitHubRunStatus, conclusion: GitHubRunConclusion): { label: string; variant: BadgeVariant } {
  if (status !== 'completed') {
    if (status === 'in_progress') return { label: 'Running', variant: 'warning' };
    if (status === 'queued')     return { label: 'Queued',  variant: 'neutral' };
    return { label: status,  variant: 'neutral' };
  }
  switch (conclusion) {
    case 'success':         return { label: 'Success',        variant: 'success' };
    case 'failure':         return { label: 'Failure',        variant: 'danger'  };
    case 'timed_out':       return { label: 'Timed out',      variant: 'danger'  };
    case 'action_required': return { label: 'Action needed',  variant: 'warning' };
    case 'cancelled':       return { label: 'Cancelled',      variant: 'neutral' };
    case 'skipped':         return { label: 'Skipped',        variant: 'neutral' };
    default:                return { label: conclusion ?? 'Done', variant: 'neutral' };
  }
}

export function WorkflowRunsTile(_props: Props): JSX.Element {
  const config = useTileConfig();
  const compact = () => config?.displayMode === 'compact';
  const { data: runs, loading, error } = useSseChannel<GitHubRun[]>('github-runs', []);
  const { page, setPage, totalPages, pageItems } = usePagination(() => runs(), 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile github-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Repo</th>
              <Show when={!compact()}><th>Workflow</th></Show>
              <Show when={!compact()}><th>Branch</th></Show>
              <th>Status</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={runs().length === 0}>
              <tr><td colspan={compact() ? '3' : '5'} class="cell-empty">No workflow runs found</td></tr>
            </Show>
            <For each={pageItems()}>
              {(run) => {
                const badge = runBadge(run.status, run.conclusion);
                return (
                  <tr
                    class="tr--link"
                    title={`Open run #${run.run_number} on GitHub`}
                    onClick={() => window.open(run.html_url, '_blank', 'noopener')}
                  >
                    <td class="cell-truncate">{run.repository}</td>
                    <Show when={!compact()}><td class="cell-truncate">{run.workflow_name}</td></Show>
                    <Show when={!compact()}><td class="cell-truncate">{run.head_branch}</td></Show>
                    <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                    <td>{timeAgo(run.updated_at)}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
        <Show when={!compact()}>
          <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
        </Show>
      </>
    </BaseTile>
  );
}
