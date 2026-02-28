import { describe, it, expect } from 'vitest';
import { HistoryManager } from '../workspace/HistoryManager';
import { makeLeaf, makeSplit } from '../layout/tree';
import type { Tree } from '../layout/tree';

describe('HistoryManager', () => {
  it('starts with no undo/redo', () => {
    const h = new HistoryManager<Tree>(makeLeaf('a'));
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it('returns current state', () => {
    const leaf = makeLeaf('a');
    const h = new HistoryManager<Tree>(leaf);
    expect(h.current).toBe(leaf);
  });

  it('can undo after a push', () => {
    const h = new HistoryManager<Tree>(makeLeaf('a'));
    h.push(makeLeaf('b'));
    expect(h.canUndo).toBe(true);
  });

  it('undo returns the previous state', () => {
    const a = makeLeaf('a');
    const b = makeLeaf('b');
    const h = new HistoryManager<Tree>(a);
    h.push(b);
    const prev = h.undo();
    expect(prev).toBe(a);
    expect(h.current).toBe(a);
  });

  it('redo returns to the next state after undo', () => {
    const a = makeLeaf('a');
    const b = makeLeaf('b');
    const h = new HistoryManager<Tree>(a);
    h.push(b);
    h.undo();
    const next = h.redo();
    expect(next).toBe(b);
    expect(h.current).toBe(b);
  });

  it('push clears redo stack', () => {
    const h = new HistoryManager<Tree>(makeLeaf('a'));
    h.push(makeLeaf('b'));
    h.undo();
    h.push(makeLeaf('c')); // new branch
    expect(h.canRedo).toBe(false);
  });

  it('undo returns null when at the beginning', () => {
    const h = new HistoryManager<Tree>(makeLeaf('a'));
    expect(h.undo()).toBeNull();
  });

  it('redo returns null when at the end', () => {
    const h = new HistoryManager<Tree>(makeLeaf('a'));
    h.push(makeLeaf('b'));
    expect(h.redo()).toBeNull();
  });

  it('respects maxSize by dropping oldest history', () => {
    const h = new HistoryManager<Tree>(makeLeaf('start'), { maxSize: 3 });
    h.push(makeLeaf('1'));
    h.push(makeLeaf('2'));
    h.push(makeLeaf('3')); // drops 'start' from past
    h.push(makeLeaf('4')); // drops '1' from past
    // Can undo 3 times (3, 2, 1 — but maxSize=3 means 3 past entries)
    let count = 0;
    while (h.canUndo) { h.undo(); count++; }
    expect(count).toBeLessThanOrEqual(3);
  });

  it('works with a complex tree push sequence', () => {
    const initial = makeLeaf('root');
    const split1 = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'), 'sp');
    const h = new HistoryManager<Tree>(initial);
    h.push(split1);
    expect(h.current.kind).toBe('split');
    h.undo();
    expect(h.current.kind).toBe('leaf');
    h.redo();
    expect(h.current.kind).toBe('split');
  });
});
