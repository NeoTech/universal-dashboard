import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PanelTree } from '../renderer/PanelTree';
import { makeSplit, makeLeaf, computeRects } from '../layout/tree';
import type { Rect, Tree } from '../layout/tree';
import { createSignal } from 'solid-js';

afterEach(() => cleanup());

const ROOT: Rect = { x: 0, y: 0, w: 1000, h: 600 };

describe('PanelTree', () => {
  it('renders a single panel for a leaf tree', () => {
    const tree: Tree = makeLeaf('a');
    const rects = computeRects(tree, ROOT);
    const { container } = render(() => (
      <PanelTree rects={() => Object.fromEntries(rects)} />
    ));
    const panels = container.querySelectorAll('.panel');
    expect(panels).toHaveLength(1);
    expect(panels[0].getAttribute('data-panel-id')).toBe('a');
  });

  it('renders the correct number of panels for a split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const rects = computeRects(tree, ROOT);
    const { container } = render(() => (
      <PanelTree rects={() => Object.fromEntries(rects)} />
    ));
    expect(container.querySelectorAll('.panel')).toHaveLength(2);
  });

  it('applies inline styles with position from rects', () => {
    const tree: Tree = makeSplit('h', 0.4, makeLeaf('a'), makeLeaf('b'));
    const rects = computeRects(tree, ROOT);
    const { container } = render(() => (
      <PanelTree rects={() => Object.fromEntries(rects)} />
    ));
    const aPanel = container.querySelector('[data-panel-id="a"]') as HTMLElement;
    expect(aPanel.style.width).toBe('400px');
    expect(aPanel.style.left).toBe('0px');
    const bPanel = container.querySelector('[data-panel-id="b"]') as HTMLElement;
    expect(bPanel.style.left).toBe('400px');
    expect(bPanel.style.width).toBe('600px');
  });

  it('re-renders reactively when rects signal changes', () => {
    const tree1: Tree = makeLeaf('a');
    const tree2: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const [rectsMap, setRectsMap] = createSignal<Record<string, Rect>>(
      Object.fromEntries(computeRects(tree1, ROOT)),
    );

    const { container } = render(() => <PanelTree rects={rectsMap} />);
    expect(container.querySelectorAll('.panel')).toHaveLength(1);

    setRectsMap(Object.fromEntries(computeRects(tree2, ROOT)));
    expect(container.querySelectorAll('.panel')).toHaveLength(2);
  });
});
