// ── Types ─────────────────────────────────────────────────────────────────────

export interface TwmKeybindings {
  nextDashboard: string;
  prevDashboard: string;
  closePanel: string;
  focusLeft: string;
  focusRight: string;
  focusUp: string;
  focusDown: string;
  openPalette: string;
  nextWorkspace: string;
  prevWorkspace: string;
  undo: string;
  redo: string;
  help: string;
}

export interface TwmConfig {
  /** Color theme. Currently only 'dark' is bundled. */
  theme: string;
  /** Initial workspace name shown on startup. */
  defaultWorkspace: string;
  /** Default split ratio when creating a new split (0 < ratio < 1). */
  splitRatio: number;
  /** Keyboard shortcut mappings. Use `mod` for Ctrl (Win/Linux) or Cmd (macOS). */
  keybindings: TwmKeybindings;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG: Readonly<TwmConfig> = {
  theme: 'dark',
  defaultWorkspace: 'default',
  splitRatio: 0.5,
  keybindings: {
    nextDashboard:   'mod+arrowright',
    prevDashboard:   'mod+arrowleft',
    closePanel:      'mod+shift+q',
    focusLeft:       'mod+h',
    focusRight:      'mod+l',
    focusUp:         'mod+k',
    focusDown:       'mod+j',
    openPalette:     'mod+p',
    nextWorkspace:   'mod+]',
    prevWorkspace:   'mod+[',
    undo:            'mod+z',
    redo:            'mod+shift+z',
    help:            '?',
  },
};

// ── Public API ────────────────────────────────────────────────────────────────

type ConfigOverride = Omit<Partial<TwmConfig>, 'keybindings'> & {
  keybindings?: Partial<TwmKeybindings>;
};

/**
 * Type-annotated config factory (à la Vite's `defineConfig`).
 * Returns the provided partial config with defaults filled in.
 */
export function defineConfig(overrides: ConfigOverride): TwmConfig {
  return mergeConfig(DEFAULT_CONFIG, overrides);
}

/**
 * Deep-merge `base` with `overrides`.
 * Only keybindings is deep-merged; all other top-level keys are shallow-replaced.
 */
export function mergeConfig(
  base: Readonly<TwmConfig>,
  overrides: ConfigOverride,
): TwmConfig {
  return {
    ...base,
    ...overrides,
    keybindings: {
      ...base.keybindings,
      ...(overrides.keybindings ?? {}),
    },
  };
}

/**
 * Parse a JSON string into a `TwmConfig`, merging with defaults.
 * Throws on invalid JSON or constraint violations.
 */
export function parseConfig(json: string): TwmConfig {
  // May throw SyntaxError — intentionally propagated
  const raw = JSON.parse(json) as ConfigOverride;

  if (
    raw.splitRatio !== undefined &&
    (raw.splitRatio <= 0 || raw.splitRatio >= 1)
  ) {
    throw new RangeError(
      `splitRatio must be in (0, 1), got ${raw.splitRatio}`,
    );
  }

  return mergeConfig(DEFAULT_CONFIG, raw);
}
