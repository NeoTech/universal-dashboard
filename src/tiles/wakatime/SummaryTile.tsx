import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { useSseChannel } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import { BarChart } from '../../ui/BarChart';
import type { WakaTimeSummary } from '../../data/wakatime';

interface Props { refreshInterval?: number; }

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f7df1e',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Java: '#b07219',
  CSS: '#563d7c',
  HTML: '#e34c26',
  'C#': '#178600',
  'C++': '#f34b7d',
  Ruby: '#701516',
  PHP: '#4F5D95',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  Dart: '#00B4AB',
};

function fmtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function SummaryTile(_props: Props): JSX.Element {
  const { data: store, loading, error } = useSseChannel<{ data: WakaTimeSummary[] }>('wakatime-summary', { data: [] });

  const today = () => store().data[store().data.length - 1];

  const langItems = () =>
    (today()?.languages ?? []).slice(0, 8).map(l => ({
      label: l.name,
      value: l.total_seconds,
      color: LANG_COLORS[l.name],
    }));

  return (
    <BaseTile loading={loading()} error={error()} class="stripe-tile wakatime-summary-tile">
      {!today() ? (
        <p class="cell-empty">No data yet</p>
      ) : (
        <>
          <p class="tile-kpi">
            Today: <strong>{today().grand_total.text}</strong>
          </p>
          <Show when={langItems().length > 0}>
            <BarChart
              items={langItems()}
              maxItems={8}
              formatValue={fmtTime}
            />
          </Show>
        </>
      )}
    </BaseTile>
  );
}
