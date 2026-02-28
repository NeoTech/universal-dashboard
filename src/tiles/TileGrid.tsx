import { For, Show, createEffect, createSignal, untrack } from 'solid-js';
import { createStore, reconcile } from 'solid-js/store';
import type { JSX } from 'solid-js';
import type { TileConfig } from './TileConfig';
import { snap, TILE_POLL_MS, TILE_SSE_CHANNEL } from './TileConfig';
import { TileRefreshTimer } from '../ui/TileRefreshTimer';
import { TileConfigProvider } from './TileConfigContext';
import { TileRefreshProvider } from './TileRefreshContext';
import { sseReceivedAt, sseRevision } from '../ui/useSseChannel';

// ── Central clock ─────────────────────────────────────────────────────────────
// One interval for the whole app. All TileFooters subscribe to this signal so
// "X ago" labels re-compute every 30 s without per-tile timers.
const [clock, setClock] = createSignal(Date.now());
setInterval(() => setClock(Date.now()), 30_000);

function timeAgo(nowMs: number, thenMs: number): string {
  const s = Math.floor((nowMs - thenMs) / 1000);
  if (s < 5)    return 'just now';
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Reactive "Updated X ago" footer.
 *  - sseRevision() fires immediately when SSE data arrives (makes footer appear).
 *  - clock() ticks every 30 s so "5m ago → 6m ago" keeps updating.
 *  No per-tile intervals — just two shared reactive signals.
 */
function TileFooter(p: { type: TileConfig['type'] }): JSX.Element {
  const channel = () =>
    (TILE_SSE_CHANNEL as Record<string, string>)[p.type] ?? p.type;
  const label = (): string | undefined => {
    const now = clock();    // re-runs on every 30 s tick
    sseRevision();          // also re-runs immediately on SSE arrival
    const ts = sseReceivedAt.get(channel());
    return ts ? `Updated ${timeAgo(now, ts)}` : undefined;
  };
  return (
    <Show when={label()}>
      {(l) => <div class="tile__footer">{l()}</div>}
    </Show>
  );
}

interface Props {
  tiles: TileConfig[];
  onLayoutChange: (tiles: TileConfig[]) => void;
  renderTile: (tile: TileConfig) => JSX.Element;
  onRemoveTile?: (id: string) => void;
  onConfigureTile?: (id: string) => void;
  onRefreshTile?: (id: string) => void;
  isRefreshingTile?: (id: string) => boolean;
  /** Called when the user ALT+drags a tile to a new position to copy it. */
  onTileCopy?: (sourceId: string, x: number, y: number) => void;
}

// ── Module-level drag/resize state (same pattern as PanelTree) ───────────────
let dragState: {
  tileId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
} | null = null;

let resizeState: {
  tileId: string;
  startX: number;
  startY: number;
  origW: number;
  origH: number;
} | null = null;

// Tracks an ALT+drag copy operation — tile moves visually but snaps back on drop
let copyDragState: {
  tileId: string;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
} | null = null;

export function TileGrid(props: Props): JSX.Element {
  // ── Store keeps tile component instances alive across drag/resize ──────────
  const [tiles, setTiles] = createStore<TileConfig[]>([]);
  // Per-tile refresh counters — incremented by timer ring AND manual button.
  // Custom tiles (RSS, REST, WS) subscribe to this via TileRefreshContext.
  const [refreshCounters, setRefreshCounters] = createStore<Record<string, number>>({});
  // ID of the tile currently being copy-dragged (for the CSS indicator class)
  const [copyingId, setCopyingId] = createSignal<string | null>(null);
  // ID of the tile actively being dragged — elevated z-index so it renders
  // above the sticky pagination bars (z-index:1) of other tiles.
  const [draggingId, setDraggingId] = createSignal<string | null>(null);

  createEffect(() => {
    setTiles(reconcile(props.tiles, { key: 'id', merge: true }));
  });

  /** Increment the per-tile counter (triggers self-polling tiles) then call parent. */
  function handleTileRefresh(tileId: string): void {
    setRefreshCounters(tileId, (c: number | undefined) => (c ?? 0) + 1);
    props.onRefreshTile?.(tileId);
  }

  /** Snapshot store → plain array and tell parent (only called on pointer-up) */
  const notifyParent = () => props.onLayoutChange(tiles.map(t => ({ ...t })));

  // ── Drag to move ──────────────────────────────────────────────────────────
  function onDragPointerDown(e: PointerEvent, tile: TileConfig): void {
    e.stopPropagation();
    if (e.altKey && props.onTileCopy) {
      // ALT+drag → copy mode: record origX/Y so we can restore after drop
      copyDragState = {
        tileId: tile.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: tile.x,
        origY: tile.y,
      };
      setCopyingId(tile.id);
    } else {
      dragState = {
        tileId: tile.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: tile.x,
        origY: tile.y,
      };
    }
    setDraggingId(tile.id);
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function onDragPointerMove(e: PointerEvent): void {
    if (copyDragState) {
      // Move tile visually during copy-drag (same as normal drag)
      const idx = tiles.findIndex(t => t.id === copyDragState!.tileId);
      if (idx >= 0) {
        setTiles(idx, {
          x: snap(Math.max(0, copyDragState.origX + (e.clientX - copyDragState.startX))),
          y: snap(Math.max(0, copyDragState.origY + (e.clientY - copyDragState.startY))),
        });
      }
      return;
    }
    if (!dragState) return;
    const idx = tiles.findIndex(t => t.id === dragState!.tileId);
    if (idx < 0) return;
    // Update store only — no parent notification during move avoids
    // triggering tile re-mounts and API refetches while dragging
    setTiles(idx, {
      x: snap(Math.max(0, dragState.origX + (e.clientX - dragState.startX))),
      y: snap(Math.max(0, dragState.origY + (e.clientY - dragState.startY))),
    });
  }

  function onDragPointerUp(e: PointerEvent): void {
    if (copyDragState) {
      try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* jsdom */ }
      // Calculate the drop position the tile was moved to
      const idx = tiles.findIndex(t => t.id === copyDragState!.tileId);
      const dropX = idx >= 0 ? tiles[idx].x : copyDragState.origX;
      const dropY = idx >= 0 ? tiles[idx].y : copyDragState.origY;
      // Restore original tile position (the original stays; a copy is created)
      if (idx >= 0) {
        setTiles(idx, { x: copyDragState.origX, y: copyDragState.origY });
      }
      props.onTileCopy?.(copyDragState.tileId, dropX, dropY);
      copyDragState = null;
      setCopyingId(null);
      setDraggingId(null);
      notifyParent();
      return;
    }
    if (!dragState) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* jsdom */ }
    dragState = null;
    setDraggingId(null);
    notifyParent(); // persist final position only on drop
  }

  // ── Resize handle ─────────────────────────────────────────────────────────
  function onResizePointerDown(e: PointerEvent, tile: TileConfig): void {
    e.stopPropagation();
    resizeState = {
      tileId: tile.id,
      startX: e.clientX,
      startY: e.clientY,
      origW: tile.w,
      origH: tile.h,
    };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function onResizePointerMove(e: PointerEvent): void {
    if (!resizeState) return;
    const idx = tiles.findIndex(t => t.id === resizeState!.tileId);
    if (idx < 0) return;
    setTiles(idx, {
      w: snap(Math.max(160, resizeState.origW + (e.clientX - resizeState.startX))),
      h: snap(Math.max(120, resizeState.origH + (e.clientY - resizeState.startY))),
    });
  }

  function onResizePointerUp(e: PointerEvent): void {
    if (!resizeState) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch { /* jsdom */ }
    resizeState = null;
    notifyParent(); // persist final size only on release
  }

  return (
    <div
      class="tile-grid"
      style={{ position: 'absolute', inset: '0', overflow: 'auto' }}
      on:pointermove={(e: PointerEvent) => { onDragPointerMove(e); onResizePointerMove(e); }}
      on:pointerup={(e: PointerEvent) => { onDragPointerUp(e); onResizePointerUp(e); }}
    >
      <For each={tiles}>
        {(tile) => (
          <div
            class="tile"
            data-tile-id={tile.id}
            data-tile-type={tile.type}
            classList={{ 'tile--copying': copyingId() === tile.id }}
            style={{
              position: 'absolute',
              left: `${tile.x}px`,
              top: `${tile.y}px`,
              width: `${tile.w}px`,
              height: `${tile.h}px`,
              'z-index': draggingId() === tile.id ? '10' : '0',
            }}
          >
            {/* Title bar — drag handle */}
            <div
              class="tile__titlebar"
              on:pointerdown={(e: PointerEvent) => onDragPointerDown(e, tile)}
            >
              <span class="tile__title">{tile.title ?? tile.type}</span>
              <Show when={(tile.refreshInterval ?? 1) > 0}>
                <TileRefreshTimer
                  intervalMs={tile.refreshInterval ?? TILE_POLL_MS[tile.type] ?? 60_000}
                  onRefresh={() => handleTileRefresh(tile.id)}
                />
              </Show>
              <Show when={props.onRefreshTile}>
                <button
                  class="tile__refresh"
                  classList={{ 'tile__refresh--spinning': props.isRefreshingTile?.(tile.id) ?? false }}
                  aria-label="Refresh tile"
                  disabled={props.isRefreshingTile?.(tile.id) ?? false}
                  on:pointerdown={(e: PointerEvent) => e.stopPropagation()}
                  onClick={() => handleTileRefresh(tile.id)}
                >
                  ↻
                </button>
              </Show>
              <Show when={props.onConfigureTile}>
                <button
                  class="tile__gear"
                  aria-label="Configure tile"
                  on:pointerdown={(e: PointerEvent) => e.stopPropagation()}
                  onClick={() => props.onConfigureTile!(tile.id)}
                >
                  ⚙
                </button>
              </Show>
              <Show when={props.onRemoveTile}>
                <button
                  class="tile__close"
                  aria-label="Remove tile"
                  // Stop the titlebar's setPointerCapture from swallowing this click
                  on:pointerdown={(e: PointerEvent) => e.stopPropagation()}
                  onClick={() => props.onRemoveTile!(tile.id)}
                >
                  ×
                </button>
              </Show>
            </div>

            {/* Content — TileConfigProvider is OUTSIDE untrack so pageSize /
                 fetchLimit changes propagate reactively. untrack is only around
                 the actual tile factory call so drag / resize field changes
                 (x, y, w, h) don't remount the tile component.                */}
            <div class="tile__content">
              <TileRefreshProvider value={() => refreshCounters[tile.id] ?? 0}>
                <TileConfigProvider value={tile}>
                  {untrack(() => props.renderTile(tile))}
                </TileConfigProvider>
              </TileRefreshProvider>
            </div>

            {/* Last-updated footer — reads sseRevision() so it re-renders
                reactively whenever any SSE channel receives new data.        */}
            <Show when={tile.showLastUpdated !== false}>
              <TileFooter type={tile.type} />
            </Show>

            {/* Resize handle */}
            <div
              class="tile__resize-handle"
              aria-label="Resize tile"
              on:pointerdown={(e: PointerEvent) => onResizePointerDown(e, tile)}
            />
          </div>
        )}
      </For>
    </div>
  );
}
