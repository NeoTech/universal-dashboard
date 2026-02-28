import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { Badge } from '../../ui/Badge';
import type { BadgeVariant } from '../../ui/Badge';
import { BaseTile } from '../BaseTile';

interface MarketStatus {
  exchange: string;
  isOpen: boolean;
  session: string;
  timezone: string;
  t: number;
}

interface Props { refreshInterval?: number; }

export function FinnhubMarketStatusTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ statuses: MarketStatus[] }>('finnhub-market-status', { statuses: [] });

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile finnhub-market-status-tile">
      <div style={{ display: 'grid', 'grid-template-columns': '1fr 1fr', gap: '12px', padding: '4px' }}>
          <For each={store().statuses}>
            {(s) => {
              const variant: BadgeVariant = s.isOpen ? 'success' : 'danger';
              return (
                <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', 'border-radius': '8px', padding: '12px', display: 'flex', 'flex-direction': 'column', gap: '6px' }}>
                  <span style={{ 'font-weight': '600', 'font-size': '0.95rem' }}>{s.exchange}</span>
                  <Badge variant={variant}>{s.isOpen ? 'Open' : 'Closed'}</Badge>
                  <span style={{ 'font-size': '0.8rem', color: 'var(--color-text-muted)', 'text-transform': 'capitalize' }}>{s.session ?? '—'}</span>
                  <span style={{ 'font-size': '0.75rem', color: 'var(--color-text-muted)' }}>{s.timezone ?? ''}</span>
                </div>
              );
            }}
          </For>
          {store().statuses.length === 0 && (
            <div class="cell-empty" style={{ 'grid-column': '1 / -1' }}>No market status data</div>
          )}
      </div>
    </BaseTile>
  );
}
