import { createSignal, createEffect, onCleanup, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import type { WsTileConfig } from '../TileConfig';
import { useTileRefresh } from '../TileRefreshContext';
import { sseReceivedAt, setSseRevision } from '../../ui/useSseChannel';
import { BaseTile } from '../BaseTile';
import { MiniChart } from '../../ui/MiniChart';

/** Traverse dot-path like "payload.price" on an arbitrary object. */
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

interface Props {
  config: WsTileConfig;
  /** Tile ID used to key sessionStorage entries for chart buffer persistence. */
  tileId?: string;
}

interface WsMessage {
  id: number;
  raw: string;
  parsed: unknown;
  ts: Date;
}

let msgId = 0;
const BASE_DELAY_MS  = 2_000;
const MAX_DELAY_MS   = 30_000;

/** Read back the persisted chart view mode ('data' | 'chart') from sessionStorage. */
function readStoredView(tileId: string | undefined): 'chart' | 'data' {
  if (!tileId) return 'data';
  try {
    const v = sessionStorage.getItem(`twm-ws-view-${tileId}`);
    return v === 'chart' ? 'chart' : 'data';
  } catch {
    return 'data';
  }
}

/** Read back a persisted chart buffer from sessionStorage. Validates each element is finite. */
function readStoredBuffer(tileId: string | undefined, chartField: string | undefined): number[] {
  if (!tileId || !chartField) return [];
  try {
    const stored = sessionStorage.getItem(`twm-ws-buf-${tileId}-${chartField}`);
    if (!stored) return [];
    const arr = JSON.parse(stored) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  } catch {
    return [];
  }
}

export function WsTile(props: Props): JSX.Element {
  const tileRefresh = useTileRefresh();
  const max = () => props.config.maxMessages ?? 50;
  const [messages, setMessages] = createSignal<WsMessage[]>([]);
  const [status, setStatus] = createSignal<'connecting' | 'open' | 'closed' | 'error' | 'reconnecting'>('connecting');
  // TWM-134-2: pre-populate chart buffer from sessionStorage on init
  const [chartBuffer, setChartBuffer] = createSignal<number[]>(
    readStoredBuffer(props.tileId, props.config.chartField)
  );
  const [chartView, setChartView] = createSignal<'chart' | 'data'>(readStoredView(props.tileId));

  /** Set chart view and persist to sessionStorage. */
  function pickView(v: 'chart' | 'data'): void {
    setChartView(v);
    if (props.tileId) {
      try { sessionStorage.setItem(`twm-ws-view-${props.tileId}`, v); } catch { /* ignore */ }
    }
  }

  let listEl: HTMLDivElement | undefined;

  // TWM-134-3: remove sessionStorage entry when tile is removed, but NOT on page reload
  let isUnloading = false;
  const onBeforeUnload = () => { isUnloading = true; };
  window.addEventListener('beforeunload', onBeforeUnload);
  onCleanup(() => {
    window.removeEventListener('beforeunload', onBeforeUnload);
    if (!isUnloading && props.tileId) {
      try {
        sessionStorage.removeItem(`twm-ws-view-${props.tileId}`);
        if (props.config.chartField) {
          sessionStorage.removeItem(`twm-ws-buf-${props.tileId}-${props.config.chartField}`);
        }
      } catch { /* ignore */ }
    }
  });

  // Re-runs on mount and whenever tileRefresh() increments (manual/timer refresh = reconnect)
  // or whenever the WebSocket URL changes (user edits config).
  // All reactive reads happen here at effect-top; connect() uses captured locals
  // so it never accidentally re-registers reactive subscriptions from setTimeout callbacks.
  createEffect(() => {
    const url = props.config.url; // track URL — URL change → reconnect
    tileRefresh();                // track refresh counter — increment → reconnect

    let ws: WebSocket;
    let retryDelay = BASE_DELAY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect(): void {
      if (destroyed) return;
      setStatus('connecting');
      try {
        ws = new WebSocket(url);
      } catch {
        setStatus('error');
        return;
      }

      ws.onopen = () => {
        retryDelay = BASE_DELAY_MS; // reset backoff on successful connect
        setStatus('open');
      };

      ws.onerror = () => {
        // onclose always fires after onerror; let onclose handle reconnect
      };

      ws.onclose = () => {
        if (destroyed) return;
        setStatus('reconnecting');
        retryTimer = setTimeout(() => {
          retryDelay = Math.min(retryDelay * 2, MAX_DELAY_MS);
          connect();
        }, retryDelay);
      };

      ws.onmessage = (e: MessageEvent) => {
        const raw = String(e.data);
        let parsed: unknown = raw;
        try { parsed = JSON.parse(raw); } catch { /* keep raw */ }
        const msg: WsMessage = { id: ++msgId, raw, parsed, ts: new Date() };
        setMessages((prev) => [...prev, msg].slice(-max()));
        // TWM-134-1: accumulate numeric chart values; persist to sessionStorage on every push
        const cf = props.config.chartField;
        if (cf) {
          const numVal = parseFloat(getField(parsed, cf));
          if (!Number.isNaN(numVal)) {
            const maxPoints = props.config.chartBufferMaxPoints ?? 500;
            const tileId = props.tileId;
            setChartBuffer((prev) => {
              const next = [...prev, numVal].slice(-maxPoints);
              if (tileId && cf) {
                try {
                  sessionStorage.setItem(`twm-ws-buf-${tileId}-${cf}`, JSON.stringify(next));
                } catch { /* storage quota exceeded - ignore */ }
              }
              return next;
            });
          }
        }
        sseReceivedAt.set('websocket', Date.now());
        setSseRevision(r => r + 1);
        if (listEl) listEl.scrollTop = listEl.scrollHeight;
      };
    }

    connect();

    onCleanup(() => {
      destroyed = true;
      if (retryTimer !== null) clearTimeout(retryTimer);
      ws?.close();
    });
  });

  const statusLabel = () => ({
    connecting:   '⟳ Connecting…',
    open:         '● Connected',
    closed:       '○ Disconnected',
    error:        '✕ Error',
    reconnecting: '⟳ Reconnecting…',
  }[status()]);

  const fieldPaths  = () => (props.config.fields ?? '').split(',').map(s => s.trim()).filter(Boolean);
  const fieldHeaders = () => {
    const labels = (props.config.fieldLabels ?? '').split(',').map(s => s.trim());
    return fieldPaths().map((p, i) => labels[i] || p);
  };
  const hasMappedFields = () => fieldPaths().length > 0;

  const hasChart = () => Boolean(props.config.chartField);

  return (
    <BaseTile class="ws-tile">
      <div class={`ws-status ws-status--${status() === 'reconnecting' ? 'connecting' : status()}`}>{statusLabel()}</div>
      <Show when={hasChart()}>
        <div class="mini-chart__toggle">
          <button
            class={`mini-chart__toggle-btn${chartView() === 'data' ? ' mini-chart__toggle-btn--active' : ''}`}
            onClick={() => pickView('data')}>Data</button>
          <button
            class={`mini-chart__toggle-btn${chartView() === 'chart' ? ' mini-chart__toggle-btn--active' : ''}`}
            onClick={() => pickView('chart')}>Chart</button>
        </div>
        <Show when={chartView() === 'chart'}>
          <MiniChart
            data={chartBuffer()}
            type={props.config.chartType ?? 'line'}
            label={props.config.chartField}
          />
        </Show>
      </Show>
      <Show when={!hasChart() || chartView() === 'data'}>
      <Show when={hasMappedFields()} fallback={
        <div class="ws-messages" ref={listEl}>
          <For each={messages()}>{(m) => (
            <div class="ws-message" data-msg-id={m.id}>
              <span class="ws-message__ts">{m.ts.toLocaleTimeString()}</span>
              <pre class="ws-message__body">
                {typeof m.parsed === 'object' ? JSON.stringify(m.parsed, null, 2) : m.raw}
              </pre>
            </div>
          )}</For>
          {messages().length === 0 && status() === 'open' && (
            <p class="ws-empty">Waiting for messages…</p>
          )}
        </div>
      }>
        <div class="ws-messages ws-messages--table" ref={listEl}>
          <table class="tile-table ws-table">
            <thead>
              <tr>
                <th>Time</th>
                <For each={fieldHeaders()}>{(h) => <th>{h}</th>}</For>
              </tr>
            </thead>
            <tbody>
              <For each={[...messages()].reverse()}>{(m) => (
                <tr>
                  <td class="ws-message__ts">{m.ts.toLocaleTimeString()}</td>
                  <For each={fieldPaths()}>{(path) => (
                    <td>{getField(m.parsed, path)}</td>
                  )}</For>
                </tr>
              )}</For>
            </tbody>
          </table>
          {messages().length === 0 && status() === 'open' && (
            <p class="ws-empty">Waiting for messages…</p>
          )}
        </div>
      </Show>
      </Show>
    </BaseTile>
  );
}
