import { For } from 'solid-js';
import type { JSX } from 'solid-js';
import type { Rect, HandleInfo } from '../layout/tree';

interface Props {
  rects: () => Record<string, Rect>;
  handles?: () => HandleInfo[];
  onRatioChange?: (splitId: string, ratio: number) => void;
  /** Optional factory — called with panelId to render panel content */
  renderPanel?: (id: string) => JSX.Element;
}

const RATIO_MIN = 0.05;
const RATIO_MAX = 0.95;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function PanelTree(props: Props) {
  // Drag state — mutable ref, no reactive signal needed
  let dragging: { info: HandleInfo } | null = null;

  function handlePointerDown(e: PointerEvent, info: HandleInfo) {
    dragging = { info };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // setPointerCapture not supported in some test environments
    }
  }

  function handlePointerMove(_e: PointerEvent) {
    // Live-preview ratio updates can be added here
  }

  function handlePointerUp(e: PointerEvent) {
    if (!dragging) return;
    const { info } = dragging;
    dragging = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // releasePointerCapture not supported in some test environments
    }

    if (!props.onRatioChange) return;

    const { containerRect, dir, splitId } = info;
    const ratio =
      dir === 'h'
        ? clamp((e.clientX - containerRect.x) / containerRect.w, RATIO_MIN, RATIO_MAX)
        : clamp((e.clientY - containerRect.y) / containerRect.h, RATIO_MIN, RATIO_MAX);

    props.onRatioChange(splitId, ratio);
  }

  return (
    <div class="panel-tree" style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ── Panels ─────────────────────────────────────────────────────────
           Use Object.keys (stable string IDs) instead of Object.entries so
           that Solid's For can do value-equality matching on strings. With
           Object.entries every resize creates new tuple references and For
           thinks every panel is brand-new → full unmount/remount → API reload.
           The rect is read reactively inside the callback instead.          */}
      <For each={Object.keys(props.rects())}>
        {(id) => {
          const rect = () => props.rects()[id]!;
          return (
            <div
              class="panel"
              data-panel-id={id}
              style={{
                position: 'absolute',
                left: `${rect().x}px`,
                top: `${rect().y}px`,
                width: `${rect().w}px`,
                height: `${rect().h}px`,
              }}
            >
              {props.renderPanel?.(id)}
            </div>
          );
        }}
      </For>
      <For each={props.handles?.() ?? []}>
        {(handle) => (
          <div
            class={`panel-handle panel-handle--${handle.dir}`}
            data-handle-id={handle.splitId}
            style={{
              position: 'absolute',
              left: `${handle.rect.x}px`,
              top: `${handle.rect.y}px`,
              width: `${handle.rect.w}px`,
              height: `${handle.rect.h}px`,
            }}
            on:pointerdown={(e: PointerEvent) => handlePointerDown(e, handle)}
            on:pointermove={(e: PointerEvent) => handlePointerMove(e)}
            on:pointerup={(e: PointerEvent) => handlePointerUp(e)}
          />
        )}
      </For>
    </div>
  );
}
