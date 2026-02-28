import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { GraphqlTileConfig } from '../TileConfig';
import { BaseTile } from '../BaseTile';
import { useTileRefresh } from '../TileRefreshContext';
import { sseReceivedAt, setSseRevision } from '../../ui/useSseChannel';
import { usePagination, PaginationBar } from '../usePagination';

interface Props {
  config: GraphqlTileConfig;
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

/** Traverse a dot-path like "data.users" on an arbitrary object. */
function getPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function cellValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function GraphqlTile(props: Props): JSX.Element {
  const tileRefresh = useTileRefresh();

  const [data, setData] = createSignal<unknown>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);

  async function load(): Promise<void> {
    try {
      setError(null);
      let variables: Record<string, unknown> | undefined;
      if (props.config.variables?.trim()) {
        try { variables = JSON.parse(props.config.variables) as Record<string, unknown>; }
        catch { /* invalid JSON — send without variables */ }
      }
      const res = await fetch(props.config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(props.config.headers ?? {}),
        },
        body: JSON.stringify({ query: props.config.query, variables }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json() as unknown;
      // Extract sub-tree if dataPath is set
      const extracted = props.config.dataPath
        ? getPath(json, props.config.dataPath)
        : json;
      setData(extracted ?? json);
      sseReceivedAt.set('graphql', Date.now());
      setSseRevision(r => r + 1);
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
    if (interval === 0) return;
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

  return (
    <BaseTile loading={loading()} error={error()} skeletonLines={4}>
      <Show when={mode() === 'table'}>
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
                    {(col) => <td>{cellValue((row as Record<string, unknown>)[col])}</td>}
                  </For>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <PaginationBar page={page} setPage={setPage} totalPages={totalPages} />
      </Show>
      <Show when={mode() !== 'table'}>
        <pre class="tile-json">{typeof data() === 'string' ? String(data()) : JSON.stringify(data(), null, 2)}</pre>
      </Show>
    </BaseTile>
  );
}
