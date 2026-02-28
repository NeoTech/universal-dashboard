import { describe, it, expect, beforeEach } from 'vitest';
import { LayoutEngine } from '../layout/engine';
import { makeLeaf, makeSplit } from '../layout/tree';
import type { Tree } from '../layout/tree';

let engine: LayoutEngine;

beforeEach(() => {
  engine = new LayoutEngine({ w: 1000, h: 600 });
});

describe('LayoutEngine constructor', () => {
  it('starts with no tree', () => {
    const res = engine.cmd({ type: 'GET_RECTS' });
    expect(res.type).toBe('RECTS');
    if (res.type === 'RECTS') expect(res.rects).toEqual({});
  });
});

describe('SET_VIEWPORT', () => {
  it('updates the viewport and returns ACK', () => {
    const res = engine.cmd({ type: 'SET_VIEWPORT', w: 800, h: 400 });
    expect(res.type).toBe('ACK');
  });

  it('recomputes rects after viewport change', () => {
    const tree: Tree = makeLeaf('a');
    engine.cmd({ type: 'SET_TREE', tree });
    engine.cmd({ type: 'SET_VIEWPORT', w: 800, h: 400 });
    const res = engine.cmd({ type: 'GET_RECTS' });
    if (res.type === 'RECTS') {
      expect(res.rects['a']?.w).toBeCloseTo(800);
      expect(res.rects['a']?.h).toBeCloseTo(400);
    }
  });
});

describe('SET_TREE', () => {
  it('accepts a single leaf and computes rects', () => {
    const tree: Tree = makeLeaf('root');
    const res = engine.cmd({ type: 'SET_TREE', tree });
    expect(res.type).toBe('RECTS');
    if (res.type === 'RECTS') {
      expect(res.rects['root']).toEqual({ x: 0, y: 0, w: 1000, h: 600 });
    }
  });

  it('computes rects for a horizontal split', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    const res = engine.cmd({ type: 'SET_TREE', tree });
    if (res.type === 'RECTS') {
      expect(res.rects['a']?.w).toBeCloseTo(500);
      expect(res.rects['b']?.w).toBeCloseTo(500);
      expect(res.rects['b']?.x).toBeCloseTo(500);
    }
  });

  it('computes rects for a vertical split', () => {
    const tree: Tree = makeSplit('v', 0.6, makeLeaf('top'), makeLeaf('bot'));
    const res = engine.cmd({ type: 'SET_TREE', tree });
    if (res.type === 'RECTS') {
      expect(res.rects['top']?.h).toBeCloseTo(360);
      expect(res.rects['bot']?.h).toBeCloseTo(240);
    }
  });
});

describe('GET_RECTS', () => {
  it('returns all panel rects for the current tree', () => {
    const tree: Tree = makeSplit('h', 0.5, makeLeaf('a'), makeLeaf('b'));
    engine.cmd({ type: 'SET_TREE', tree });
    const res = engine.cmd({ type: 'GET_RECTS' });
    if (res.type === 'RECTS') {
      expect(Object.keys(res.rects)).toHaveLength(2);
    }
  });
});

describe('PING', () => {
  it('returns PONG', () => {
    const res = engine.cmd({ type: 'PING' });
    expect(res.type).toBe('PONG');
  });
});
