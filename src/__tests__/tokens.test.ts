import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const tokensRaw = readFileSync(resolve(root, 'styles/tokens.css'), 'utf-8');
const baseRaw = readFileSync(resolve(root, 'styles/base.css'), 'utf-8');

describe('design tokens', () => {
  it('defines gap tokens', () => {
    expect(tokensRaw).toContain('--twm-gap-inner');
    expect(tokensRaw).toContain('--twm-gap-outer');
  });

  it('defines color tokens', () => {
    expect(tokensRaw).toContain('--twm-color-bg');
    expect(tokensRaw).toContain('--twm-color-surface');
    expect(tokensRaw).toContain('--twm-color-border');
    expect(tokensRaw).toContain('--twm-color-text');
    expect(tokensRaw).toContain('--twm-color-accent');
  });

  it('defines typography tokens', () => {
    expect(tokensRaw).toContain('--twm-font-family');
    expect(tokensRaw).toContain('--twm-font-size-sm');
    expect(tokensRaw).toContain('--twm-font-size-base');
  });

  it('defines radius and transition tokens', () => {
    expect(tokensRaw).toContain('--twm-radius');
    expect(tokensRaw).toContain('--twm-transition');
  });

  it('base: disables overflow and scroll bounce on body', () => {
    expect(baseRaw).toContain('overflow: hidden');
    expect(baseRaw).toContain('overscroll-behavior: none');
    expect(baseRaw).toContain('user-select: none');
  });

  it('base: panel uses CSS containment', () => {
    expect(baseRaw).toContain('contain:');
    expect(baseRaw).toContain('.panel');
  });
});
