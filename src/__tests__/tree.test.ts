import { describe, it, expect } from 'vitest';
import {
  makeLeaf,
  makeSplit,
  insertLeaf,
  removeLeaf,
  findLeaf,
  computeRects,
  leaves,
} from '../layout/tree';
import type { Tree, Rect } from '../layout/tree';

const ROOT_RECT: Rect = { x: 0, y: 0, w: 1000, h: 600 };

describe('makeLeaf', () => {
  it('creates a leaf with an auto-generated id', () => {
    const leaf = makeLeaf();
    expect(leaf.kind).toBe('leaf');
    expect(typeof leaf.id).toBe('string');
    expect(leaf.id.length).toBeGreaterThan(0);
  });

  it('accepts an explicit id', () => {
    const leaf = makeLeaf('panel-1');
    expect(leaf.id).toBe('panel-1');
  });
});

describe('makeSplit', () => {
  it('creates a split node', () => {
    const a = makeLeaf('a');
    const b = makeLeaf('b');
    const split = makeSplit('h', 0.5, a, b);
    expect(split.kind).toBe('split');
    expect(split.dir).toBe('h');
    expect(split.ratio).toBe(0.5);
    expect(split.first).toBe(a);
    expect(split.second).toBe(b);
  });
});

describe('leaves', () => {
  it('returns all leaf ids in a single leaf tree', () => {
    expect(leaves(makeLeaf('x'))).toEqual(['x']);
  });

  it('returns all leaf ids in a split tree', () => {
    const tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    expect(leaves(tree).sort()).toEqual(['a', 'b']);
  });

  it('handles deeply nested trees', () => {
    const tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    expect(leaves(tree).sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('findLeaf', () => {
  it('finds a leaf in a single-leaf tree', () => {
    const leaf = makeLeaf('x');
    expect(findLeaf(leaf, 'x')).toBe(leaf);
  });

  it('returns null for missing id', () => {
    expect(findLeaf(makeLeaf('x'), 'y')).toBeNull();
  });

  it('finds a leaf deep in a tree', () => {
    const target = makeLeaf('target');
    const tree: Tree = makeSplit('h', 0.5, makeSplit('v', 0.5, makeLeaf('a'), target), makeLeaf('b'));
    expect(findLeaf(tree, 'target')).toBe(target);
  });
});

describe('insertLeaf', () => {
  it('splits a single leaf horizontally', () => {
    const tree = makeLeaf('a');
    const next = insertLeaf(tree, 'a', 'h', 'b');
    expect(next.kind).toBe('split');
    if (next.kind === 'split') {
      expect(next.dir).toBe('h');
      expect(leaves(next).sort()).toEqual(['a', 'b']);
    }
  });

  it('inserts adjacent to a nested leaf', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const next = insertLeaf(tree, 'b', 'v', 'c');
    expect(leaves(next).sort()).toEqual(['a', 'b', 'c']);
  });

  it('throws when target id not found', () => {
    const tree = makeLeaf('a');
    expect(() => insertLeaf(tree, 'nope', 'h', 'b')).toThrow();
  });
});

describe('removeLeaf', () => {
  it('returns null when removing the only leaf', () => {
    expect(removeLeaf(makeLeaf('a'), 'a')).toBeNull();
  });

  it('promotes the sibling when removing from a split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const next = removeLeaf(tree, 'a');
    expect(next?.kind).toBe('leaf');
    expect(next?.id).toBe('b');
  });

  it('removes a nested leaf and restructures', () => {
    const tree: Tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const next = removeLeaf(tree, 'a');
    expect(next).not.toBeNull();
    expect(leaves(next!).sort()).toEqual(['b', 'c']);
  });

  it('returns null for id not in tree', () => {
    expect(removeLeaf(makeLeaf('a'), 'nope')).toBeNull();
  });
});

describe('computeRects', () => {
  it('single leaf fills the root rect', () => {
    const tree = makeLeaf('a');
    const rects = computeRects(tree, ROOT_RECT);
    expect(rects.get('a')).toEqual(ROOT_RECT);
  });

  it('horizontal split divides width at ratio', () => {
    const tree = makeSplit('h', 0.4, makeLeaf('a'), makeLeaf('b'));
    const rects = computeRects(tree, ROOT_RECT);
    const a = rects.get('a')!;
    const b = rects.get('b')!;
    expect(a.w).toBeCloseTo(400);
    expect(b.w).toBeCloseTo(600);
    expect(a.x).toBe(0);
    expect(b.x).toBeCloseTo(400);
    expect(a.h).toBe(ROOT_RECT.h);
    expect(b.h).toBe(ROOT_RECT.h);
  });

  it('vertical split divides height at ratio', () => {
    const tree = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'));
    const rects = computeRects(tree, ROOT_RECT);
    const a = rects.get('a')!;
    const b = rects.get('b')!;
    expect(a.h).toBeCloseTo(300);
    expect(b.h).toBeCloseTo(300);
    expect(a.y).toBe(0);
    expect(b.y).toBeCloseTo(300);
    expect(a.w).toBe(ROOT_RECT.w);
  });

  it('nested splits produce correct rects', () => {
    const tree: Tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const rects = computeRects(tree, ROOT_RECT);
    expect(rects.size).toBe(3);
    const a = rects.get('a')!;
    const b = rects.get('b')!;
    const c = rects.get('c')!;
    // Left half: w=500
    expect(a.w).toBeCloseTo(500);
    expect(b.w).toBeCloseTo(500);
    // Top/bottom of left half
    expect(a.h).toBeCloseTo(300);
    expect(b.h).toBeCloseTo(300);
    // Right half: w=500, full height
    expect(c.w).toBeCloseTo(500);
    expect(c.h).toBe(600);
    expect(c.x).toBeCloseTo(500);
  });
});
