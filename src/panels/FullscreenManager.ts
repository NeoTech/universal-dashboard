type ChangeCallback = (panelId: string | null) => void;

/**
 * Tracks and manages the fullscreen (maximized) panel state.
 * Only one panel can be fullscreen at a time.
 */
export class FullscreenManager {
  private _current: string | null = null;
  private _listeners: ChangeCallback[] = [];

  // ── Queries ──────────────────────────────────────────────────────────────────

  fullscreenId(): string | null {
    return this._current;
  }

  isFullscreen(panelId: string): boolean {
    return this._current === panelId;
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  maximize(panelId: string): void {
    this._current = panelId;
    this._notify(panelId);
  }

  restore(): void {
    this._current = null;
    this._notify(null);
  }

  toggle(panelId: string): void {
    if (this._current === panelId) {
      this.restore();
    } else {
      this.maximize(panelId);
    }
  }

  // ── Listeners ────────────────────────────────────────────────────────────────

  onChange(cb: ChangeCallback): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== cb);
    };
  }

  private _notify(id: string | null): void {
    for (const cb of this._listeners) cb(id);
  }
}
