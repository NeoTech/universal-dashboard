import { describe, it, expect } from 'vitest';
import {
  defineConfig,
  mergeConfig,
  parseConfig,
  DEFAULT_CONFIG,
  type TwmConfig,
} from '../config/config';

describe('TWM config', () => {
  it('DEFAULT_CONFIG has expected shape', () => {
    expect(DEFAULT_CONFIG.theme).toBeDefined();
    expect(DEFAULT_CONFIG.keybindings).toBeDefined();
    expect(DEFAULT_CONFIG.defaultWorkspace).toBeDefined();
    expect(DEFAULT_CONFIG.splitRatio).toBeCloseTo(0.5);
  });

  it('defineConfig returns the provided config unchanged', () => {
    const cfg: TwmConfig = defineConfig({ theme: 'dark', splitRatio: 0.6 });
    expect(cfg.theme).toBe('dark');
    expect(cfg.splitRatio).toBeCloseTo(0.6);
  });

  it('mergeConfig applies user overrides over defaults', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { splitRatio: 0.7 });
    expect(merged.splitRatio).toBeCloseTo(0.7);
    // Other keys should remain from defaults
    expect(merged.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it('mergeConfig deep-merges keybindings', () => {
    const merged = mergeConfig(DEFAULT_CONFIG, {
      keybindings: { nextDashboard: 'mod+arrowright' },
    });
    expect(merged.keybindings.nextDashboard).toBe('mod+arrowright');
    // Other keybindings should be preserved from defaults
    expect(merged.keybindings.prevDashboard).toBe(DEFAULT_CONFIG.keybindings.prevDashboard);
  });

  it('parseConfig returns merged config from JSON', () => {
    const json = JSON.stringify({ splitRatio: 0.3 });
    const cfg = parseConfig(json);
    expect(cfg.splitRatio).toBeCloseTo(0.3);
    expect(cfg.theme).toBe(DEFAULT_CONFIG.theme);
  });

  it('parseConfig throws on invalid JSON', () => {
    expect(() => parseConfig('not json')).toThrow();
  });

  it('parseConfig throws when splitRatio is out of range', () => {
    const json = JSON.stringify({ splitRatio: 1.5 });
    expect(() => parseConfig(json)).toThrow(/splitRatio/);
  });

  it('parseConfig ignores unknown keys', () => {
    const json = JSON.stringify({ unknownKey: 'value' });
    expect(() => parseConfig(json)).not.toThrow();
  });
});
