import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import { BarChart } from '../../ui/BarChart';
import type { GA4SessionsTrend } from '../../data/ga4';

interface Props { refreshInterval?: number; }

interface SseData {
  trend: GA4SessionsTrend;
  totals: { sessions: number; users: number; pageviews: number };
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const defaultData: SseData = {
  trend: { dates: [], sessions: [], users: [], pageviews: [] },
  totals: { sessions: 0, users: 0, pageviews: 0 },
};

export function SessionsTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<SseData>('ga4-sessions-trend', defaultData);

  const barItems = () =>
    store().trend.dates.map((date, i) => ({
      label: date.slice(5), // MM-DD
      value: store().trend.sessions[i] ?? 0,
    }));

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile ga4-sessions-tile">
      <>
          <div class="kpi-row" style={{ display: 'flex', gap: '16px', 'margin-bottom': '12px' }}>
            <div class="kpi">
              <span class="kpi-label">Sessions</span>
              <span class="kpi-value">{formatNumber(store().totals.sessions)}</span>
            </div>
            <div class="kpi">
              <span class="kpi-label">Users</span>
              <span class="kpi-value">{formatNumber(store().totals.users)}</span>
            </div>
            <div class="kpi">
              <span class="kpi-label">Pageviews</span>
              <span class="kpi-value">{formatNumber(store().totals.pageviews)}</span>
            </div>
          </div>
          <Show when={barItems().length > 0}>
            <BarChart items={barItems()} maxItems={14} formatValue={formatNumber} />
          </Show>
        </>
    </BaseTile>
  );
}
