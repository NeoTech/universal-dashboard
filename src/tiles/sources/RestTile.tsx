import { createSignal, createEffect, createMemo, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { RestTileConfig } from '../TileConfig';
import { BaseTile } from '../BaseTile';
import { useTileRefresh } from '../TileRefreshContext';
import { sseReceivedAt, setSseRevision } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';
import { MiniChart } from '../../ui/MiniChart';
import { API_BASE_URL } from '../../data/api';

interface Props {
  config: RestTileConfig;
  tileId?: string;
}

type DisplayMode = 'table' | 'json' | 'text';

function detectMode(data: unknown): DisplayMode {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') return 'table';
  if (typeof data === 'object' && data !== null) return 'json';
  return 'text';
}

function getColumns(data: unknown[]): string[] {
  const obj = data[0];
  if (typeof obj === 'object' && obj !== null) return Object.keys(obj);
  return [];
}

/** Traverse dot-path like "result.price" on an arbitrary object. */
function getField(obj: unknown, path: string): string {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[p];
  }
  if (cur == null) return '';
  if (typeof cur === 'object') return JSON.stringify(cur);
  return String(cur);
}

export function RestTile(props: Props): JSX.Element {
  const tileRefresh = useTileRefresh();

  const [data, setData] = createSignal<unknown>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function load() {
    try {
      setError(null);
      const res = await fetch(props.config.url, {
        headers: props.config.headers ?? {},
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type') ?? '';
      const result = contentType.includes('json') ? await res.json() : await res.text();
      setData(result);
      sseReceivedAt.set('rest', Date.now());
      setSseRevision(r => r + 1);
      if (props.tileId) {
        const jwt = typeof localStorage !== 'undefined' ? localStorage.getItem('twm-jwt') : null;
        void fetch(`${API_BASE_URL}/api/tiles/${props.tileId}/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
          body: JSON.stringify({ data: result }),
        }).catch(() => { /* fire-and-forget */ });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  // External refresh trigger
  createEffect(() => {
    tileRefresh();
    void load();
  });

  // Interval timer — reactive to refreshInterval changes
  createEffect(() => {
    const interval = props.config.refreshInterval ?? 30;
    if (interval === 0) return; // 0 = disabled
    const timer = setInterval(() => void load(), interval * 1000);
    onCleanup(() => clearInterval(timer));
  });

  const mode = (): DisplayMode => {
    const d = data();
    if (!d) return 'text';
    return props.config.displayMode ?? detectMode(d);
  };

  const rows = (): unknown[] => (Array.isArray(data()) ? (data() as unknown[]) : []);
  const columns = (): string[] => getColumns(rows());
  const { page, setPage, totalPages, pageItems } = usePagination(rows);

  const [chartView, setChartView] = createSignal<'chart' | 'data'>('data');
  const hasChart = () => Boolean(props.config.chartField);
  const chartData = createMemo<number[]>(() => {
    const cf = props.config.chartField;
    if (!cf) return [];
    return rows()
      .map((row) => parseFloat(getField(row, cf)))
      .filter((v) => !Number.isNaN(v));
  });

  return (
    <BaseTile loading={loading()} error={error()} skeletonLines={4}>
      <Show when={hasChart()}>
        <div class="mini-chart__toggle">
          <button
            class={`mini-chart__toggle-btn${chartView() === 'data' ? ' mini-chart__toggle-btn--active' : ''}`}
            onClick={() => setChartView('data')}>Data</button>
          <button
            class={`mini-chart__toggle-btn${chartView() === 'chart' ? ' mini-chart__toggle-btn--active' : ''}`}
            onClick={() => setChartView('chart')}>Chart</button>
        </div>
        <Show when={chartView() === 'chart'}>
          <MiniChart
            data={chartData()}
            type={props.config.chartType ?? 'line'}
            label={props.config.chartField}
          />
        </Show>
      </Show>
      <Show when={!hasChart() || chartView() === 'data'}>
      {mode() === 'table' ? (
        <table class="tile-table">
          <thead>
            <tr>
              <For each={columns()}>{(col) => <th>{col}</th>}</For>
            </tr>
          </thead>
          <tbody>
            <For each={pageItems() as unknown[]}>
              {(row) => (
                <tr>
                  <For each={columns()}>
                    {(col) => <td>{String((row as Record<string, unknown>)[col] ?? '')}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      ) : (
        <pre class="tile-json">{JSON.stringify(data(), null, 2)}</pre>
      )}
      <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </Show>
    </BaseTile>
  );
}
