import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { SonarIssue } from '../../data/sonarqube';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function severityBadge(severity: SonarIssue['severity']): BadgeVariant {
  if (severity === 'BLOCKER' || severity === 'CRITICAL') return 'danger';
  if (severity === 'MAJOR') return 'warning';
  return 'neutral';
}

function truncate(s: string, n = 60): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function IssuesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ issues: SonarIssue[]; total: number }>('sonarqube-issues', { issues: [], total: 0 });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().issues, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile sonarqube-issues-tile">
      <>
          {store().total > 0 && (
            <p class="tile-summary">{store().total} total issues</p>
          )}
          <table class="tile-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Type</th>
                <th>Component</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().issues.length === 0}>
                <tr><td colspan="4" class="cell-empty">No issues</td></tr>
              </Show>
              <For each={pageItems()}>
                {(issue) => (
                  <tr>
                    <td><Badge variant={severityBadge(issue.severity)}>{issue.severity}</Badge></td>
                    <td>{issue.type.replace('_', ' ')}</td>
                    <td title={issue.component}>{truncate(issue.component.split(':').pop() ?? issue.component, 20)}</td>
                    <td title={issue.message}>{truncate(issue.message)}</td>
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
