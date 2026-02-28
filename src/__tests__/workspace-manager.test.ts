import { describe, it, expect, beforeEach } from 'vitest';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { makeLeaf, makeSplit, leaves } from '../layout/tree';

describe('WorkspaceManager', () => {
  let wm: WorkspaceManager;

  beforeEach(() => {
    localStorage.clear();
    wm = new WorkspaceManager();
  });

  it('initializes with a default workspace', () => {
    expect(wm.activeWorkspace).toBe('default');
    expect(wm.workspaceNames()).toContain('default');
  });

  it('returns the active tree', () => {
    const tree = wm.activeTree();
    expect(tree).not.toBeNull();
    expect(tree!.kind).toBe('leaf');
  });

  it('creates a new workspace', () => {
    wm.create('work');
    expect(wm.workspaceNames()).toContain('work');
  });

  it('switches between workspaces', () => {
    wm.create('second');
    wm.switch('second');
    expect(wm.activeWorkspace).toBe('second');
  });

  it('preserves independent state per workspace', () => {
    // default workspace: leaf 'a'
    wm.setTree(makeLeaf('a'));
    // create new workspace, set leaf 'b'
    wm.create('other');
    wm.switch('other');
    wm.setTree(makeLeaf('b'));
    // switch back — default still has 'a'
    wm.switch('default');
    expect(leaves(wm.activeTree()!)).toEqual(['a']);
    wm.switch('other');
    expect(leaves(wm.activeTree()!)).toEqual(['b']);
  });

  it('removes a non-active workspace', () => {
    wm.create('temp');
    wm.remove('temp');
    expect(wm.workspaceNames()).not.toContain('temp');
  });

  it('throws when trying to remove the active workspace', () => {
    expect(() => wm.remove('default')).toThrow();
  });

  it('throws when switching to an unknown workspace', () => {
    expect(() => wm.switch('nope')).toThrow();
  });

  it('persists and restores workspaces via localStorage', () => {
    wm.setTree(makeSplit('h', 0.6, makeLeaf('p'), makeLeaf('q'), 'sp'));

    // New instance should load from localStorage
    const wm2 = new WorkspaceManager();
    const t = wm2.activeTree()!;
    expect(t.kind).toBe('split');
    if (t.kind === 'split') {
      expect(t.ratio).toBeCloseTo(0.6);
    }
  });
});
