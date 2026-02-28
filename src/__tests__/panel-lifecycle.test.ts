import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PanelLifecycleManager } from '../panels/PanelLifecycleManager';

describe('PanelLifecycleManager', () => {
  let mgr: PanelLifecycleManager;

  beforeEach(() => {
    mgr = new PanelLifecycleManager();
  });

  it('tracks mounted panels', () => {
    mgr.mount('p1');
    expect(mgr.isMounted('p1')).toBe(true);
    expect(mgr.isMounted('p2')).toBe(false);
  });

  it('tracks unmounted panels', () => {
    mgr.mount('p1');
    mgr.unmount('p1');
    expect(mgr.isMounted('p1')).toBe(false);
  });

  it('returns list of mounted panel ids', () => {
    mgr.mount('a');
    mgr.mount('b');
    mgr.mount('c');
    expect(mgr.mountedIds().sort()).toEqual(['a', 'b', 'c']);
  });

  it('calls onMount callback when panel mounts', () => {
    const handler = vi.fn();
    mgr.onMount(handler);
    mgr.mount('x');
    expect(handler).toHaveBeenCalledWith('x');
  });

  it('calls onUnmount callback when panel unmounts', () => {
    const handler = vi.fn();
    mgr.onUnmount(handler);
    mgr.mount('x');
    mgr.unmount('x');
    expect(handler).toHaveBeenCalledWith('x');
  });

  it('does not call onUnmount if panel was never mounted', () => {
    const handler = vi.fn();
    mgr.onUnmount(handler);
    mgr.unmount('never-existed');
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple callbacks', () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    mgr.onMount(cb1);
    mgr.onMount(cb2);
    mgr.mount('p');
    expect(cb1).toHaveBeenCalledWith('p');
    expect(cb2).toHaveBeenCalledWith('p');
  });

  it('off() removes a callback', () => {
    const handler = vi.fn();
    const off = mgr.onMount(handler);
    off();
    mgr.mount('p');
    expect(handler).not.toHaveBeenCalled();
  });
});
