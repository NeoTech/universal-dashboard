/**
 * BaseTile — shared wrapper for every tile content component.
 *
 * Centralises three things that used to be copy-pasted in every tile:
 *   1. The outer wrapper `<div>` with a consistent CSS class.
 *   2. The loading skeleton shown while the first data fetch is in-flight.
 *   3. The error message shown when the data source returns an error.
 *
 * Usage:
 * ```tsx
 * export function MyTile(): JSX.Element {
 *   const { data, loading, error } = useSseChannel<…>('my-event', default);
 *   return (
 *     <BaseTile loading={loading()} error={error()}>
 *       <table class="tile-table">…</table>
 *     </BaseTile>
 *   );
 * }
 * ```
 *
 * Tiles that need an additional wrapper class (e.g. `revenue-tile`) can pass
 * the full class string via the `class` prop:
 * ```tsx
 * <BaseTile loading={loading()} error={error()} class="stripe-tile revenue-tile">
 * ```
 *
 * Tiles with a wholly different wrapper (e.g. `ws-tile`) pass just that class:
 * ```tsx
 * <BaseTile class="ws-tile">
 * ```
 */

import type { JSX } from 'solid-js';
import { createMemo, For } from 'solid-js';
import { Skeleton } from '../ui/Skeleton';
import { sseEnvStatus } from '../ui/useSseChannel';
import { useTileConfig } from './TileConfigContext';
import { TILE_SSE_CHANNEL } from './TileConfig';

interface BaseTileProps {
  /** Whether the data is still being loaded (shows a Skeleton placeholder). */
  loading?: boolean;
  /** Error message to display instead of content. */
  error?: string | null;
  /**
   * Number of skeleton lines shown during loading.
   * @default 5
   */
  skeletonLines?: number;
  /**
   * Full CSS class string for the outer wrapper div.
   * @default 'stripe-tile'
   */
  class?: string;
  /** Inline styles for the outer wrapper div (merged with the class styles). */
  style?: JSX.CSSProperties;
  /** Tile body content rendered when not loading and no error. */
  children: JSX.Element;
}

export function BaseTile(props: BaseTileProps): JSX.Element {
  const tileConfig = useTileConfig();

  // Derive missing env vars reactively from the server's env-status broadcast.
  // Falls back to the TileConfig's own missingEnvVars if set (e.g. in tests).
  const missingVars = createMemo<string[]>(() => {
    if (tileConfig) {
      const channel = TILE_SSE_CHANNEL[tileConfig.type] ?? tileConfig.type;
      const fromSse = sseEnvStatus()[channel];
      if (fromSse && fromSse.length > 0) return fromSse;
    }
    return tileConfig?.missingEnvVars ?? [];
  });

  return (
    <div class={props.class ?? 'stripe-tile'} style={props.style}>
      {missingVars().length > 0 ? (
        <div class="tile-env-warning">
          <p class="tile-env-warning__title">⚠ Missing configuration</p>
          <p class="tile-env-warning__body">
            Add the following to your <code>.env</code> file to enable this tile:
          </p>
          <ul class="tile-env-warning__list">
            <For each={missingVars()}>{(v) => <li><code>{v}</code></li>}</For>
          </ul>
        </div>
      ) : props.loading ? (
        <Skeleton lines={props.skeletonLines ?? 5} />
      ) : props.error ? (
        <p class="tile-error">{props.error}</p>
      ) : (
        props.children
      )}
    </div>
  );
}
