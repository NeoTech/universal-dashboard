import type { JSX } from 'solid-js';
import type { FlintDashboardSummary } from '../../data/flint';
import { useFlintResource } from './flintRealtimeStore';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { formatCurrency } from './utils';
import { flintStore } from './flintStore';
import { useFlintDensity } from './useFlintDensity';

const DEFAULT_SUMMARY: FlintDashboardSummary = {
  ordersToday:      0,
  revenueToday:     0,
  currency:         'USD',
  newCustomersToday:0,
  lowStockCount:    0,
  pendingOrders:    0,
  processingOrders: 0,
};

export function FlintOverviewTile(_props: Record<string, never>): JSX.Element {
  const { density, ref } = useFlintDensity();
  const { data: summary, loading, error } = useFlintResource<FlintDashboardSummary>(
    'flint-dashboard',
    DEFAULT_SUMMARY,
  );

  function dispatchLowStockFilter(): void {
    flintStore.filterInventory({ lowStockOnly: true });
  }

  return (
    <div class="stripe-tile flint-overview-tile" ref={ref} data-density={density()}>
      <BaseTile loading={loading()} error={error()}>
        <div class="flint-kpi-grid">
          {/* Orders Today */}
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">Orders Today</span>
            <span class="flint-kpi-card__value">{summary().ordersToday}</span>
            <span class="flint-kpi-card__sub">
              {summary().pendingOrders} pending · {summary().processingOrders} processing
            </span>
          </div>

          {/* Revenue Today */}
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">Revenue Today</span>
            <span class="flint-kpi-card__value">
              {formatCurrency(summary().revenueToday, summary().currency)}
            </span>
          </div>

          {/* New Customers */}
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">New Customers</span>
            <span class="flint-kpi-card__value">{summary().newCustomersToday}</span>
          </div>

          {/* Low Stock */}
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">Low Stock</span>
            <button
              class={`flint-kpi-card__value flint-kpi-chip${summary().lowStockCount > 0 ? ' flint-kpi-chip--warn' : ''}`}
              onClick={dispatchLowStockFilter}
              title="Click to filter Inventory tile"
            >
              {summary().lowStockCount}
            </button>
          </div>
        </div>
      </BaseTile>
    </div>
  );
}
