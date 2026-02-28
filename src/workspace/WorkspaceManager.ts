import { makeLeaf } from '../layout/tree';
import type { Tree } from '../layout/tree';
import { saveLayout, loadLayout } from './persistence';

const DEFAULT_WORKSPACE = 'default';
const NAMES_KEY = 'twm-workspace-names';
const ACTIVE_KEY = 'twm-active-workspace';

/**
 * Manages multiple named workspaces, each backed by an independent BSP tree.
 * State is persisted to localStorage on every mutation.
 */
export class WorkspaceManager {
  private _workspaces: Map<string, Tree>;
  activeWorkspace: string;

  constructor() {
    // Restore workspace names from localStorage
    const storedNames = _readNames();
    const storedActive = localStorage.getItem(ACTIVE_KEY) ?? DEFAULT_WORKSPACE;

    const names = storedNames.length > 0 ? storedNames : [DEFAULT_WORKSPACE];

    this._workspaces = new Map<string, Tree>();
    for (const name of names) {
      const tree = loadLayout(name) ?? makeLeaf();
      this._workspaces.set(name, tree);
    }

    this.activeWorkspace =
      this._workspaces.has(storedActive) ? storedActive : names[0];
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  workspaceNames(): string[] {
    return Array.from(this._workspaces.keys());
  }

  activeTree(): Tree | null {
    return this._workspaces.get(this.activeWorkspace) ?? null;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  /** Replace the active workspace's tree (persists immediately). */
  setTree(tree: Tree): void {
    this._workspaces.set(this.activeWorkspace, tree);
    saveLayout(this.activeWorkspace, tree);
  }

  /** Create a new workspace with a single empty panel. */
  create(name: string): void {
    if (this._workspaces.has(name)) return;
    const tree = loadLayout(name) ?? makeLeaf();
    this._workspaces.set(name, tree);
    _writeNames(this.workspaceNames());
    saveLayout(name, tree);
  }

  /** Switch to an existing workspace by name. */
  switch(name: string): void {
    if (!this._workspaces.has(name)) {
      throw new Error(`Workspace "${name}" does not exist`);
    }
    this.activeWorkspace = name;
    localStorage.setItem(ACTIVE_KEY, name);
  }

  /** Remove a non-active workspace. Throws if attempting to remove the active one. */
  remove(name: string): void {
    if (name === this.activeWorkspace) {
      throw new Error(`Cannot remove the active workspace "${name}"`);
    }
    this._workspaces.delete(name);
    _writeNames(this.workspaceNames());
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _readNames(): string[] {
  try {
    const raw = localStorage.getItem(NAMES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

function _writeNames(names: string[]): void {
  try {
    localStorage.setItem(NAMES_KEY, JSON.stringify(names));
  } catch {
    // Storage unavailable — silently ignore
  }
}
