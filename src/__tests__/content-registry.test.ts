import { describe, it, expect } from 'vitest';
import { ContentRegistry } from '../panels/ContentRegistry';

describe('ContentRegistry', () => {
  it('starts empty', () => {
    const reg = new ContentRegistry();
    expect(reg.types()).toHaveLength(0);
  });

  it('registers a content type', () => {
    const reg = new ContentRegistry();
    reg.register('terminal', () => 'terminal-component');
    expect(reg.has('terminal')).toBe(true);
  });

  it('returns the factory for a registered type', () => {
    const reg = new ContentRegistry();
    const factory = () => 'my-component';
    reg.register('editor', factory);
    expect(reg.get('editor')).toBe(factory);
  });

  it('lists all registered types', () => {
    const reg = new ContentRegistry();
    reg.register('terminal', () => '');
    reg.register('editor', () => '');
    reg.register('browser', () => '');
    expect(reg.types().sort()).toEqual(['browser', 'editor', 'terminal']);
  });

  it('throws when getting an unregistered type', () => {
    const reg = new ContentRegistry();
    expect(() => reg.get('unknown')).toThrow(/unknown/);
  });

  it('has() returns false for unknown type', () => {
    const reg = new ContentRegistry();
    expect(reg.has('nope')).toBe(false);
  });

  it('overwriting a registration updates the factory', () => {
    const reg = new ContentRegistry();
    const v1 = () => 'v1';
    const v2 = () => 'v2';
    reg.register('t', v1);
    reg.register('t', v2);
    expect(reg.get('t')).toBe(v2);
  });

  it('unregister removes a type', () => {
    const reg = new ContentRegistry();
    reg.register('x', () => '');
    reg.unregister('x');
    expect(reg.has('x')).toBe(false);
  });
});
