import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { SlackMessage } from '../../data/slack';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function tsToTime(ts: string): string {
  const ms = parseFloat(ts) * 1000;
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function truncate(s: string, n = 80): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

export function MessagesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ messages: SlackMessage[] }>('slack-messages', { messages: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().messages, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile slack-messages-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Channel</th>
              <th>User</th>
              <th>Message</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().messages.length === 0}>
              <tr><td colspan="4" class="cell-empty">No messages</td></tr>
            </Show>
            <For each={pageItems()}>
              {(msg) => (
                <tr>
                  <td>#{msg.channelName ?? msg.channel}</td>
                  <td>{msg.username ?? msg.user ?? '—'}</td>
                  <td title={msg.text}>{truncate(msg.text)}</td>
                  <td>{tsToTime(msg.ts)}</td>
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
