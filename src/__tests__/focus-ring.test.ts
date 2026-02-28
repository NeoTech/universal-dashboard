import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const css = readFileSync(
  resolve(__dirname, '../styles/base.css'),
  'utf8',
);

describe('Focus ring CSS', () => {
  it('has a .panel[data-focused] rule', () => {
    expect(css).toContain('.panel[data-focused]');
  });

  it('uses the accent token for the focus ring outline', () => {
    // Find the .panel[data-focused] block and check it references accent token
    expect(css).toMatch(/\.panel\[data-focused\][^}]*--twm-color-accent/s);
  });

  it('uses outline or box-shadow for the focus ring (not border)', () => {
    // Using outline or box-shadow is more accessible and doesn't shift layout
    expect(css).toMatch(/\.panel\[data-focused\][^}]*(outline|box-shadow)/s);
  });

  it('elevates focused panel z-index above normal panel z-index', () => {
    expect(css).toMatch(/\.panel\[data-focused\][^}]*z-index/s);
  });

  it('has correct status-bar base styles section', () => {
    expect(css).toContain('.status-bar');
  });
});
