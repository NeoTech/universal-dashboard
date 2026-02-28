import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FullscreenManager } from '../panels/FullscreenManager';

describe('FullscreenManager', () => {
  let mgr: FullscreenManager;

  beforeEach(() => {
    mgr = new FullscreenManager();
  });

  it('starts with no fullscreen panel', () => {
    expect(mgr.fullscreenId()).toBeNull();
  });

  it('maximize sets the fullscreen id', () => {
    mgr.maximize('p1');
    expect(mgr.fullscreenId()).toBe('p1');
  });

  it('isFullscreen returns true for the maximized panel', () => {
    mgr.maximize('p1');
    expect(mgr.isFullscreen('p1')).toBe(true);
    expect(mgr.isFullscreen('p2')).toBe(false);
  });

  it('restore clears fullscreen state', () => {
    mgr.maximize('p1');
    mgr.restore();
    expect(mgr.fullscreenId()).toBeNull();
  });

  it('maximize replaces previous fullscreen panel', () => {
    mgr.maximize('p1');
    mgr.maximize('p2');
    expect(mgr.fullscreenId()).toBe('p2');
    expect(mgr.isFullscreen('p1')).toBe(false);
  });

  it('toggle: maximize when not fullscreen', () => {
    mgr.toggle('p1');
    expect(mgr.isFullscreen('p1')).toBe(true);
  });

  it('toggle: restore when already fullscreen', () => {
    mgr.maximize('p1');
    mgr.toggle('p1');
    expect(mgr.fullscreenId()).toBeNull();
  });

  it('calls onChange callback when state changes', () => {
    const handler = vi.fn();
    mgr.onChange(handler);
    mgr.maximize('p1');
    expect(handler).toHaveBeenCalledWith('p1');
    mgr.restore();
    expect(handler).toHaveBeenCalledWith(null);
  });
});
