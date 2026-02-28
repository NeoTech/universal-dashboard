import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import type { SonarQualityGate, SonarQualityGateStatus } from '../../data/sonarqube';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function qualityBadge(status: SonarQualityGateStatus): BadgeVariant {
  if (status === 'OK') return 'success';
  if (status === 'WARN') return 'warning';
  if (status === 'ERROR') return 'danger';
  return 'neutral';
}

export function QualityTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ gates: SonarQualityGate[] }>('sonarqube-quality', { gates: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().gates, 10);

  const summary = () => {
    const gates = store().gates;
    const ok = gates.filter(g => g.status === 'OK').length;
    const failing = gates.filter(g => g.status === 'ERROR').length;
    return { ok, failing };
  };

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile sonarqube-quality-tile">
      <>
          <p class="tile-summary">
            <span class="summary-ok">{summary().ok} passing</span>
            {summary().failing > 0 && (
              <span class="summary-fail"> · {summary().failing} failing</span>
            )}
          </p>
          <table class="tile-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Quality Gate</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().gates.length === 0}>
                <tr><td colspan="2" class="cell-empty">No projects</td></tr>
              </Show>
              <For each={pageItems()}>
                {(gate) => (
                  <tr>
                    <td>{gate.projectName}</td>
                    <td><Badge variant={qualityBadge(gate.status)}>{gate.status}</Badge></td>
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
