type LifecycleCallback = (panelId: string) => void;

/**
 * Tracks panel mount/unmount lifecycle events.
 * Call `mount(id)` when a panel is added to the DOM and `unmount(id)` when removed.
 * Register listeners with `onMount` / `onUnmount`; both return an `off()` function.
 */
export class PanelLifecycleManager {
  private _mounted: Set<string> = new Set();
  private _mountListeners: LifecycleCallback[] = [];
  private _unmountListeners: LifecycleCallback[] = [];

  // ── Mutations ────────────────────────────────────────────────────────────────

  mount(panelId: string): void {
    this._mounted.add(panelId);
    for (const cb of this._mountListeners) cb(panelId);
  }

  unmount(panelId: string): void {
    if (!this._mounted.has(panelId)) return;
    this._mounted.delete(panelId);
    for (const cb of this._unmountListeners) cb(panelId);
  }

  // ── Queries ──────────────────────────────────────────────────────────────────

  isMounted(panelId: string): boolean {
    return this._mounted.has(panelId);
  }

  mountedIds(): string[] {
    return Array.from(this._mounted);
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  /** Register a callback for the mount event. Returns an `off()` disposer. */
  onMount(cb: LifecycleCallback): () => void {
    this._mountListeners.push(cb);
    return () => {
      this._mountListeners = this._mountListeners.filter(fn => fn !== cb);
    };
  }

  /** Register a callback for the unmount event. Returns an `off()` disposer. */
  onUnmount(cb: LifecycleCallback): () => void {
    this._unmountListeners.push(cb);
    return () => {
      this._unmountListeners = this._unmountListeners.filter(fn => fn !== cb);
    };
  }
}
