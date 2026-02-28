import { describe, it, expect } from 'vitest';
import { KeyboardController } from '../keyboard/controller';
import { makeLeaf, makeSplit, computeRects } from '../layout/tree';
import type { Tree, Rect } from '../layout/tree';

const ROOT: Rect = { x: 0, y: 0, w: 1000, h: 600 };

function makeController(tree: Tree, focusedId: string) {
  const rects = Object.fromEntries(computeRects(tree, ROOT));
  return new KeyboardController(tree, rects, focusedId, ROOT);
}

describe('focus navigation', () => {
  it('moves focus right in a horizontal split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const ctrl = makeController(tree, 'a');
    expect(ctrl.focusDir('right')).toBe('b');
  });

  it('moves focus left in a horizontal split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const ctrl = makeController(tree, 'b');
    expect(ctrl.focusDir('left')).toBe('a');
  });

  it('moves focus down in a vertical split', () => {
    const tree: Tree = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'));
    const ctrl = makeController(tree, 'a');
    expect(ctrl.focusDir('down')).toBe('b');
  });

  it('moves focus up in a vertical split', () => {
    const tree: Tree = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'));
    const ctrl = makeController(tree, 'b');
    expect(ctrl.focusDir('up')).toBe('a');
  });

  it('stays on the same panel when no neighbor exists', () => {
    const tree: Tree = makeLeaf('only');
    const ctrl = makeController(tree, 'only');
    expect(ctrl.focusDir('right')).toBe('only');
    expect(ctrl.focusDir('left')).toBe('only');
  });

  it('navigates across nested splits', () => {
    // [a][b]
    // [c   ]
    const tree: Tree = makeSplit(
      'v',
      0.5,
      makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const ctrl = makeController(tree, 'a');
    // Moving down from a should reach c
    expect(ctrl.focusDir('down')).toBe('c');
  });
});

describe('split from keyboard', () => {
  it('returns a new tree with focused panel split horizontally', () => {
    const tree: Tree = makeLeaf('a');
    const ctrl = makeController(tree, 'a');
    const { tree: next, newId } = ctrl.split('h');
    expect(next.kind).toBe('split');
    if (next.kind === 'split') {
      expect(next.dir).toBe('h');
    }
    expect(typeof newId).toBe('string');
  });

  it('returns a new tree with focused panel split vertically', () => {
    const tree: Tree = makeLeaf('a');
    const ctrl = makeController(tree, 'a');
    const { tree: next } = ctrl.split('v');
    if (next.kind === 'split') expect(next.dir).toBe('v');
  });
});

describe('close from keyboard', () => {
  it('removes the focused panel and returns sibling as new focus', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const ctrl = makeController(tree, 'a');
    const result = ctrl.close();
    expect(result).not.toBeNull();
    expect(result?.tree.kind).toBe('leaf');
    expect(result?.tree.id).toBe('b');
    expect(result?.focusId).toBe('b');
  });

  it('returns null when closing the only panel', () => {
    const tree: Tree = makeLeaf('only');
    const ctrl = makeController(tree, 'only');
    expect(ctrl.close()).toBeNull();
  });
});
