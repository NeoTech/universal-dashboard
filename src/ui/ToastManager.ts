export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Duration in ms. 0 = sticky (never auto-dismisses). Default: 4000 */
  duration: number;
}

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

  toasts(): readonly Toast[] {
    return this._toasts;
  }

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
