// ── Types ─────────────────────────────────────────────────────────────────────

/** Split direction: 'h' = side-by-side, 'v' = top-and-bottom */
export type Direction = 'h' | 'v';

export interface Leaf {
  readonly kind: 'leaf';
  readonly id: string;
}

export interface Split {
  readonly kind: 'split';
  readonly id: string;
  readonly dir: Direction;
  /** Fraction of the total space given to `first` (0 < ratio < 1) */
  readonly ratio: number;
  readonly first: Tree;
  readonly second: Tree;
}

export type Tree = Leaf | Split;

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface HandleInfo {
  readonly splitId: string;
  readonly dir: Direction;
  readonly rect: Rect;
  /** The full rect of the split container — used to compute new ratio on drag. */
  readonly containerRect: Rect;
}

// ── ID generator ──────────────────────────────────────────────────────────────

let _seq = 0;
function nextId(): string {
  // Use crypto.randomUUID if available (browser / node 19+ / bun), else fallback
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `panel-${++_seq}`;
}

// ── Constructors ──────────────────────────────────────────────────────────────

export function makeLeaf(id: string = nextId()): Leaf {
  return { kind: 'leaf', id };
}

export function makeSplit(
  dir: Direction,
  ratio: number,
  first: Tree,
  second: Tree,
  id: string = nextId(),
): Split {
  if (ratio <= 0 || ratio >= 1) throw new RangeError(`ratio must be in (0,1), got ${ratio}`);
  return { kind: 'split', id, dir, ratio, first, second };
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Collect all leaf ids in depth-first order. */
export function leaves(tree: Tree): string[] {
  if (tree.kind === 'leaf') return [tree.id];
  return [...leaves(tree.first), ...leaves(tree.second)];
}

/** Find a leaf by id; returns null if not found. */
export function findLeaf(tree: Tree, id: string): Leaf | null {
  if (tree.kind === 'leaf') return tree.id === id ? tree : null;
  return findLeaf(tree.first, id) ?? findLeaf(tree.second, id);
}

// ── Mutations (return new tree, fully immutable) ──────────────────────────────

/**
 * Insert a new leaf adjacent to the leaf with `targetId`.
 * The target leaf becomes `first`, the new leaf `second`, split along `dir`.
 */
export function insertLeaf(tree: Tree, targetId: string, dir: Direction, newId?: string): Tree {
  if (tree.kind === 'leaf') {
    if (tree.id !== targetId) throw new Error(`Target leaf "${targetId}" not found`);
    return makeSplit(dir, 0.5, tree, makeLeaf(newId));
  }

  // Try left branch first
  if (findLeaf(tree.first, targetId)) {
    return { ...tree, first: insertLeaf(tree.first, targetId, dir, newId) };
  }
  if (findLeaf(tree.second, targetId)) {
    return { ...tree, second: insertLeaf(tree.second, targetId, dir, newId) };
  }
  throw new Error(`Target leaf "${targetId}" not found`);
}

/**
 * Remove a leaf by id. When a split loses a child the sibling is promoted.
 * Returns null if the tree becomes empty (single root leaf removed).
 */
export function removeLeaf(tree: Tree, id: string): Tree | null {
  if (tree.kind === 'leaf') {
    return tree.id === id ? null : null; // not found → also return null
  }

  // Is the target in the first child?
  if (findLeaf(tree.first, id)) {
    const newFirst = removeLeaf(tree.first, id);
    if (newFirst === null) return tree.second; // promote sibling
    return { ...tree, first: newFirst };
  }

  // Is the target in the second child?
  if (findLeaf(tree.second, id)) {
    const newSecond = removeLeaf(tree.second, id);
    if (newSecond === null) return tree.first; // promote sibling
    return { ...tree, second: newSecond };
  }

  return null; // id not found in this subtree
}

/**
 * Update the ratio of a split node by its id.
 * Throws if the split id is not found or if the ratio is out of bounds.
 */
export function setRatio(tree: Tree, splitId: string, ratio: number): Tree {
  if (ratio <= 0 || ratio >= 1) throw new RangeError(`ratio must be in (0,1), got ${ratio}`);
  if (tree.kind === 'leaf') throw new Error(`Split "${splitId}" not found`);
  if (tree.id === splitId) return { ...tree, ratio };
  if (_containsSplit(tree.first, splitId)) {
    return { ...tree, first: setRatio(tree.first, splitId, ratio) };
  }
  if (_containsSplit(tree.second, splitId)) {
    return { ...tree, second: setRatio(tree.second, splitId, ratio) };
  }
  throw new Error(`Split "${splitId}" not found`);
}

function _containsSplit(tree: Tree, id: string): boolean {
  if (tree.kind === 'leaf') return false;
  if (tree.id === id) return true;
  return _containsSplit(tree.first, id) || _containsSplit(tree.second, id);
}

/** Replace every leaf with `oldId` with `replacement` (immutably). */
function _replaceLeaf(tree: Tree, oldId: string, replacement: Leaf): Tree {
  if (tree.kind === 'leaf') return tree.id === oldId ? replacement : tree;
  return {
    ...tree,
    first: _replaceLeaf(tree.first, oldId, replacement),
    second: _replaceLeaf(tree.second, oldId, replacement),
  };
}

/**
 * Swap two leaves by id. Their positions in the tree are exchanged.
 * Throws if either id is not found.
 */
export function swapLeaves(tree: Tree, idA: string, idB: string): Tree {
  if (idA === idB) return tree; // no-op
  const leafA = findLeaf(tree, idA);
  const leafB = findLeaf(tree, idB);
  if (!leafA) throw new Error(`Leaf "${idA}" not found`);
  if (!leafB) throw new Error(`Leaf "${idB}" not found`);
  // Swap: replace A with a placeholder first to avoid collision, then B→A, placeholder→B
  const PLACEHOLDER = '__swap__';
  let next: Tree = _replaceLeaf(tree, idA, makeLeaf(PLACEHOLDER));
  next = _replaceLeaf(next, idB, leafA);
  next = _replaceLeaf(next, PLACEHOLDER, leafB);
  return next;
}

// ── Layout ────────────────────────────────────────────────────────────────────

/**
 * Compute a Rect for every leaf by recursively subdividing the root rect.
 * Returns a Map<leafId, Rect>.
 */
export function computeRects(tree: Tree, rect: Rect): Map<string, Rect> {
  const map = new Map<string, Rect>();
  _fillRects(tree, rect, map);
  return map;
}

function _fillRects(tree: Tree, rect: Rect, out: Map<string, Rect>): void {
  if (tree.kind === 'leaf') {
    out.set(tree.id, rect);
    return;
  }

  const { dir, ratio, first, second } = tree;
  let firstRect: Rect;
  let secondRect: Rect;

  if (dir === 'h') {
    const split = rect.w * ratio;
    firstRect = { x: rect.x, y: rect.y, w: split, h: rect.h };
    secondRect = { x: rect.x + split, y: rect.y, w: rect.w - split, h: rect.h };
  } else {
    const split = rect.h * ratio;
    firstRect = { x: rect.x, y: rect.y, w: rect.w, h: split };
    secondRect = { x: rect.x, y: rect.y + split, w: rect.w, h: rect.h - split };
  }

  _fillRects(first, firstRect, out);
  _fillRects(second, secondRect, out);
}

// ── Handle positions ──────────────────────────────────────────────────────────

const HANDLE_PX = 4; // matches --twm-gap-handle

/**
 * Compute drag-handle rects for every split node in the tree.
 * Handles are centered on the boundary between the two children.
 */
export function computeHandles(tree: Tree, rootRect: Rect): HandleInfo[] {
  const handles: HandleInfo[] = [];
  _fillHandles(tree, rootRect, handles);
  return handles;
}

function _fillHandles(tree: Tree, rect: Rect, out: HandleInfo[]): void {
  if (tree.kind === 'leaf') return;

  const { dir, ratio, first, second, id } = tree;
  let handleRect: Rect;
  let firstRect: Rect;
  let secondRect: Rect;

  if (dir === 'h') {
    const splitX = rect.x + rect.w * ratio;
    handleRect = { x: splitX - HANDLE_PX / 2, y: rect.y, w: HANDLE_PX, h: rect.h };
    firstRect = { x: rect.x, y: rect.y, w: rect.w * ratio, h: rect.h };
    secondRect = { x: rect.x + rect.w * ratio, y: rect.y, w: rect.w * (1 - ratio), h: rect.h };
  } else {
    const splitY = rect.y + rect.h * ratio;
    handleRect = { x: rect.x, y: splitY - HANDLE_PX / 2, w: rect.w, h: HANDLE_PX };
    firstRect = { x: rect.x, y: rect.y, w: rect.w, h: rect.h * ratio };
    secondRect = {
      x: rect.x,
      y: rect.y + rect.h * ratio,
      w: rect.w,
      h: rect.h * (1 - ratio),
    };
  }

  out.push({ splitId: id, dir, rect: handleRect, containerRect: rect });
  _fillHandles(first, firstRect, out);
  _fillHandles(second, secondRect, out);
}
