const STORAGE_KEY = 'twm-theme';
const DEFAULT_THEME = 'dark';

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

  getTheme(): string {
    return this._current;
  }

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

  private _apply(name: string): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', name);
    }
  }
}
