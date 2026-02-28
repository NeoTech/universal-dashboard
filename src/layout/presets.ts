import { makeLeaf, makeSplit } from './tree';
import type { Tree } from './tree';

// ── Preset factories ──────────────────────────────────────────────────────────

/** A single panel filling the entire workspace. */
export function presetSingle(): Tree {
  return makeLeaf();
}

/** Two panels side-by-side (horizontal split). */
export function presetSideBySide(): Tree {
  return makeSplit('h', 0.5, makeLeaf(), makeLeaf());
}

/** Two panels stacked top and bottom (vertical split). */
export function presetTopBottom(): Tree {
  return makeSplit('v', 0.5, makeLeaf(), makeLeaf());
}

/**
 * Three equal columns arranged horizontally.
 * Structure: h-split(h-split(a, b), c)
 */
export function presetThreeColumns(): Tree {
  return makeSplit(
    'h',
    0.667,
    makeSplit('h', 0.5, makeLeaf(), makeLeaf()),
    makeLeaf(),
  );
}

/**
 * Sidebar layout: narrow sidebar on the left, two stacked panels on the right.
 * Structure: h-split(sidebar, v-split(top, bottom))
 */
export function presetSidebar(): Tree {
  return makeSplit(
    'h',
    0.25,
    makeLeaf(),
    makeSplit('v', 0.5, makeLeaf(), makeLeaf()),
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

/** Named preset factories for use in the command palette or UI. */
export const PRESETS: Record<string, () => Tree> = {
  single: presetSingle,
  sideBySide: presetSideBySide,
  topBottom: presetTopBottom,
  threeColumns: presetThreeColumns,
  sidebar: presetSidebar,
};
