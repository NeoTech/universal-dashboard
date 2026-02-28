import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { RedditPost } from '../../data/reddit';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function timeAgo(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixTs);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function HotPostsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ posts: RedditPost[] }>('reddit-posts', { posts: [] });

  // Sort by score descending so highest-scoring posts are always at the top.
  const sorted = () =>
    [...store().posts].sort((a, b) => b.score - a.score);

  const { page, setPage, totalPages, pageItems } = usePagination(sorted, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile reddit-hot-posts-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Score</th>
              <th>Subreddit</th>
              <th>Title</th>
              <th>↑%</th>
              <th>Comments</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={sorted().length === 0}>
              <tr><td colspan="6" class="cell-empty">No posts</td></tr>
            </Show>
            <For each={pageItems()}>
              {(post) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://reddit.com${post.permalink}`, '_blank')}
                >
                  <td class="reddit-hot-posts-tile__score">{post.score.toLocaleString()}</td>
                  <td>r/{post.subreddit}</td>
                  <td title={post.title}>{post.title.length > 55 ? post.title.slice(0, 55) + '…' : post.title}</td>
                  <td>{Math.round((post.upvote_ratio ?? 0) * 100)}%</td>
                  <td>{post.num_comments.toLocaleString()}</td>
                  <td>{timeAgo(post.created_utc)}</td>
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
