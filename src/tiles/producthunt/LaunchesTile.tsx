import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import type { ProductHuntPost } from '../../data/producthunt';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function LaunchesTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ posts: ProductHuntPost[] }>('producthunt-top-launches', { posts: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().posts, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile producthunt-launches-tile">
      <>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Tagline</th>
              <th>Votes</th>
              <th>Comments</th>
              <th>Featured</th>
            </tr>
          </thead>
          <tbody>
            <Show when={store().posts.length === 0}>
              <tr><td colspan="5" class="cell-empty">No launches</td></tr>
            </Show>
            <For each={pageItems()}>
              {(post) => (
                <tr
                  style={{ cursor: 'pointer' }}
                  onClick={() => window.open(post.url, '_blank')}
                >
                  <td title={post.name}><strong>{post.name}</strong></td>
                  <td title={post.tagline}>{post.tagline.length > 60 ? post.tagline.slice(0, 60) + '…' : post.tagline}</td>
                  <td>▲ {post.votesCount.toLocaleString()}</td>
                  <td>{post.commentsCount.toLocaleString()}</td>
                  <td>{post.featuredAt ? timeAgo(post.featuredAt) : timeAgo(post.createdAt)}</td>
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
