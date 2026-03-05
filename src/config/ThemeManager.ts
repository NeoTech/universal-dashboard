const STORAGE_KEY = 'twm-theme';
const DEFAULT_THEME = 'dark';

/** All theme names supported by the application. */
export const THEMES: readonly string[] = ['dark', 'light'] as const;

/**
 * Manages application theme by toggling a `data-theme` attribute on
 * `document.documentElement`. Theme CSS variables are defined per-theme in CSS.
 * The chosen theme is persisted to `localStorage`.
 */
export class ThemeManager {
  private _current: string;

  constructor() {
    const stored = typeof localStorage !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME)
      : DEFAULT_THEME;
    // Fall back to default if stored value is no longer valid
    this._current = THEMES.includes(stored) ? stored : DEFAULT_THEME;
    this._apply(this._current);
  }

  /**
   * Returns the name of the currently active theme.
   *
   * @returns One of the values in {@link THEMES}.
   */
  getTheme(): string {
    return this._current;
  }

  /**
   * Switch to the named theme, persist the choice to `localStorage`, and
   * apply the `data-theme` attribute immediately.
   *
   * @param name - Theme name; must be present in {@link THEMES}.
   * @throws {Error} If `name` is not a known theme.
   */
  setTheme(name: string): void {
    if (!THEMES.includes(name)) {
      throw new Error(`Unknown theme "${name}". Available: ${THEMES.join(', ')}`);
    }
    this._current = name;
    this._apply(name);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, name);
    }
  }

  /**
   * Write `data-theme="{name}"` onto `document.documentElement`.
   *
   * @param name - Theme name to apply.
   */
  private _apply(name: string): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', name);
    }
  }
}
