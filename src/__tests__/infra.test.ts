import { describe, expect, it, vi } from 'vitest';

describe('infra', () => {
  it('vitest environment sanity check', () => {
    expect(1 + 1).toBe(2);
  });

  it('vi.stubGlobal works for Worker-like stubs', () => {
    const stubFn = vi.fn();
    vi.stubGlobal('postMessage', stubFn);
    postMessage('test');
    expect(stubFn).toHaveBeenCalledWith('test');
    vi.unstubAllGlobals();
  });
});
