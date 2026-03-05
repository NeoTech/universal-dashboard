import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintCustomerReport } from '../../data/flint';
import { Sparkline } from '../../ui/Sparkline';
import { useFlintResource } from './flintRealtimeStore';
import { BaseWsTile as BaseTile } from '../BaseWsTile';

const DEFAULT_REPORT: FlintCustomerReport = {
  totalActive:   0,
  totalInactive: 0,
  newThisMonth:  0,
  newPerDay:     [],
};

export function FlintCustomerReportsTile(_props: Record<string, never>): JSX.Element {
  const { data: report, loading, error } = useFlintResource<FlintCustomerReport>(
    'flint-customer-report',
    DEFAULT_REPORT,
  );

  const [expanded, setExpanded] = createSignal(false);

  const sparklineData = () => report().newPerDay.map(d => d.count);

  return (
    <div class="stripe-tile flint-customer-reports-tile">
      <BaseTile loading={loading()} error={error()}>
        {/* KPI chips */}
        <div class="flint-kpi-grid">
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">Active Customers</span>
            <span class="flint-kpi-card__value">{report().totalActive}</span>
          </div>
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">Inactive</span>
            <span class="flint-kpi-card__value">{report().totalInactive}</span>
          </div>
          <div class="flint-kpi-card">
            <span class="flint-kpi-card__label">New This Month</span>
            <span class="flint-kpi-card__value">{report().newThisMonth}</span>
          </div>
          <Show when={report().churnRate !== undefined}>
            <div class="flint-kpi-card">
              <span class="flint-kpi-card__label">Churn Rate</span>
              <span class="flint-kpi-card__value">{((report().churnRate ?? 0) * 100).toFixed(1)}%</span>
            </div>
          </Show>
        </div>

        {/* Sparkline */}
        <Show when={sparklineData().length >= 2}>
          <div
            class="flint-sparkline-area"
            onClick={() => setExpanded(v => !v)}
            title="Click to toggle expanded chart"
            style="cursor:pointer;padding:8px;display:flex;align-items:center;gap:8px"
          >
            <span class="flint-kpi-card__label">New customers / day (30d)</span>
            <Show
              when={expanded()}
              fallback={
                <Sparkline data={sparklineData()} w={200} h={32} />
              }
            >
              <Sparkline data={sparklineData()} w={400} h={80} />
            </Show>
          </div>
        </Show>
      </BaseTile>
    </div>
  );
}
