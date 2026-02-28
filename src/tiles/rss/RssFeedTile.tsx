import { createSignal, createEffect, onCleanup, Show, For } from 'solid-js';
import type { JSX } from 'solid-js';
import { BaseTile } from '../BaseTile';
import { usePagination, PaginationBar } from '../usePagination';
import { useTileConfig } from '../TileConfigContext';
import { useTileRefresh } from '../TileRefreshContext';
import { sseReceivedAt, setSseRevision } from '../../ui/useSseChannel';

interface RssItem {
  title: string;
  link: string;
  pubDate: string;
  summary: string;
}

interface RssFeedData {
  feedTitle: string;
  url: string;
  items: RssItem[];
  fetchedAt: string;
}

interface Props {
  url?: string;
  maxItems?: number;
  refreshInterval?: number;
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const ms = Date.now() - new Date(dateStr).getTime();
  if (isNaN(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function RssFeedTile(props: Props): JSX.Element {
  const tileConfig = useTileConfig();
  const tileRefresh = useTileRefresh();

  const [data, setData] = createSignal<RssFeedData | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  const { page, setPage, totalPages, pageItems } = usePagination(() => data()?.items ?? [], 10);

  async function fetchFeed() {
    const url = props.url;
    if (!url) return;
    try {
      const maxItems = props.maxItems ?? 50;
      const r = await fetch(`/api/rss/feed?url=${encodeURIComponent(url)}&maxItems=${maxItems}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json() as RssFeedData;
      setData(json);
      setError(null);
      // Stamp the shared footer clock so "Updated X ago" appears
      sseReceivedAt.set('rss-feed', Date.now());
      setSseRevision(r => r + 1);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  // External refresh trigger (manual button or timer ring)
  createEffect(() => {
    tileRefresh(); // reactive dep
    void fetchFeed();
  });

  // Interval timer — reactive to refreshInterval changes from gear modal
  createEffect(() => {
    const ms = tileConfig?.refreshInterval ?? props.refreshInterval ?? 300_000;
    if (ms === 0) return; // 0 = disabled (manual-only)
    const timer = setInterval(() => void fetchFeed(), ms);
    onCleanup(() => clearInterval(timer));
  });

  if (!props.url) {
    return (
      <div class="tile-empty">
        <p>No feed URL configured.</p>
        <p style={{ 'font-size': '0.8em', color: 'var(--color-text-muted)' }}>
          Set <code>rss.url</code> in the tile config.
        </p>
      </div>
    );
  }

  return (
    <BaseTile loading={loading()} error={error()} skeletonLines={6}>
      <>
        <Show when={data()}>
          {(d) => (
            <p class="tile-meta" style={{ 'margin-bottom': '6px', 'font-size': '0.75em', color: 'var(--color-text-muted)' }}>
              {d().feedTitle} · {d().items.length} items · updated {timeAgo(d().fetchedAt)}
            </p>
          )}
        </Show>
        <table class="tile-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            <Show when={(data()?.items.length ?? 0) === 0}>
              <tr><td colspan="2" class="cell-empty">No items</td></tr>
            </Show>
            <For each={pageItems()}>
              {(item) => (
                <tr
                  style={{ cursor: item.link ? 'pointer' : 'default' }}
                  title={item.summary || item.title}
                  onClick={() => item.link && window.open(item.link, '_blank')}
                >
                  <td>{item.title.length > 80 ? item.title.slice(0, 80) + '…' : item.title}</td>
                  <td style={{ 'white-space': 'nowrap', color: 'var(--color-text-muted)' }}>
                    {timeAgo(item.pubDate)}
                  </td>
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
