import { describe, it, expect } from 'vitest';
import {
  serializeTree,
  deserializeTree,
  LAYOUT_VERSION,
} from '../layout/serialization';
import { makeLeaf, makeSplit, leaves } from '../layout/tree';
import type { Tree } from '../layout/tree';

describe('LAYOUT_VERSION', () => {
  it('is a positive integer', () => {
    expect(Number.isInteger(LAYOUT_VERSION)).toBe(true);
    expect(LAYOUT_VERSION).toBeGreaterThan(0);
  });
});

describe('serializeTree', () => {
  it('serializes a single leaf', () => {
    const tree = makeLeaf('a');
    const data = serializeTree(tree);
    expect(data.version).toBe(LAYOUT_VERSION);
    expect(data.tree.kind).toBe('leaf');
    expect((data.tree as { id: string }).id).toBe('a');
  });

  it('serializes a split tree', () => {
    const tree: Tree = makeSplit('h', 0.4, makeLeaf('a'), makeLeaf('b'), 's1');
    const data = serializeTree(tree);
    expect(data.tree.kind).toBe('split');
  });

  it('produces valid JSON (no circular refs, no functions)', () => {
    const tree: Tree = makeSplit(
      'h',
      0.5,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const json = JSON.stringify(serializeTree(tree));
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe('deserializeTree', () => {
  it('round-trips a leaf', () => {
    const original = makeLeaf('x');
    const restored = deserializeTree(serializeTree(original));
    expect(restored.kind).toBe('leaf');
    expect(restored.id).toBe('x');
  });

  it('round-trips a complex tree', () => {
    const original: Tree = makeSplit(
      'h',
      0.6,
      makeSplit('v', 0.5, makeLeaf('a'), makeLeaf('b')),
      makeLeaf('c'),
    );
    const restored = deserializeTree(serializeTree(original));
    expect(leaves(restored).sort()).toEqual(['a', 'b', 'c']);
    if (restored.kind === 'split') {
      expect(restored.ratio).toBeCloseTo(0.6);
      expect(restored.dir).toBe('h');
    }
  });

  it('throws on null input', () => {
    expect(() => deserializeTree(null)).toThrow();
  });

  it('throws on missing version', () => {
    expect(() => deserializeTree({ tree: { kind: 'leaf', id: 'x' } })).toThrow(/version/i);
  });

  it('throws on unknown version', () => {
    expect(() =>
      deserializeTree({ version: 9999, tree: { kind: 'leaf', id: 'x' } }),
    ).toThrow(/version/i);
  });

  it('throws on invalid tree structure', () => {
    expect(() =>
      deserializeTree({ version: LAYOUT_VERSION, tree: { kind: 'bad' } }),
    ).toThrow();
  });
});
