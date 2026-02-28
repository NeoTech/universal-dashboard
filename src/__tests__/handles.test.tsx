import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PanelTree } from '../renderer/PanelTree';
import { makeLeaf, makeSplit, computeRects, computeHandles } from '../layout/tree';
import type { Rect, Tree } from '../layout/tree';

afterEach(() => cleanup());

const ROOT: Rect = { x: 0, y: 0, w: 1000, h: 600 };

describe('computeHandles', () => {
  it('returns empty for a single leaf', () => {
    expect(computeHandles(makeLeaf('a'), ROOT)).toHaveLength(0);
  });

  it('returns one handle for a single split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 's1');
    const handles = computeHandles(tree, ROOT);
    expect(handles).toHaveLength(1);
    expect(handles[0].splitId).toBe('s1');
    expect(handles[0].dir).toBe('h');
  });

  it('places horizontal handle at the split boundary', () => {
    const tree: Tree = makeSplit('h', 0.4, makeLeaf('a'), makeLeaf('b'), 's1');
    const handles = computeHandles(tree, ROOT);
    const h = handles[0];
    // handle center should be at x=400
    expect(h.rect.x + h.rect.w / 2).toBeCloseTo(400);
    expect(h.rect.h).toBe(ROOT.h);
  });

  it('places vertical handle at the split boundary', () => {
    const tree: Tree = makeSplit('v', 0.6, makeLeaf('a'), makeLeaf('b'), 's1');
    const handles = computeHandles(tree, ROOT);
    const h = handles[0];
    expect(h.rect.y + h.rect.h / 2).toBeCloseTo(360);
    expect(h.rect.w).toBe(ROOT.w);
  });

  it('returns handles for all split nodes', () => {
    const tree: Tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'), 'inner'),
      makeLeaf('c'),
      'outer',
    );
    const handles = computeHandles(tree, ROOT);
    expect(handles).toHaveLength(2);
    const ids = handles.map((h) => h.splitId).sort();
    expect(ids).toEqual(['inner', 'outer']);
  });
});

describe('PanelTree with handles', () => {
  it('renders no handles for a leaf tree', () => {
    const tree: Tree = makeLeaf('a');
    const rects = computeRects(tree, ROOT);
    const handles = computeHandles(tree, ROOT);
    const { container } = render(() => (
      <PanelTree
        rects={() => Object.fromEntries(rects)}
        handles={() => handles}
      />
    ));
    expect(container.querySelectorAll('.panel-handle')).toHaveLength(0);
  });

  it('renders one handle for a horizontal split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 's1');
    const { container } = render(() => (
      <PanelTree
        rects={() => Object.fromEntries(computeRects(tree, ROOT))}
        handles={() => computeHandles(tree, ROOT)}
      />
    ));
    const handle = container.querySelector('.panel-handle');
    expect(handle).toBeTruthy();
    expect(handle?.classList.contains('panel-handle--h')).toBe(true);
    expect(handle?.getAttribute('data-handle-id')).toBe('s1');
  });

  it('renders the correct handle class for vertical splits', () => {
    const tree: Tree = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'), 's1');
    const { container } = render(() => (
      <PanelTree
        rects={() => Object.fromEntries(computeRects(tree, ROOT))}
        handles={() => computeHandles(tree, ROOT)}
      />
    ));
    const handle = container.querySelector('.panel-handle');
    expect(handle?.classList.contains('panel-handle--v')).toBe(true);
  });
});
