import { describe, it, expect, vi } from 'vitest';
import { parseBinding, matchesEvent, KeybindingRegistry } from '../keyboard/keybindings';

// Helper to create synthetic KeyboardEvent-like objects
function mkEvent(opts: {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}): KeyboardEvent {
  return {
    key: opts.key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    altKey: opts.altKey ?? false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

describe('parseBinding', () => {
  it('parses plain key', () => {
    const b = parseBinding('a');
    expect(b.key).toBe('a');
    expect(b.mod).toBe(false);
    expect(b.shift).toBe(false);
  });

  it('parses mod+key', () => {
    const b = parseBinding('mod+p');
    expect(b.key).toBe('p');
    expect(b.mod).toBe(true);
  });

  it('parses mod+shift+key', () => {
    const b = parseBinding('mod+shift+l');
    expect(b.key).toBe('l');
    expect(b.mod).toBe(true);
    expect(b.shift).toBe(true);
  });

  it('is case-insensitive for modifiers', () => {
    const b = parseBinding('MOD+SHIFT+H');
    expect(b.mod).toBe(true);
    expect(b.shift).toBe(true);
    expect(b.key).toBe('h');
  });
});

describe('matchesEvent', () => {
  it('matches Ctrl+key (non-macOS)', () => {
    const binding = parseBinding('mod+p');
    const event = mkEvent({ key: 'p', ctrlKey: true });
    expect(matchesEvent(binding, event, false)).toBe(true);
  });

  it('matches Meta+key (macOS)', () => {
    const binding = parseBinding('mod+p');
    const event = mkEvent({ key: 'p', metaKey: true });
    expect(matchesEvent(binding, event, true)).toBe(true);
  });

  it('does not match when shift missing', () => {
    const binding = parseBinding('mod+shift+l');
    const event = mkEvent({ key: 'l', ctrlKey: true });
    expect(matchesEvent(binding, event, false)).toBe(false);
  });

  it('does not match wrong key', () => {
    const binding = parseBinding('mod+p');
    const event = mkEvent({ key: 'q', ctrlKey: true });
    expect(matchesEvent(binding, event, false)).toBe(false);
  });
});

describe('KeybindingRegistry', () => {
  it('dispatches registered action when matching event fires', () => {
    const registry = new KeybindingRegistry();
    const handler = vi.fn();
    registry.register('mod+shift+l', 'split-h', handler);
    const event = mkEvent({ key: 'l', ctrlKey: true, shiftKey: true });
    registry.dispatch(event, false);
    expect(handler).toHaveBeenCalledOnce();
  });

  it('calls preventDefault on matched event', () => {
    const registry = new KeybindingRegistry();
    registry.register('mod+p', 'palette', vi.fn());
    const event = mkEvent({ key: 'p', ctrlKey: true });
    registry.dispatch(event, false);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it('does not call handler when event does not match', () => {
    const registry = new KeybindingRegistry();
    const handler = vi.fn();
    registry.register('mod+p', 'palette', handler);
    const event = mkEvent({ key: 'q', ctrlKey: true });
    registry.dispatch(event, false);
    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple registered bindings', () => {
    const registry = new KeybindingRegistry();
    const h1 = vi.fn();
    const h2 = vi.fn();
    registry.register('mod+h', 'focus-left', h1);
    registry.register('mod+l', 'focus-right', h2);
    registry.dispatch(mkEvent({ key: 'h', ctrlKey: true }), false);
    expect(h1).toHaveBeenCalledOnce();
    expect(h2).not.toHaveBeenCalled();
  });
});
