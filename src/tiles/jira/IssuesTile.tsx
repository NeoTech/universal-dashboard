import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { JiraIssue } from '../../data/jira';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function statusBadge(categoryKey: string): BadgeVariant {
  if (categoryKey === 'done') return 'success';
  if (categoryKey === 'indeterminate') return 'warning';
  if (categoryKey === 'new') return 'neutral';
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
  const { data: store, loading, error } = useSseChannel<{ issues: JiraIssue[]; total: number }>('jira-issues', { issues: [], total: 0 });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().issues, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile jira-issues-tile">
      <>
          {store().total > 0 && (
            <p class="tile-summary">Showing {store().issues.length} of {store().total} issues</p>
          )}
          <table class="tile-table">
            <thead>
              <tr>
                <th>Key</th>
                <th>Summary</th>
                <th>Type</th>
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
                  <tr
                    style={{ cursor: 'pointer' }}
                    onClick={() => issue.browseUrl && window.open(issue.browseUrl, '_blank')}
                  >
                    <td>{issue.key}</td>
                    <td title={issue.fields.summary}>{issue.fields.summary.length > 50 ? issue.fields.summary.slice(0, 50) + '…' : issue.fields.summary}</td>
                    <td>{issue.fields.issuetype.name}</td>
                    <td>
                      <Badge variant={statusBadge(issue.fields.status.statusCategory.key)}>
                        {issue.fields.status.name}
                      </Badge>
                    </td>
                    <td>{issue.fields.assignee?.displayName ?? '—'}</td>
                    <td>{timeAgo(issue.fields.updated)}</td>
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
