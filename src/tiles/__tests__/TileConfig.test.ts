import { describe, it, expect } from 'vitest';
import { makeTile, snap, TILE_DEFAULTS } from '../TileConfig';
import type { TileType } from '../TileConfig';

describe('TileConfig', () => {
  it('snap rounds to nearest 16px grid', () => {
    expect(snap(0)).toBe(0);
    expect(snap(7)).toBe(0);
    expect(snap(8)).toBe(16);
    expect(snap(20)).toBe(16);
    expect(snap(24)).toBe(32);
  });

  it('snap respects custom grid size', () => {
    expect(snap(10, 8)).toBe(8);
    expect(snap(12, 8)).toBe(16);
  });

  it('makeTile returns a tile with a unique id', () => {
    const a = makeTile('stripe-payments');
    const b = makeTile('stripe-payments');
    expect(a.id).toBeTruthy();
    expect(a.id).not.toBe(b.id);
  });

  it('makeTile uses TILE_DEFAULTS dimensions', () => {
    const tile = makeTile('stripe-payments');
    expect(tile.w).toBe(TILE_DEFAULTS['stripe-payments']!.w);
    expect(tile.h).toBe(TILE_DEFAULTS['stripe-payments']!.h);
  });

  it('makeTile applies overrides', () => {
    const tile = makeTile('rest', { x: 100, y: 200, title: 'Custom' });
    expect(tile.x).toBe(96); // snap(100) = Math.round(100/16)*16 = 6*16 = 96
    expect(tile.y).toBe(208); // snap(200) = Math.round(200/16)*16 = 13*16 = 208
    expect(tile.title).toBe('Custom');
  });

  it('makeTile sets type correctly', () => {
    const types: TileType[] = ['stripe-payments', 'stripe-products', 'rest', 'websocket'];
    for (const type of types) {
      expect(makeTile(type).type).toBe(type);
    }
  });
});
