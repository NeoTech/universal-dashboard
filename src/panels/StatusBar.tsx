import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import { useHints } from '../ui/HintsContext';

interface Props {
  focusedPanelId: string;
  workspaceName: string;
  /** Number of dashboards currently open (1–4). Defaults to 1. */
  dashCount?: number;
  /** Zero-based index of the active dashboard. Defaults to 0. */
  activeDashIdx?: number;
}

/**
 * Application status bar rendered as a Solid component.
 *
 * Uses Alpine.js `x-data` / `x-text` attributes so Alpine can drive the live
 * clock tick reactively in the browser without coupling Solid's render cycle.
 *
 * Solid owns the workspace name and focused-panel bindings (SSR-safe); Alpine
 * owns the `time` field updated every second via `x-init`.
 */
export function StatusBar(props: Props): JSX.Element {
  // Alpine x-data: initial state for the live clock
  const xData = `{ time: new Date().toLocaleTimeString(), init() { setInterval(() => this.time = new Date().toLocaleTimeString(), 1000) } }`;
  const { hints } = useHints();

  return (
    <div class="status-bar" x-data={xData}>
      <span class="status-bar__workspace">{props.workspaceName}</span>

      {/* Dashboard pip indicators */}
      <span class="status-bar__dashboards" aria-label="Dashboards">
        <For each={Array.from({ length: props.dashCount ?? 1 })}>
          {(_, i) => (
            <span
              class={`status-bar__dash-dot${i() === (props.activeDashIdx ?? 0) ? ' status-bar__dash-dot--active' : ''}`}
              aria-label={`Dashboard ${i() + 1}${i() === (props.activeDashIdx ?? 0) ? ' (active)' : ''}`}
            />
          )}
        </For>
      </span>

      <span
        class="status-bar__focused"
        data-testid="focused-id"
      >
        {props.focusedPanelId}
      </span>

      {/* Keyboard hints — contextual shortcuts */}
      <span class="status-bar__hints" aria-label="Keyboard shortcuts">
        <For each={hints()}>
          {(hint) => (
            <span class="status-bar__hint">
              <kbd class="hint-key">{hint.keys}</kbd>
              <span class="hint-label">{hint.label}</span>
            </span>
          )}
        </For>
      </span>

      {/* Alpine owns this — shows a live clock ticking every second */}
      <span class="status-bar__clock" x-text="time">
        {new Date().toLocaleTimeString()}
      </span>
    </div>
  );
}
