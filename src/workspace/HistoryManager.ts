interface Options {
  maxSize?: number;
}

const DEFAULT_MAX_SIZE = 50;

/**
 * Generic undo/redo history manager.
 *
 * Maintains a past stack and a future stack. Each `push()` records the current
 * state as undoable and clears the redo stack (linear history model).
 */
export class HistoryManager<T> {
  private _past: T[] = [];
  private _current: T;
  private _future: T[] = [];
  private _maxSize: number;

  constructor(initialState: T, options: Options = {}) {
    this._current = initialState;
    this._maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  get current(): T {
    return this._current;
  }

  get canUndo(): boolean {
    return this._past.length > 0;
  }

  get canRedo(): boolean {
    return this._future.length > 0;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  /**
   * Push a new state. The current state moves to the past stack;
   * the redo (future) stack is cleared.
   */
  push(nextState: T): void {
    this._past.push(this._current);
    // Trim oldest history when max size exceeded
    if (this._past.length > this._maxSize) {
      this._past.shift();
    }
    this._current = nextState;
    this._future = [];
  }

  /**
   * Undo: move current state to future, restore most recent past state.
   * Returns the restored state, or `null` if there is nothing to undo.
   */
  undo(): T | null {
    if (this._past.length === 0) return null;
    this._future.unshift(this._current);
    this._current = this._past.pop()!;
    return this._current;
  }

  /**
   * Redo: move current state to past, restore most recent future state.
   * Returns the restored state, or `null` if there is nothing to redo.
   */
  redo(): T | null {
    if (this._future.length === 0) return null;
    this._past.push(this._current);
    this._current = this._future.shift()!;
    return this._current;
  }
}
