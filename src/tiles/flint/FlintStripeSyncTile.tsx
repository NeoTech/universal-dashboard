import { createSignal, createEffect, on, onCleanup, Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { API_BASE_URL } from '../../data/api';
import { fmtDate } from './utils';
import { flintStore } from './flintStore';

type SyncPhase = 'all' | 'stage' | 'finalize' | 'status';

const SYNC_PHASE_LABELS: Record<SyncPhase, string> = {
  all:      'All Phases',
  stage:    'Stage',
  finalize: 'Finalize',
  status:   'Status Only',
};

interface SyncResult {
  phase: string;
  processed?: number;
  skipped?: number;
  errors?: number;
  durationMs?: number;
  [key: string]: unknown;
}

const SESSION_KEY = 'flint-last-sync-at';

export function FlintStripeSyncTile(_props: Record<string, never>): JSX.Element {
  const [phase, setPhase]           = createSignal<SyncPhase>('all');
  const [running, setRunning]       = createSignal(false);
  const [elapsed, setElapsed]       = createSignal(0);
  const [result, setResult]         = createSignal<SyncResult | null>(null);
  const [syncError, setSyncError]   = createSignal<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = createSignal<string | null>(
    sessionStorage.getItem(SESSION_KEY),
  );

  let timerRef: ReturnType<typeof setInterval> | null = null;

  function startTimer(): void {
    setElapsed(0);
    timerRef = setInterval(() => setElapsed(s => s + 1), 1000);
  }

  function stopTimer(): void {
    if (timerRef) { clearInterval(timerRef); timerRef = null; }
  }

  async function runSync(): Promise<void> {
    setSyncError(null);
    setResult(null);
    setRunning(true);
    startTimer();
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/flint/admin/sync-stripe?phase=${phase()}`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json() as SyncResult;
      setResult(data);
      const now = new Date().toISOString();
      setLastSyncAt(now);
      sessionStorage.setItem(SESSION_KEY, now);
      flintStore.triggerOrderRefresh();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err));
    } finally {
      stopTimer();
      setRunning(false);
    }
  }

  // ── Cross-tile store listener ──────────────────────────────────────────────

  createEffect(on(() => flintStore.syncTrigger(), () => {
    void runSync();
  }, { defer: true }));

  onCleanup(() => stopTimer());

  return (
    <div class="stripe-tile flint-stripe-sync-tile">
      <div style="padding:12px">
        <div class="tile-toolbar" style="margin-bottom:12px">
          <label class="flint-auth-form__label" style="flex:1">
            Sync Phase
            <select
              class="flint-auth-form__input"
              value={phase()}
              onChange={(e) => setPhase(e.currentTarget.value as SyncPhase)}
              disabled={running()}
            >
              {(Object.keys(SYNC_PHASE_LABELS) as SyncPhase[]).map(p => (
                <option value={p}>{SYNC_PHASE_LABELS[p]}</option>
              ))}
            </select>
          </label>
          <button
            class="btn btn--primary"
            style="margin-top:18px"
            disabled={running()}
            onClick={() => void runSync()}
          >
            {running() ? `Running… ${elapsed()}s` : 'Run Sync'}
          </button>
        </div>

        <Show when={lastSyncAt()}>
          <p class="cell-muted" style="font-size:var(--twm-font-size-xs);margin-bottom:8px">
            Last sync: {fmtDate(lastSyncAt()!)}
          </p>
        </Show>

        <Show when={running()}>
          <div class="flint-sync-progress">
            <div class="drawer-loading" />
            <span class="cell-muted">Elapsed: {elapsed()}s</span>
          </div>
        </Show>

        <Show when={syncError()}>
          <p class="drawer-error">{syncError()}</p>
        </Show>

        <Show when={result()}>
          {(r) => (
            <div class="flint-sync-result">
              <p style="font-weight:600;margin-bottom:6px">Sync Complete</p>
              <table class="stripe-table">
                <tbody>
                  {Object.entries(r()).filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object').map(([k, v]) => (
                    <tr>
                      <td>{k}</td>
                      <td class="cell-right">{String(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                class="btn btn--sm btn--neutral"
                style="margin-top:8px"
                onClick={() => void runSync()}
              >
                Run Again
              </button>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
}
