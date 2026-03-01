import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { CustomApiTileConfig } from '../TileConfig';
import { BaseTile } from '../BaseTile';
import { useTileRefresh } from '../TileRefreshContext';
import { API_BASE_URL } from '../../data/api';
import { usePagination, PaginationBar } from '../usePagination';

interface Props {
  config: CustomApiTileConfig;
  tileId?: string;
}

type DisplayMode = 'table' | 'json' | 'text' | 'key-value';

/** Traverse a dot-path into an object, e.g. "data.users" or "items.owner".
 *  When the current value is an array, the next key is mapped over each element,
 *  so "items.owner" returns an array of owner objects rather than undefined. */
function getPath(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce<unknown>((acc, key) => {
    if (Array.isArray(acc)) {
      return acc.map(item =>
        item != null && typeof item === 'object'
          ? (item as Record<string, unknown>)[key]
          : undefined,
      );
    }
    if (acc != null && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

function detectMode(data: unknown): DisplayMode {
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') return 'table';
  if (typeof data === 'object' && data !== null && !Array.isArray(data)) return 'key-value';
  if (typeof data === 'string') return 'text';
  return 'json';
}

function getColumns(data: unknown[]): string[] {
  const obj = data[0];
  if (typeof obj === 'object' && obj !== null) return Object.keys(obj);
  return [];
}

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

export function CustomApiTile(props: Props): JSX.Element {
  const tileRefresh = useTileRefresh();

  const [data, setData] = createSignal<unknown>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [httpStatus, setHttpStatus] = createSignal<number | null>(null);

  async function load(): Promise<void> {
    try {
      setError(null);
      const res = await fetch(`${API_BASE_URL}/api/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: props.config.url,
          method: props.config.method ?? 'GET',
          headers: props.config.headers ?? {},
          body: props.config.body,
        }),
      });
      const envelope = await res.json() as {
        ok: boolean;
        status?: number;
        data?: unknown;
        error?: string;
      };
      if (!envelope.ok) {
        setError(envelope.error ?? `HTTP ${envelope.status ?? 'error'}`);
        return;
      }
      setHttpStatus(envelope.status ?? null);
      const raw = envelope.data;

      // ---------------------------------------------------------------------------
      // Data Path Mini-Language
      // ---------------------------------------------------------------------------
      // The dataPath field accepts a comma-separated list of dot-path expressions.
      // Each expression can optionally carry an "as Label" alias (jq-inspired).
      //
      // Syntax:
      //   <dot.path> [as <Label>]  [, <dot.path> [as <Label>] ...]
      //
      // Examples:
      //   items                          → extract items array as-is
      //   items.owner                    → map .owner over each element of items
      //   items.name, items.stargazers_count
      //                                  → two columns; headers auto-named from last segment
      //   items.name as Name, items.owner.login as Owner, items.html_url as URL
      //                                  → three columns with explicit headers
      //
      // Rules:
      //   • Dot traversal: "a.b.c" walks obj → obj.a → obj.a.b → obj.a.b.c
      //   • Array fan-out: when a segment resolves to an array, the remaining
      //     segments are mapped over each element (so "items.owner.login" gives
      //     all owner logins from the items array).
      //   • Single path, no alias → behaves exactly as before (returns the
      //     extracted value; auto-detects table / key-value / json / text mode).
      //   • Multi-path or any alias → always produces an array of row-objects,
      //     rendered as a table. Column count = number of expressions.
      // ---------------------------------------------------------------------------
      const entries = (props.config.dataPath ?? '')
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => {
          const asMatch = p.match(/^(.+?)\s+as\s+(.+)$/i);
          if (asMatch) return { path: asMatch[1].trim(), name: asMatch[2].trim() };
          return { path: p, name: p.split('.').at(-1) ?? p };
        });
      let extracted: unknown;
      if (entries.length === 0) {
        extracted = raw;
      } else if (entries.length === 1 && !/ as /i.test(props.config.dataPath ?? '')) {
        extracted = getPath(raw, entries[0].path);
      } else {
        // Multi-column projection: each entry becomes a named column.
        const cols = entries.map(e => ({
          name: e.name,
          values: getPath(raw, e.path),
        }));
        const len = cols.reduce(
          (max, col) => (Array.isArray(col.values) ? Math.max(max, col.values.length) : max),
          0,
        );
        extracted = Array.from({ length: len }, (_, i) =>
          Object.fromEntries(cols.map(col => [
            col.name,
            Array.isArray(col.values) ? col.values[i] : col.values,
          ]))
        );
      }
      setData(extracted);
      if (props.tileId) {
        const jwt = typeof localStorage !== 'undefined' ? localStorage.getItem('twm-jwt') : null;
        void fetch(`${API_BASE_URL}/api/tiles/${props.tileId}/data`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}) },
          body: JSON.stringify({ data: extracted }),
        }).catch(() => { /* fire-and-forget */ });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    tileRefresh();
    void load();
  });

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

  const kvEntries = (): [string, unknown][] => {
    const d = data();
    if (d == null || typeof d !== 'object' || Array.isArray(d)) return [];
    return Object.entries(d as Record<string, unknown>);
  };

  return (
    <BaseTile loading={loading()} error={error()} skeletonLines={4}>
      <Show when={httpStatus() !== null}>
        <div class="custom-api-tile__status">
          HTTP {httpStatus()}
        </div>
      </Show>

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

      <Show when={mode() === 'key-value'}>
        <table class="tile-table custom-api-tile__kv">
          <tbody>
            <For each={kvEntries()}>
              {([key, value]) => (
                <tr>
                  <th class="custom-api-tile__kv-key">{key}</th>
                  <td>{cellValue(value)}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={mode() === 'json'}>
        <pre class="tile-json">{JSON.stringify(data(), null, 2)}</pre>
      </Show>

      <Show when={mode() === 'text'}>
        <pre class="tile-json">{String(data() ?? '')}</pre>
      </Show>
    </BaseTile>
  );
}
