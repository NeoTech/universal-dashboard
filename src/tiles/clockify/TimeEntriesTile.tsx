import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { ClockifyTimeEntry } from '../../data/clockify';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function parseDuration(dur: string | null): string {
  if (!dur) return '—';
  // ISO 8601 duration: PT1H30M15S
  const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return dur;
  const h = parseInt(match[1] ?? '0');
  const m = parseInt(match[2] ?? '0');
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TimeEntriesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ entries: ClockifyTimeEntry[] }>('clockify-time-entries', { entries: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().entries, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile clockify-entries-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Project</th>
              <th>Duration</th>
              <th>Started</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().entries.length === 0}>
              <tr><td colspan="4" class="cell-empty">No time entries</td></tr>
            </Show>
            <For each={pageItems()}>
              {(entry) => (
                <tr>
                  <td>{entry.description || '—'}</td>
                  <td>{entry.projectName ?? entry.projectId}</td>
                  <td>{parseDuration(entry.timeInterval.duration)}</td>
                  <td>{timeAgo(entry.timeInterval.start)}</td>
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
