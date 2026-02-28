import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface CalendarEvent {
  symbol: string;
  name: string;
  reportDate: string;
  fiscalDateEnding: string;
  estimate: string;
  currency: string;
}

interface CalendarData {
  events: CalendarEvent[];
}

interface Props {
  refreshInterval?: number;
}

export function EarningsCalendarTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<CalendarData>(
    'alphavantage-earnings-calendar',
    { events: [] },
  );

  const sorted = () =>
    store()
      .events.slice()
      .sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const { page, setPage, totalPages, pageItems } = usePagination(() => sorted(), 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile earnings-calendar-tile">
      <Show
        when={sorted().length > 0}
        fallback={<p class="tile-empty">No upcoming earnings data</p>}
      >
          <table class="tile-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Company</th>
                <th>Report Date</th>
                <th>Est. EPS</th>
                <th>Currency</th>
              </tr>
            </thead>
            <tbody>
              <For each={pageItems()}>
                {(event) => (
                  <tr>
                    <td>
                      <strong>{event.symbol}</strong>
                    </td>
                    <td style={{ 'max-width': '160px', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' }}>
                      {event.name}
                    </td>
                    <td>{event.reportDate}</td>
                    <td>{event.estimate !== '' ? event.estimate : '—'}</td>
                    <td>{event.currency || '—'}</td>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </Show>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
    </BaseTile>
  );
}
