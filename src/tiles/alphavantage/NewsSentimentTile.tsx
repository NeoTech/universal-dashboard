import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { usePagination, PaginationBar } from '../usePagination';
import { BaseTile } from '../BaseTile';

interface NewsItem {
  title: string;
  url: string;
  time_published: string;
  source: string;
  overall_sentiment_label: string;
  overall_sentiment_score: number;
  summary: string;
}

interface Props {
  refreshInterval?: number;
}

function sentimentVariant(label: string): BadgeVariant {
  if (label === 'Bullish' || label === 'Somewhat-Bullish') return 'success';
  if (label === 'Bearish' || label === 'Somewhat-Bearish') return 'danger';
  return 'neutral';
}

function formatTimestamp(ts: string): string {
  if (!ts || ts.length < 8) return ts;
  // Format: 20240115T143000 → 2024-01-15 14:30
  const y = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d = ts.slice(6, 8);
  const h = ts.slice(9, 11);
  const mi = ts.slice(11, 13);
  return `${y}-${mo}-${d} ${h}:${mi}`;
}

export function NewsSentimentTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ feed: NewsItem[] }>('alphavantage-news-sentiment', { feed: [] });
  const { page, setPage, totalPages, pageItems } = usePagination(() => store().feed, 10);

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile news-sentiment-tile">
      <div style={{ overflow: 'auto', 'max-height': '100%' }}>
          <Show when={store().feed.length === 0}>
            <p class="cell-empty">No news items</p>
          </Show>
          <For each={pageItems()}>{(item) => (
            <div style={{ 'border-bottom': '1px solid var(--color-border)', padding: '6px 0' }}>
              <div style={{ display: 'flex', 'align-items': 'center', gap: '6px', 'margin-bottom': '2px' }}>
                <span style={{ 'font-size': '0.75rem', color: 'var(--color-muted)' }}>{item.source}</span>
                <Badge variant={sentimentVariant(item.overall_sentiment_label)}>
                  {item.overall_sentiment_label}
                </Badge>
                <span style={{ 'font-size': '0.75rem', color: 'var(--color-muted)', 'margin-left': 'auto' }}>
                  {formatTimestamp(item.time_published)}
                </span>
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ 'font-size': '0.8rem', color: 'var(--color-text)', 'text-decoration': 'none' }}
              >
                {item.title}
              </a>
            </div>
          )}</For>
        </div>
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
    </BaseTile>
  );
}
