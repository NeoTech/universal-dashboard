import { describe, it, expect, beforeEach } from 'vitest';
import { saveLayout, loadLayout, STORAGE_KEY } from '../workspace/persistence';
import { makeLeaf, makeSplit } from '../layout/tree';
import type { Tree } from '../layout/tree';

describe('workspace persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saveLayout serializes the tree to localStorage', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 's1');
    saveLayout('default', tree);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed['default']).toBeDefined();
  });

  it('loadLayout returns null when no layout is saved', () => {
    const result = loadLayout('default');
    expect(result).toBeNull();
  });

  it('loadLayout returns the previously saved tree', () => {
    const tree: Tree = makeSplit('v', 0.4, makeLeaf('x'), makeLeaf('y'), 'sv');
    saveLayout('my-workspace', tree);
    const result = loadLayout('my-workspace');
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('split');
    if (result!.kind === 'split') {
      expect(result!.dir).toBe('v');
      expect(result!.ratio).toBeCloseTo(0.4);
    }
  });

  it('can save and load multiple workspace names independently', () => {
    const treeA: Tree = makeLeaf('a');
    const treeB: Tree = makeLeaf('b');
    saveLayout('ws-a', treeA);
    saveLayout('ws-b', treeB);
    const a = loadLayout('ws-a');
    const b = loadLayout('ws-b');
    expect(a!.kind).toBe('leaf');
    expect(b!.kind).toBe('leaf');
    if (a!.kind === 'leaf') expect(a!.id).toBe('a');
    if (b!.kind === 'leaf') expect(b!.id).toBe('b');
  });

  it('loadLayout returns null for unknown workspace name', () => {
    const tree: Tree = makeLeaf('a');
    saveLayout('exists', tree);
    expect(loadLayout('does-not-exist')).toBeNull();
  });

  it('saveLayout overwrites previously saved layout for same workspace', () => {
    const treeOld: Tree = makeLeaf('old');
    const treeNew: Tree = makeLeaf('new');
    saveLayout('ws', treeOld);
    saveLayout('ws', treeNew);
    const result = loadLayout('ws');
    expect(result!.kind).toBe('leaf');
    if (result!.kind === 'leaf') expect(result!.id).toBe('new');
  });
});
