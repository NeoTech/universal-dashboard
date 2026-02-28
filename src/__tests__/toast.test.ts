import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToastManager } from '../ui/ToastManager';

describe('ToastManager', () => {
  let mgr: ToastManager;

  beforeEach(() => {
    vi.useFakeTimers();
    mgr = new ToastManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no toasts', () => {
    expect(mgr.toasts()).toHaveLength(0);
  });

  it('show() adds a toast', () => {
    mgr.show({ message: 'Hello!', type: 'info' });
    expect(mgr.toasts()).toHaveLength(1);
    expect(mgr.toasts()[0].message).toBe('Hello!');
  });

  it('show() assigns a unique id', () => {
    mgr.show({ message: 'A', type: 'info' });
    mgr.show({ message: 'B', type: 'info' });
    const ids = mgr.toasts().map(t => t.id);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('dismiss() removes a toast by id', () => {
    mgr.show({ message: 'Hi', type: 'success' });
    const id = mgr.toasts()[0].id;
    mgr.dismiss(id);
    expect(mgr.toasts()).toHaveLength(0);
  });

  it('auto-dismisses after duration ms', () => {
    mgr.show({ message: 'bye', type: 'info', duration: 3000 });
    expect(mgr.toasts()).toHaveLength(1);
    vi.advanceTimersByTime(3001);
    expect(mgr.toasts()).toHaveLength(0);
  });

  it('does not auto-dismiss when duration=0', () => {
    mgr.show({ message: 'sticky', type: 'error', duration: 0 });
    vi.advanceTimersByTime(60_000);
    expect(mgr.toasts()).toHaveLength(1);
  });

  it('supports all toast types', () => {
    for (const type of ['info', 'success', 'warning', 'error'] as const) {
      mgr.show({ message: type, type });
    }
    expect(mgr.toasts()).toHaveLength(4);
  });

  it('calls onChange when toasts change', () => {
    const cb = vi.fn();
    mgr.onChange(cb);
    mgr.show({ message: 'test', type: 'info' });
    expect(cb).toHaveBeenCalled();
  });
});
