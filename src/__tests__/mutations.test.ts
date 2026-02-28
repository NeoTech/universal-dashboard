import { describe, it, expect } from 'vitest';
import { makeLeaf, makeSplit, setRatio, swapLeaves, leaves } from '../layout/tree';
import type { Tree } from '../layout/tree';

describe('setRatio', () => {
  it('updates the ratio of a split by id', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'root-split');
    const next = setRatio(tree, 'root-split', 0.7);
    expect(next.kind).toBe('split');
    if (next.kind === 'split') expect(next.ratio).toBeCloseTo(0.7);
  });

  it('leaves other nodes unchanged', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'root-split');
    const next = setRatio(tree, 'root-split', 0.3);
    // leaves still the same
    expect(leaves(next).sort()).toEqual(['a', 'b']);
  });

  it('updates a nested split', () => {
    const inner = makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b'), 'inner');
    const tree: Tree = makeSplit('h', 0.5, inner, makeLeaf('c'), 'outer');
    const next = setRatio(tree, 'inner', 0.8);
    if (next.kind === 'split' && next.first.kind === 'split') {
      expect(next.first.ratio).toBeCloseTo(0.8);
    }
  });

  it('throws for ratio out of bounds', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'root-split');
    expect(() => setRatio(tree, 'root-split', 0)).toThrow();
    expect(() => setRatio(tree, 'root-split', 1)).toThrow();
  });

  it('throws when split id not found', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'root-split');
    expect(() => setRatio(tree, 'nope', 0.5)).toThrow();
  });
});

describe('swapLeaves', () => {
  it('swaps two direct siblings', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const next = swapLeaves(tree, 'a', 'b');
    if (next.kind === 'split') {
      expect(next.first.id).toBe('b');
      expect(next.second.id).toBe('a');
    }
  });

  it('is a no-op when both ids are the same', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const next = swapLeaves(tree, 'a', 'a');
    if (next.kind === 'split') {
      expect(next.first.id).toBe('a');
      expect(next.second.id).toBe('b');
    }
  });

  it('swaps non-sibling leaves across branches', () => {
    const tree: Tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const next = swapLeaves(tree, 'a', 'c');
    expect(leaves(next).sort()).toEqual(['a', 'b', 'c']);
    // 'c' should now be on the left side
    const leftLeaves = leaves(next.kind === 'split' ? next.first : next);
    expect(leftLeaves).toContain('c');
  });

  it('throws when a leaf id is not found', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    expect(() => swapLeaves(tree, 'a', 'nope')).toThrow();
  });
});
