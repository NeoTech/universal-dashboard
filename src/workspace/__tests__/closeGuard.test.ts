import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloseGuard } from '../closeGuard';

describe('CloseGuard', () => {
  let guard: CloseGuard;

  beforeEach(() => {
    guard = new CloseGuard();
  });

  it('isDirty is false by default', () => {
    expect(guard.isDirty).toBe(false);
  });

  it('markDirty sets isDirty true', () => {
    guard.markDirty();
    expect(guard.isDirty).toBe(true);
  });

  it('markClean clears dirty state', () => {
    guard.markDirty();
    guard.markClean();
    expect(guard.isDirty).toBe(false);
  });

  it('beforeunload handler sets returnValue when dirty', () => {
    guard.markDirty();
    const event = { returnValue: '' } as BeforeUnloadEvent;
    guard.handleBeforeUnload(event);
    expect(event.returnValue).toBe('You have unsaved layout changes.');
  });

  it('beforeunload handler does nothing when clean', () => {
    const event = { returnValue: '' } as BeforeUnloadEvent;
    guard.handleBeforeUnload(event);
    expect(event.returnValue).toBe('');
  });

  it('install attaches listener to window', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    guard.install();
    expect(addSpy).toHaveBeenCalledWith('beforeunload', guard.handleBeforeUnload);
    addSpy.mockRestore();
  });

  it('uninstall removes listener from window', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    guard.uninstall();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', guard.handleBeforeUnload);
    removeSpy.mockRestore();
  });

  it('install returns off() that calls uninstall', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const off = guard.install();
    off();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', guard.handleBeforeUnload);
    removeSpy.mockRestore();
  });
});
