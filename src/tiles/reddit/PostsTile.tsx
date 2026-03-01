import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { RedditPost } from '../../data/reddit';
import { usePagination, PaginationBar } from '../usePagination';

interface Props {
  subreddits?: string; // comma-separated — client-side filter
  refreshInterval?: number;
}

function timeAgo(unixTs: number): string {
  const diff = Math.floor(Date.now() / 1000 - unixTs);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function parseList(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

export function PostsTile(props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ posts: RedditPost[] }>('reddit-posts', { posts: [] });

  const filtered = () => {
    const subs = parseList(props.subreddits);
    const posts = store().posts;
    return subs.length > 0 ? posts.filter(p => subs.includes(p.subreddit.toLowerCase())) : posts;
  };

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile reddit-posts-tile">
      <>
        <Show when={props.subreddits}>
          <p class="reddit-tile__subreddits">
            <For each={props.subreddits!.split(',').map(s => s.trim()).filter(Boolean)}>
              {(sub) => <span class="reddit-tile__subreddit-badge">r/{sub}</span>}
            </For>
          </p>
        </Show>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Subreddit</th>
              <th>Title</th>
              <th>Score</th>
              <th>Comments</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().posts.length === 0}>
              <tr><td colspan="5" class="cell-empty">No posts</td></tr>
            </Show>
            <For each={pageItems()}>
              {(post) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(`https://reddit.com${post.permalink}`, '_blank')}
                >
                  <td>r/{post.subreddit}</td>
                  <td title={post.title}>{post.title.length > 60 ? post.title.slice(0, 60) + '…' : post.title}</td>
                  <td>{post.score.toLocaleString()}</td>
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
