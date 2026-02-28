import { serializeTree, deserializeTree } from '../layout/serialization';
import type { Tree } from '../layout/tree';

/** localStorage key under which all workspace layouts are stored. */
export const STORAGE_KEY = 'twm-layouts';

type LayoutStore = Record<string, unknown>;

function _readStore(): LayoutStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as LayoutStore;
  } catch {
    return {};
  }
}

function _writeStore(store: LayoutStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded or storage unavailable — silently ignore
  }
}

/**
 * Persist the BSP tree for the given workspace name into localStorage.
 */
export function saveLayout(workspaceName: string, tree: Tree): void {
  const store = _readStore();
  store[workspaceName] = serializeTree(tree);
  _writeStore(store);
}

/**
 * Load the BSP tree for the given workspace name from localStorage.
 * Returns `null` if the workspace has never been saved or the data is corrupt.
 */
export function loadLayout(workspaceName: string): Tree | null {
  const store = _readStore();
  const entry = store[workspaceName];
  if (entry === undefined || entry === null) return null;
  try {
    return deserializeTree(entry);
  } catch {
    return null;
  }
}
