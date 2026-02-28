import { describe, it, expect } from 'vitest';
import {
  presetSingle,
  presetSideBySide,
  presetTopBottom,
  presetThreeColumns,
  presetSidebar,
  PRESETS,
} from '../layout/presets';
import { leaves } from '../layout/tree';
import type { Tree, Split } from '../layout/tree';

describe('layout presets', () => {
  it('presetSingle returns a single leaf', () => {
    const t = presetSingle();
    expect(t.kind).toBe('leaf');
    expect(leaves(t)).toHaveLength(1);
  });

  it('presetSideBySide returns 2 leaves in a horizontal split', () => {
    const t = presetSideBySide();
    expect(t.kind).toBe('split');
    expect((t as Split).dir).toBe('h');
    expect(leaves(t)).toHaveLength(2);
  });

  it('presetTopBottom returns 2 leaves in a vertical split', () => {
    const t = presetTopBottom();
    expect(t.kind).toBe('split');
    expect((t as Split).dir).toBe('v');
    expect(leaves(t)).toHaveLength(2);
  });

  it('presetThreeColumns returns 3 leaves', () => {
    const t = presetThreeColumns();
    expect(leaves(t)).toHaveLength(3);
  });

  it('presetSidebar returns 3 leaves', () => {
    const t = presetSidebar();
    expect(leaves(t)).toHaveLength(3);
  });

  it('PRESETS registry has all expected keys', () => {
    expect(Object.keys(PRESETS).sort()).toEqual(
      ['sideBySide', 'sidebar', 'single', 'threeColumns', 'topBottom'].sort()
    );
  });

  it('PRESETS entries return valid trees when called', () => {
    for (const [, factory] of Object.entries(PRESETS)) {
      const t: Tree = factory();
      expect(t.kind).toMatch(/^(leaf|split)$/);
      expect(leaves(t).length).toBeGreaterThan(0);
    }
  });
});
