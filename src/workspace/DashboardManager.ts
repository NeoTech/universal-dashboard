/**
 * Manages up to MAX_DASHBOARDS independent dashboard slots.
 *
 * Each slot has a stable string ID that is used by DashboardPanel as its
 * persistence key.  The active index + all IDs are persisted to localStorage
 * so they survive page reloads.
 */

const STORAGE_KEY = 'twm:multi-dash';
export const MAX_DASHBOARDS = 4;

interface PersistedState {
  ids: string[];
  activeIndex: number;
}

export class DashboardManager {
  private _ids: string[];
  private _activeIndex: number;

  constructor() {
    const saved = _load();
    this._ids = saved.ids.length > 0 ? saved.ids : ['dashboard-1'];
    // Clamp in case persisted index is out of range after a delete
    this._activeIndex = Math.min(saved.activeIndex, this._ids.length - 1);
    this._save();
  }

  // ── Queries ────────────────────────────────────────────────────────────────

  /** Immutable snapshot of all dashboard IDs. */
  get ids(): string[] {
    return [...this._ids];
  }

  /** Number of dashboards currently open (1–MAX_DASHBOARDS). */
  get count(): number {
    return this._ids.length;
  }

  /** Zero-based index of the currently visible dashboard. */
  get activeIndex(): number {
    return this._activeIndex;
  }

  /** ID of the currently visible dashboard. */
  get activeDashboardId(): string {
    return this._ids[this._activeIndex];
  }

  /** Whether another dashboard can be created. */
  get canAdd(): boolean {
    return this._ids.length < MAX_DASHBOARDS;
  }

  /** Whether the current dashboard can be closed (need at least 1). */
  get canRemove(): boolean {
    return this._ids.length > 1;
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  /** Switch to dashboard at `index`. No-op if index is out of range. */
  goto(index: number): void {
    if (index < 0 || index >= this._ids.length) return;
    this._activeIndex = index;
    this._save();
  }

  /** Switch to the next dashboard, wrapping around. */
  next(): void {
    this.goto((this._activeIndex + 1) % this._ids.length);
  }

  /** Switch to the previous dashboard, wrapping around. */
  prev(): void {
    this.goto((this._activeIndex - 1 + this._ids.length) % this._ids.length);
  }

  /**
   * Add a new dashboard and switch to it.
   * Returns the new dashboard ID, or `null` if the limit is reached.
   */
  add(): string | null {
    if (!this.canAdd) return null;
    const id = `dashboard-${Date.now()}`;
    this._ids.push(id);
    this._activeIndex = this._ids.length - 1;
    this._save();
    return id;
  }

  /**
   * Remove the dashboard at `index` (defaults to the active one).
   * No-op when only one dashboard remains.
   */
  remove(index?: number): void {
    const idx = index ?? this._activeIndex;
    if (this._ids.length <= 1) return;
    this._ids.splice(idx, 1);
    this._activeIndex = Math.min(this._activeIndex, this._ids.length - 1);
    this._save();
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private _save(): void {
    try {
      const state: PersistedState = {
        ids: this._ids,
        activeIndex: this._activeIndex,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable — silently ignore
    }
  }
}

function _load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedState;
      if (Array.isArray(parsed.ids) && parsed.ids.length > 0) return parsed;
    }
  } catch {
    // malformed — fall through to defaults
  }
  return { ids: [], activeIndex: 0 };
}
