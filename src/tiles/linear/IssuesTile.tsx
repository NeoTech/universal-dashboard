import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { LinearIssue, LinearIssueState } from '../../data/linear';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

const PRIORITY_LABELS = ['None', 'Urgent', 'High', 'Medium', 'Low'] as const;

function stateBadge(type: LinearIssueState): BadgeVariant {
  if (type === 'completed') return 'success';
  if (type === 'started') return 'warning';
  if (type === 'cancelled') return 'neutral';
  if (type === 'triage') return 'danger';
  return 'neutral';
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function IssuesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ issues: LinearIssue[] }>('linear-issues', { issues: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().issues, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile linear-issues-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assignee</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().issues.length === 0}>
              <tr><td colspan="6" class="cell-empty">No issues</td></tr>
            </Show>
            <For each={pageItems()}>
              {(issue) => (
                <tr style={{ cursor: 'pointer' }} onClick={() => window.open(issue.url, '_blank')}>
                  <td style={{ color: issue.team.key === issue.team.key ? undefined : undefined }}>{issue.identifier}</td>
                  <td title={issue.title}>{issue.title.length > 50 ? issue.title.slice(0, 50) + '…' : issue.title}</td>
                  <td>{PRIORITY_LABELS[issue.priority] ?? 'Unknown'}</td>
                  <td>
                    <Badge variant={stateBadge(issue.state.type)}>
                      {issue.state.name}
                    </Badge>
                  </td>
                  <td>{issue.assignee?.name ?? '—'}</td>
                  <td>{timeAgo(issue.updatedAt)}</td>
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
