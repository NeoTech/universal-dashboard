import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import type { AzureWorkItem } from '../../data/azuredevops';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

function truncate(s: string, n = 50): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function WorkItemsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ workItems: AzureWorkItem[] }>('azuredevops-workitems', { workItems: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().workItems, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile azuredevops-workitems-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Type</th>
              <th>State</th>
              <th>Assigned To</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().workItems.length === 0}>
              <tr><td colspan="5" class="cell-empty">No work items</td></tr>
            </Show>
            <For each={pageItems()}>
              {(item) => (
                <tr style={{ cursor: 'pointer' }} onClick={() => window.open(item.url, '_blank')}>
                  <td>{item.id}</td>
                  <td title={item.fields['System.Title']}>{truncate(item.fields['System.Title'])}</td>
                  <td>{item.fields['System.WorkItemType']}</td>
                  <td>{item.fields['System.State']}</td>
                  <td>{item.fields['System.AssignedTo']?.displayName ?? '—'}</td>
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
