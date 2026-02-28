import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { HackerNewsStory } from '../../data/hackernews';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function timeAgo(unixTs: number): string {
  const diff = Math.floor((Date.now() / 1000) - unixTs);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function TopStoriesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ stories: HackerNewsStory[] }>('hn-top-stories', { stories: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().stories, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile hn-stories-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Score</th>
              <th>Comments</th>
              <th>By</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().stories.length === 0}>
              <tr><td colspan="6" class="cell-empty">No stories</td></tr>
            </Show>
            <For each={pageItems()}>
              {(story, i) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    const url = story.url ?? `https://news.ycombinator.com/item?id=${story.id}`;
                    window.open(url, '_blank');
                  }}
                >
                  <td style={{ color: 'var(--color-text-muted)' }}>{(story.rank ?? i() + 1)}</td>
                  <td title={story.title}>{story.title.length > 70 ? story.title.slice(0, 70) + '…' : story.title}</td>
                  <td>{story.score}</td>
                  <td>{story.descendants}</td>
                  <td>{story.by}</td>
                  <td>{timeAgo(story.time)}</td>
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
