import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import type { FinnhubNewsItem } from '../../data/finnhub';
import { usePagination, PaginationBar } from '../usePagination';

interface Props { refreshInterval?: number; }

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function categoryVariant(category: string): BadgeVariant {
  switch (category) {
    case 'general': return 'neutral';
    case 'forex': return 'warning';
    case 'crypto': return 'success';
    case 'merger': return 'neutral';
    default: return 'neutral';
  }
}

export function NewsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ news: FinnhubNewsItem[] }>('finnhub-news', { news: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().news, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-news-tile">
      <>
        <div class="news-list" style={{ overflow: 'auto', 'max-height': '100%' }}>
          <Show when={store().news.length === 0}>
            <div class="cell-empty">No news available</div>
          </Show>
          <For each={pageItems()}>
            {(item) => (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                class="news-item"
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  'border-bottom': '1px solid var(--color-border)',
                  color: 'inherit',
                  'text-decoration': 'none',
                }}
              >
                <div class="news-meta">
                  <Badge variant={categoryVariant(item.category)}>{item.category}</Badge>
                  {' '}
                  <span class="news-source">{item.source}</span>
                  {' '}
                  <span class="news-time">{timeAgo(item.datetime * 1000)}</span>
                </div>
                <p
                  class="news-headline"
                  style={{ margin: '2px 0 0', 'font-size': '0.85em', color: 'var(--color-text-muted)' }}
                >
                  {item.headline}
                </p>
              </a>
            )}
          </For>
        </div>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
