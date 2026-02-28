import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { InstatusOverview, InstatusComponentStatus } from '../../data/instatus';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function componentBadge(status: InstatusComponentStatus): BadgeVariant {
  if (status === 'operational') return 'success';
  if (status === 'degraded_performance') return 'warning';
  if (status === 'partial_outage') return 'warning';
  if (status === 'major_outage') return 'danger';
  if (status === 'under_maintenance') return 'neutral';
  return 'neutral';
}

function componentLabel(status: InstatusComponentStatus): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const defaultData: InstatusOverview = {
  page: { id: '', name: '', url: '', status: 'operational' },
  components: [],
  activeIncidents: [],
  activeMaintenances: [],
};

export function OverviewTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<InstatusOverview>('instatus-overview', defaultData);
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().components, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile instatus-overview-tile">
      <>
          <div class="instatus-page-status" style={{ 'margin-bottom': '8px' }}>
            <strong>{store().page.name}</strong>
            <span style={{ 'margin-left': '8px' }}><Badge variant={componentBadge(store().page.status)}>
              {componentLabel(store().page.status)}
            </Badge></span>
          </div>

          <Show when={store().activeIncidents.length > 0}>
            <p class="tile-alert">⚠ {store().activeIncidents.length} active incident{store().activeIncidents.length !== 1 ? 's' : ''}</p>
          </Show>

          <table class="tile-table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <Show when={store().components.length === 0}>
                <tr><td colspan="2" class="cell-empty">No components</td></tr>
              </Show>
              <For each={pageItems()}>
                {(component) => (
                  <tr>
                    <td>{component.name}</td>
                    <td><Badge variant={componentBadge(component.status)}>{componentLabel(component.status)}</Badge></td>
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
