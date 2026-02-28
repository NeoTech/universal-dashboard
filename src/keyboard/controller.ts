import { insertLeaf, removeLeaf, findLeaf, leaves } from '../layout/tree';
import type { Tree, Rect, Direction } from '../layout/tree';

export type NavDir = 'left' | 'right' | 'up' | 'down';

export class KeyboardController {
  readonly tree: Tree;
  readonly focusedId: string;

  constructor(
    tree: Tree,
    _rects: Record<string, Rect>,
    focusedId: string,
    _viewport: Rect,
  ) {
    this.tree = tree;
    this.focusedId = focusedId;
  }

  // ── Focus navigation (tree-based) ──────────────────────────────────────────

  /**
   * Return the id of the panel to focus when moving in `dir`.
   * Falls back to `focusedId` when there is no neighbor.
   */
  focusDir(dir: NavDir): string {
    const next = _navigate(this.tree, this.focusedId, dir);
    return next ?? this.focusedId;
  }

  // ── Mutations ───────────────────────────────────────────────────────────────

  /** Split the focused panel along `dir`, returning updated tree + new panel id. */
  split(dir: Direction): { tree: Tree; newId: string } {
    const newId = crypto.randomUUID ? crypto.randomUUID() : `panel-${Date.now()}`;
    const next = insertLeaf(this.tree, this.focusedId, dir, newId);
    return { tree: next, newId };
  }

  /**
   * Close the focused panel. Returns updated tree + the panel id to focus next.
   * Returns null when removing the last panel.
   */
  close(): { tree: Tree; focusId: string } | null {
    const leaf = findLeaf(this.tree, this.focusedId);
    if (!leaf) return null;

    const allBefore = leaves(this.tree);
    const next = removeLeaf(this.tree, this.focusedId);

    if (next === null) return null; // last panel

    // Pick the sibling (or first remaining panel) as the new focus
    const allAfter = leaves(next);
    const idx = allBefore.indexOf(this.focusedId);
    const nextFocus =
      allAfter[idx] ?? // same position if exists
      allAfter[idx - 1] ?? // previous if at end
      allAfter[0]; // first

    return { tree: next, focusId: nextFocus };
  }
}

// ── Tree-based directional navigation ────────────────────────────────────────

/**
 * Traverse the BSP tree to find the next panel id in `dir`.
 * Returns null when the focused panel is already at the edge.
 */
function _navigate(tree: Tree, targetId: string, dir: NavDir): string | null {
  if (tree.kind === 'leaf') return null;

  const inFirst = findLeaf(tree.first, targetId) !== null;
  const inSecond = findLeaf(tree.second, targetId) !== null;

  if (!inFirst && !inSecond) return null;

  const forwardDir: NavDir = tree.dir === 'h' ? 'right' : 'down';
  const backwardDir: NavDir = tree.dir === 'h' ? 'left' : 'up';

  if (inFirst && dir === forwardDir) {
    // Cross the split boundary: enter the front of second child
    return _entryLeaf(tree.second, dir);
  }
  if (inSecond && dir === backwardDir) {
    // Cross the split boundary: enter the back of first child
    return _entryLeaf(tree.first, dir);
  }

  // The split dir doesn't match — recurse into the subtree containing the target
  return _navigate(inFirst ? tree.first : tree.second, targetId, dir);
}

/**
 * Enter a subtree when moving in direction `dir`.
 * Moving right/down → take `first` children (natural order).
 * Moving left/up → take `second` children (reverse order).
 */
function _entryLeaf(tree: Tree, dir: NavDir): string {
  if (tree.kind === 'leaf') return tree.id;
  if (dir === 'right' || dir === 'down') return _entryLeaf(tree.first, dir);
  return _entryLeaf(tree.second, dir);
}
