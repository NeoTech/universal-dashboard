import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';
import { usePagination, PaginationBar } from '../usePagination';

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related: string;
  image: string;
}

interface Props { refreshInterval?: number; }

function relativeTime(datetime: number): string {
  const diffMs = Date.now() - datetime * 1000;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diffMs / 3_600_000);
  return `${hours}h ago`;
}

export function CompanyNewsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ news: NewsItem[] }>('finnhub-company-news', { news: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().news, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-company-news-tile">
      <>
        <div style={{ overflow: 'auto', 'max-height': '100%' }}>
          <Show when={store().news.length === 0}>
            <div class="cell-empty">No company news available</div>
          </Show>
          <For each={pageItems()}>
            {(item) => (
              <a
                href={item.url}
                target="_blank"
                rel="noopener"
                style={{
                  display: 'block',
                  padding: '8px 12px',
                  'border-bottom': '1px solid var(--color-border)',
                  color: 'inherit',
                  'text-decoration': 'none',
                }}
              >
                <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '2px' }}>
                  <Badge variant="neutral">{item.related}</Badge>
                  <span style={{ 'font-size': '0.75rem', color: 'var(--color-text-muted)' }}>
                    {item.source} · {relativeTime(item.datetime)}
                  </span>
                </div>
                <div style={{ 'font-weight': '600', 'font-size': '0.85rem', 'line-height': '1.3' }}>
                  {item.headline}
                </div>
              </a>
            )}
          </For>
        </div>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </>
    </BaseTile>
  );
}
