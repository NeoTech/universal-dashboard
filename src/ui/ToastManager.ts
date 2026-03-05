/** Visual severity level of a {@link Toast} notification. */
export type ToastType = 'info' | 'success' | 'warning' | 'error';

/** A single toast notification entry managed by {@link ToastManager}. */
export interface Toast {
  /** Unique identifier assigned by {@link ToastManager.show}. */
  id: string;
  /** Human-readable notification text. */
  message: string;
  /** Visual severity level. */
  type: ToastType;
  /** Duration in ms. 0 = sticky (never auto-dismisses). Default: 4000 */
  duration: number;
}

/** Options accepted by {@link ToastManager.show}. */
interface ShowOptions {
  message: string;
  type: ToastType;
  duration?: number;
}

const DEFAULT_DURATION = 4000;
let _seq = 0;

/**
 * Manages application toast notifications.
 * Toasts auto-dismiss after `duration` ms unless `duration` is 0 (sticky).
 */
export class ToastManager {
  private _toasts: Toast[] = [];
  private _timers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private _listeners: (() => void)[] = [];

  /**
   * Returns the current immutable snapshot of active toasts.
   *
   * @returns Read-only array of {@link Toast} objects.
   */
  toasts(): readonly Toast[] {
    return this._toasts;
  }

  /**
   * Enqueue a new toast notification.
   *
   * If `duration` is greater than 0 a timer is started that will automatically
   * call {@link dismiss} when it fires.
   *
   * @param options - Message, type, and optional duration.
   * @returns The unique `id` of the new toast.
   */
  show(options: ShowOptions): string {
    const id = `toast-${++_seq}`;
    const duration = options.duration ?? DEFAULT_DURATION;
    const toast: Toast = { id, message: options.message, type: options.type, duration };

    this._toasts = [...this._toasts, toast];
    this._notify();

    if (duration > 0) {
      const timer = setTimeout(() => this.dismiss(id), duration);
      this._timers.set(id, timer);
    }

    return id;
  }

  /**
   * Remove a toast by id and cancel its auto-dismiss timer.
   *
   * No-ops silently if the toast does not exist.
   *
   * @param id - The toast `id` returned by {@link show}.
   */
  dismiss(id: string): void {
    const timer = this._timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this._timers.delete(id);
    }
    const prev = this._toasts;
    this._toasts = this._toasts.filter(t => t.id !== id);
    if (this._toasts.length !== prev.length) this._notify();
  }

  /**
   * Subscribe to toast list changes.
   *
   * The callback is invoked whenever a toast is added or removed.
   *
   * @param cb - Listener invoked on every change.
   * @returns An unsubscribe function that removes the listener.
   */
  onChange(cb: () => void): () => void {
    this._listeners.push(cb);
    return () => {
      this._listeners = this._listeners.filter(fn => fn !== cb);
    };
  }

  private _notify(): void {
    for (const cb of this._listeners) cb();
  }
}
