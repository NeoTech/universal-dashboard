import type { JSX } from 'solid-js';
import { connectionState, transportMode } from './flintRealtimeStore';

const STATE_CSS: Record<string, string> = {
  connected:    'flint-ws-dot--connected',
  connecting:   'flint-ws-dot--connecting',
  disconnected: 'flint-ws-dot--disconnected',
};

const STATE_LABEL: Record<string, string> = {
  connected:    'Connected',
  connecting:   'Connecting\u2026',
  disconnected: 'Disconnected',
};

/**
 * Compact WS connection indicator for FLINT tile toolbars.
 *
 * Shows a colored dot (green/yellow/gray) with transport mode label.
 * Can be placed inline in any tile header or status bar.
 */
export function FlintWsIndicator(): JSX.Element {
  const state = () => connectionState();
  const mode  = () => transportMode();
  const label = () => `${STATE_LABEL[state()]} (${mode().toUpperCase()})`;

  return (
    <span class={`flint-ws-indicator ${STATE_CSS[state()]}`} title={label()}>
      <span class="flint-ws-dot" />
      <span class="flint-ws-label">{mode().toUpperCase()}</span>
    </span>
  );
}
