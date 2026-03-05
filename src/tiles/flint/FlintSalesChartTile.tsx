import { createSignal, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { FlintSalesPoint } from '../../data/flint';
import { useFlintResource, sendCommand } from './flintRealtimeStore';
import { useStripeAction } from '../../ui/useStripeAction';
import { BarChart } from '../../ui/BarChart';
import { Sparkline } from '../../ui/Sparkline';
import { BaseWsTile as BaseTile } from '../BaseWsTile';
import { formatCurrency } from './utils';

interface Props {
  compact?: boolean;
}

export function FlintSalesChartTile(props: Props): JSX.Element {
  const { data: sales, loading, error } = useFlintResource<FlintSalesPoint[]>('flint-sales', []);

  // Default date range: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const [from, setFrom] = createSignal(thirtyDaysAgo.toISOString().slice(0, 10));
  const [to, setTo]     = createSignal(today.toISOString().slice(0, 10));
  const [rangeData, setRangeData] = createSignal<FlintSalesPoint[]>([]);

  const rangeAction = useStripeAction(
    async () => {
      const result = await sendCommand('set-sales-range', undefined, { from: from(), to: to() });
      if (result.status === 'failed') throw new Error(result.error ?? 'Command failed');
      setRangeData(result.data as FlintSalesPoint[]);
    },
    { onSuccess: () => undefined },
  );

  // Use custom range data if loaded, otherwise SSE data
  const displayData = () => rangeData().length > 0 ? rangeData() : sales();

  const barItems = () =>
    displayData().map(p => ({
      label: p.date.slice(5), // MM-DD
      value: p.revenue,
      color: 'var(--twm-color-accent)',
    }));

  const sparklineValues = () =>
    displayData().slice(-7).map(p => p.revenue);

  const currency = () => displayData()[0]?.currency ?? 'USD';

  return (
    <div class="stripe-tile flint-sales-chart-tile">
      <Show when={!props.compact} fallback={
        <BaseTile loading={loading()} error={error()}>
          <Show when={sparklineValues().length > 0}
            fallback={<p class="cell-empty">No sales data</p>}>
            <p class="flint-auth-form__label" style="padding:8px 8px 0">Last 7 days</p>
            <div style="padding:8px">
              <Sparkline data={sparklineValues()} w={240} h={40} />
            </div>
          </Show>
        </BaseTile>
      }>
        {/* Date range toolbar */}
        <div class="tile-toolbar">
          <label class="flint-auth-form__label" style="flex-direction:row;align-items:center;gap:4px;flex:1">
            From
            <input class="flint-auth-form__input" type="date" value={from()} onInput={(e) => setFrom(e.currentTarget.value)} style="width:130px" />
          </label>
          <label class="flint-auth-form__label" style="flex-direction:row;align-items:center;gap:4px;flex:1">
            To
            <input class="flint-auth-form__input" type="date" value={to()} onInput={(e) => setTo(e.currentTarget.value)} style="width:130px" />
          </label>
          <button
            class="btn btn--sm btn--primary"
            disabled={rangeAction.loading()}
            onClick={() => void rangeAction.execute()}
          >
            {rangeAction.loading() ? 'Loading…' : 'Apply'}
          </button>
        </div>

        <Show when={rangeAction.error()}>
          <p class="drawer-error" style="padding:0 8px">{rangeAction.error()}</p>
        </Show>

        <BaseTile loading={loading()} error={error()}>
          <Show when={barItems().length > 0}
            fallback={<p class="cell-empty">No sales data for this range</p>}>
            <BarChart
              items={barItems()}
              maxItems={31}
              formatValue={(v) => formatCurrency(v, currency())}
            />
          </Show>
        </BaseTile>
      </Show>
    </div>
  );
}
