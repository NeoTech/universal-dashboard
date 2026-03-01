import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { RedditPost } from '../../data/reddit';
import { usePagination, PaginationBar } from '../usePagination';

interface Props {
  keywords?: string;   // comma-separated, e.g. "rust,typescript,bun"
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

/** Returns list of keyword terms from the comma-separated config string. */
function parseKeywords(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
}

/** Returns matched keywords found in the post title or subreddit. */
function matchedKeywords(post: RedditPost, keywords: string[]): string[] {
  const haystack = `${post.title} ${post.subreddit} ${post.selftext ?? ''}`.toLowerCase();
  return keywords.filter(k => haystack.includes(k));
}

export function KeywordMonitorTile(props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ posts: RedditPost[] }>('reddit-posts', { posts: [] });

  const keywords = () => parseKeywords(props.keywords);
  const subFilter = () => props.subreddits
    ? props.subreddits.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    : [];

  // When keywords are set, only show matching posts; additionally filter by subreddits if configured.
  const filtered = () => {
    const kw = keywords();
    const subs = subFilter();
    let posts = store().posts;
    if (subs.length > 0) posts = posts.filter(p => subs.includes(p.subreddit.toLowerCase()));
    if (kw.length === 0) return posts;
    return posts.filter(p => matchedKeywords(p, kw).length > 0);
  };

  const { page, setPage, totalPages, pageItems } = usePagination(filtered, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile reddit-keyword-monitor-tile">
      <>
        <Show when={props.subreddits}>
          <p class="reddit-tile__subreddits">
            <For each={props.subreddits!.split(',').map(s => s.trim()).filter(Boolean)}>
              {(sub) => <span class="reddit-tile__subreddit-badge">r/{sub}</span>}
            </For>
          </p>
        </Show>
        <Show when={keywords().length === 0}>
          <p class="reddit-keyword-monitor-tile__hint">
            Configure keywords in tile settings to filter posts.
          </p>
        </Show>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Subreddit</th>
              <th>Title</th>
              <th>Match</th>
              <th>Score</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={filtered().length === 0 && keywords().length > 0}>
              <tr><td colspan="5" class="cell-empty">No posts matching keywords</td></tr>
            </Show>
            <For each={pageItems()}>
              {(post) => {
                const matches = matchedKeywords(post, keywords());
                return (
                  <tr
                    class={matches.length > 0 ? 'reddit-keyword-monitor-tile__row--match' : ''}
                    style={{ cursor: 'pointer' }}
                    onClick={() => window.open(`https://reddit.com${post.permalink}`, '_blank')}
                  >
                    <td>r/{post.subreddit}</td>
                    <td title={post.title}>{post.title.length > 50 ? post.title.slice(0, 50) + '…' : post.title}</td>
                    <td>
                      <For each={matches}>
                        {(kw) => <span class="reddit-keyword-monitor-tile__badge">{kw}</span>}
                      </For>
                    </td>
                    <td>{post.score.toLocaleString()}</td>
                    <td>{timeAgo(post.created_utc)}</td>
                  </tr>
                );
              }}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
