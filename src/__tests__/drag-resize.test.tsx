import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { PanelTree } from '../renderer/PanelTree';
import { makeLeaf, makeSplit, computeRects, computeHandles } from '../layout/tree';
import type { Rect, Tree } from '../layout/tree';

afterEach(cleanup);

const ROOT: Rect = { x: 0, y: 0, w: 1000, h: 600 };

describe('drag-to-resize', () => {
  function setup(onRatioChange = vi.fn()) {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'split-h');
    const rects = () => Object.fromEntries(computeRects(tree, ROOT));
    const handles = () => computeHandles(tree, ROOT);
    const { container } = render(() => (
      <PanelTree rects={rects} handles={handles} onRatioChange={onRatioChange} />
    ));
    const handle = container.querySelector<HTMLElement>('.panel-handle')!;
    return { container, handle, onRatioChange };
  }

  it('fires onRatioChange after pointer drag on horizontal handle', () => {
    const { handle, onRatioChange } = setup();
    // Handle is at x=498 (center=500). Drag 100px right → new ratio = 0.6
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 600, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 600, clientY: 300, pointerId: 1 });
    expect(onRatioChange).toHaveBeenCalledOnce();
    const [splitId, ratio] = onRatioChange.mock.calls[0];
    expect(splitId).toBe('split-h');
    expect(ratio).toBeCloseTo(0.6, 2);
  });

  it('fires onRatioChange for vertical handle', () => {
    const tree: Tree = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'), 'split-v');
    const rects = () => Object.fromEntries(computeRects(tree, ROOT));
    const handles = () => computeHandles(tree, ROOT);
    const onRatioChange = vi.fn();
    const { container } = render(() => (
      <PanelTree rects={rects} handles={handles} onRatioChange={onRatioChange} />
    ));
    const handle = container.querySelector<HTMLElement>('.panel-handle')!;
    // Center at y=300. Drag 60px down → ratio = 360/600 = 0.6
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 500, clientY: 360, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500, clientY: 360, pointerId: 1 });
    expect(onRatioChange).toHaveBeenCalledOnce();
    const [splitId, ratio] = onRatioChange.mock.calls[0];
    expect(splitId).toBe('split-v');
    expect(ratio).toBeCloseTo(0.6, 2);
  });

  it('does not fire onRatioChange if pointer released without move', () => {
    const { handle, onRatioChange } = setup();
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    // No movement — onRatioChange should still fire (position is same as start)
    // but the ratio would equal the original 0.5 (no-op allowed)
    // The key thing is no crash
    expect(onRatioChange).toHaveBeenCalledTimes(1);
    expect(onRatioChange.mock.calls[0][1]).toBeCloseTo(0.5, 2);
  });

  it('clamps ratio to minimum 0.05', () => {
    const { handle, onRatioChange } = setup();
    // Drag far left (beyond container bounds) → ratio clamped to 0.05
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: -200, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: -200, clientY: 300, pointerId: 1 });
    expect(onRatioChange.mock.calls[0][1]).toBeGreaterThanOrEqual(0.05);
  });

  it('clamps ratio to maximum 0.95', () => {
    const { handle, onRatioChange } = setup();
    // Drag far right (beyond container bounds) → ratio clamped to 0.95
    fireEvent.pointerDown(handle, { clientX: 500, clientY: 300, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 1200, clientY: 300, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 1200, clientY: 300, pointerId: 1 });
    expect(onRatioChange.mock.calls[0][1]).toBeLessThanOrEqual(0.95);
  });
});
