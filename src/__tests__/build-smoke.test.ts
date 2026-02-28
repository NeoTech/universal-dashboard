import { describe, expect, it } from 'vitest';
import { version } from '../index.ts';

describe('build-smoke', () => {
  it('exports a semver version string', () => {
    expect(typeof version).toBe('string');
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
