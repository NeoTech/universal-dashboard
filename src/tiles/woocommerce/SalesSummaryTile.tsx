import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';

interface Props { refreshInterval?: number; }

const gridStyle: JSX.CSSProperties = {
  display: 'grid',
  'grid-template-columns': 'repeat(2, 1fr)',
  gap: '8px',
  padding: '8px',
};

const cardStyle: JSX.CSSProperties = {
  padding: '12px',
  background: 'var(--color-surface)',
  'border-radius': '8px',
  border: '1px solid var(--color-border)',
};

const labelStyle: JSX.CSSProperties = {
  'font-size': '0.75em',
  color: 'var(--color-text-muted)',
  'margin-bottom': '4px',
};

const valueStyle: JSX.CSSProperties = {
  'font-size': '1.1em',
  'font-weight': 'bold',
};

export function SalesSummaryTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ summary: unknown }>('woocommerce-sales-summary', { summary: null });

  const kpis = () => {
    const s = (store().summary ?? {}) as Record<string, unknown>;
    const get = (k: string) => String(s[k] ?? '—');
    return [
      { label: 'Total Sales (30d)', value: get('total_sales') },
      { label: 'Net Sales',         value: get('net_sales') },
      { label: 'Orders',            value: get('total_orders') },
      { label: 'Avg Order',         value: get('average_sales') },
      { label: 'Total Items',       value: get('total_items') },
      { label: 'Tax Collected',     value: get('total_tax') },
    ];
  };

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile woocommerce-sales-summary-tile">
      {store().summary == null ? (
        <div class="cell-empty">No sales data</div>
      ) : (
        <div style={gridStyle}>
          <For each={kpis()}>
            {(kpi) => (
              <div style={cardStyle}>
                <div style={labelStyle}>{kpi.label}</div>
                <div style={valueStyle}>{kpi.value}</div>
              </div>
            )}
          </For>
        </div>
      )}
    </BaseTile>
  );
}
