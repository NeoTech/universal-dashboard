import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ThemeManager, THEMES } from '../config/ThemeManager';

describe('ThemeManager', () => {
  let mgr: ThemeManager;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    mgr = new ThemeManager();
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('has a list of available themes', () => {
    expect(THEMES).toContain('dark');
    expect(THEMES).toContain('light');
  });

  it('defaults to dark theme', () => {
    expect(mgr.getTheme()).toBe('dark');
  });

  it('applies theme as data-theme on documentElement', () => {
    mgr.setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('getTheme returns the currently active theme', () => {
    mgr.setTheme('light');
    expect(mgr.getTheme()).toBe('light');
  });

  it('persists theme to localStorage', () => {
    mgr.setTheme('light');
    expect(localStorage.getItem('twm-theme')).toBe('light');
  });

  it('restores persisted theme on construction', () => {
    localStorage.setItem('twm-theme', 'light');
    const mgr2 = new ThemeManager();
    expect(mgr2.getTheme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('throws when setting an unknown theme', () => {
    expect(() => mgr.setTheme('purple-haze')).toThrow(/purple-haze/);
  });
});
