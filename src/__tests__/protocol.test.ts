import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutEngine } from '../layout/engine';
import { makeLeaf, makeSplit, leaves } from '../layout/tree';
import { LAYOUT_VERSION } from '../layout/serialization';
import type { Tree } from '../layout/tree';

let engine: LayoutEngine;
const VIEWPORT = { w: 1000, h: 600 };

beforeEach(() => {
  engine = new LayoutEngine(VIEWPORT);
  const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'root');
  engine.cmd({ type: 'SET_TREE', tree });
});

describe('INSERT_LEAF', () => {
  it('inserts a new leaf adjacent to a target', () => {
    const res = engine.cmd({ type: 'INSERT_LEAF', targetId: 'a', dir: 'v', newId: 'c' });
    expect(res.type).toBe('RECTS');
    if (res.type === 'RECTS') {
      expect(Object.keys(res.rects)).toHaveLength(3);
      expect(res.rects['c']).toBeDefined();
    }
  });

  it('returns ERROR when target not found', () => {
    const res = engine.cmd({ type: 'INSERT_LEAF', targetId: 'nope', dir: 'h', newId: 'x' });
    expect(res.type).toBe('ERROR');
  });
});

describe('REMOVE_LEAF', () => {
  it('removes a leaf and returns updated rects', () => {
    const res = engine.cmd({ type: 'REMOVE_LEAF', id: 'a' });
    expect(res.type).toBe('RECTS');
    if (res.type === 'RECTS') {
      expect(Object.keys(res.rects)).toHaveLength(1);
      expect(res.rects['b']).toBeDefined();
    }
  });

  it('returns ERROR when leaf not found', () => {
    const res = engine.cmd({ type: 'REMOVE_LEAF', id: 'nope' });
    expect(res.type).toBe('ERROR');
  });
});

describe('SET_RATIO', () => {
  it('updates split ratio and recomputes rects', () => {
    const res = engine.cmd({ type: 'SET_RATIO', splitId: 'root', ratio: 0.3 });
    expect(res.type).toBe('RECTS');
    if (res.type === 'RECTS') {
      expect(res.rects['a']?.w).toBeCloseTo(300);
      expect(res.rects['b']?.w).toBeCloseTo(700);
    }
  });

  it('returns ERROR when split not found', () => {
    const res = engine.cmd({ type: 'SET_RATIO', splitId: 'nope', ratio: 0.5 });
    expect(res.type).toBe('ERROR');
  });
});

describe('SWAP_LEAVES', () => {
  it('swaps two leaves and recomputes rects', () => {
    // a is at x=0, b is at x=500; after swap a should be at x=500, b at x=0
    const before_a = engine.cmd({ type: 'GET_RECTS' });
    if (before_a.type !== 'RECTS') return;
    const aX = before_a.rects['a']?.x;
    const bX = before_a.rects['b']?.x;

    engine.cmd({ type: 'SWAP_LEAVES', idA: 'a', idB: 'b' });
    const after = engine.cmd({ type: 'GET_RECTS' });
    if (after.type !== 'RECTS') return;

    expect(after.rects['a']?.x).toBeCloseTo(bX ?? 0);
    expect(after.rects['b']?.x).toBeCloseTo(aX ?? 0);
  });

  it('returns ERROR when a leaf id is missing', () => {
    const res = engine.cmd({ type: 'SWAP_LEAVES', idA: 'a', idB: 'nope' });
    expect(res.type).toBe('ERROR');
  });
});

describe('GET_TREE', () => {
  it('returns a serialized layout', () => {
    const res = engine.cmd({ type: 'GET_TREE' });
    expect(res.type).toBe('TREE');
    if (res.type === 'TREE') {
      expect(res.layout?.version).toBe(LAYOUT_VERSION);
      expect(leaves(res.layout?.tree as Tree).sort()).toEqual(['a', 'b']);
    }
  });

  it('returns empty layout when no tree is set', () => {
    const fresh = new LayoutEngine(VIEWPORT);
    const res = fresh.cmd({ type: 'GET_TREE' });
    expect(res.type).toBe('TREE');
    if (res.type === 'TREE') {
      expect(res.layout).toBeNull();
    }
  });
});
