import { For, Show, createSignal } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface NewsItem {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  category: string;
}

interface Props { refreshInterval?: number; }

type Category = 'general' | 'forex' | 'crypto';

function relativeTime(datetime: number): string {
  const diffMs = Date.now() - datetime * 1000;
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(diffMs / 3_600_000);
  return `${hours}h ago`;
}

export function MarketNewsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ byCategory: Record<string, NewsItem[]> }>('finnhub-market-news', { byCategory: {} });
  const [activeTab, setActiveTab] = createSignal<Category>('general');

  const tabs: { key: Category; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'forex', label: 'Forex' },
    { key: 'crypto', label: 'Crypto' },
  ];

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-market-news-tile">
      <div style={{ display: 'flex', 'flex-direction': 'column', height: '100%' }}>
          <div style={{ display: 'flex', 'border-bottom': '1px solid var(--color-border)', 'margin-bottom': '8px' }}>
            <For each={tabs}>
              {(tab) => (
                <button
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '6px 14px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    color: activeTab() === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                    'font-weight': activeTab() === tab.key ? '700' : '400',
                    'border-bottom': activeTab() === tab.key ? '2px solid var(--color-accent)' : '2px solid transparent',
                    'font-size': '0.85rem',
                  }}
                >
                  {tab.label}
                </button>
              )}
            </For>
          </div>
          <div style={{ overflow: 'auto', flex: '1' }}>
            <Show when={(store().byCategory[activeTab()] ?? []).length === 0}>
              <div class="cell-empty">No news available</div>
            </Show>
            <For each={store().byCategory[activeTab()] ?? []}>
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
                  <div style={{ 'font-weight': '600', 'font-size': '0.85rem', 'margin-bottom': '2px', 'line-height': '1.3' }}>
                    {item.headline}
                  </div>
                  <div style={{ 'font-size': '0.75rem', color: 'var(--color-text-muted)' }}>
                    {item.source} · {relativeTime(item.datetime)}
                  </div>
                </a>
              )}
            </For>
          </div>
        </div>
    </BaseTile>
  );
}
