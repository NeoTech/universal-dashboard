import type { JSX } from 'solid-js';

// r=5 → circumference = 2π×5 ≈ 31.42
const C = 31.42;

interface Props {
  /** Poll interval in milliseconds */
  intervalMs: number;
  /** Tooltip label shown on hover */
  label?: string;
  /** Called each time the countdown completes one full cycle */
  onRefresh?: () => void;
}

/**
 * Tiny SVG countdown ring displayed in the tile titlebar.
 * Uses a pure CSS animation — no JS timers or reactive state.
 * The stroke drains from full → empty over `intervalMs`, then resets.
 * When `onRefresh` is provided, fires on every `animationiteration` event
 * so the tile data actually refreshes when the ring resets.
 */
export function TileRefreshTimer(props: Props): JSX.Element {
  const secs = () => Math.max(1, Math.round(props.intervalMs / 1000));
  const label = () => props.label ?? `Refreshes every ${secs() >= 60 ? `${Math.round(secs() / 60)}m` : `${secs()}s`}`;

  return (
    <svg
      class="tile-timer"
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-label={label()}
      style={{ display: 'block', flex: 'none', opacity: '0.55' }}
    >
      <title>{label()}</title>
      {/* Track */}
      <circle
        cx="8" cy="8" r="5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        opacity="0.2"
      />
      {/* Countdown arc — drains over the interval duration.
          animationiteration fires every time the loop restarts, which is
          exactly when the data should be refreshed. */}
      <circle
        cx="8" cy="8" r="5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-dasharray={`${C} ${C}`}
        stroke-dashoffset="0"
        stroke-linecap="round"
        transform="rotate(-90 8 8)"
        style={{
          animation: `twm-tile-countdown ${secs()}s linear infinite`,
        }}
        on:animationiteration={() => props.onRefresh?.()}
      />
    </svg>
  );
}
