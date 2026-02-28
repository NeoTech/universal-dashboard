// ── Types ─────────────────────────────────────────────────────────────────────

export interface ParsedBinding {
  key: string;
  mod: boolean;
  shift: boolean;
  alt: boolean;
}

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a shortcut string like `"mod+shift+l"` into a structured binding.
 * - `mod` maps to Ctrl on Windows/Linux and Cmd (Meta) on macOS.
 * - Modifier tokens: `mod`, `shift`, `alt`.
 */
export function parseBinding(binding: string): ParsedBinding {
  const parts = binding.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  return {
    key,
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
  };
}

// ── Matcher ───────────────────────────────────────────────────────────────────

/**
 * Check whether a `KeyboardEvent` matches a parsed binding.
 * @param isMac - when true, `mod` maps to `metaKey`; otherwise `ctrlKey`.
 */
export function matchesEvent(
  binding: ParsedBinding,
  event: KeyboardEvent,
  isMac: boolean,
): boolean {
  const modPressed = isMac ? event.metaKey : event.ctrlKey;
  return (
    event.key.toLowerCase() === binding.key &&
    modPressed === binding.mod &&
    event.shiftKey === binding.shift &&
    event.altKey === binding.alt
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

interface Entry {
  binding: ParsedBinding;
  actionId: string;
  handler: () => void;
}

/**
 * Registry for keyboard shortcuts.
 * Register bindings with `register`, then call `dispatch` from a `keydown` listener.
 */
export class KeybindingRegistry {
  private _entries: Entry[] = [];

  /** Register a shortcut string with an action id and handler. */
  register(shortcut: string, actionId: string, handler: () => void): void {
    this._entries.push({ binding: parseBinding(shortcut), actionId, handler });
  }

  /**
   * Dispatch a `KeyboardEvent` against all registered bindings.
   * The first match wins; `preventDefault` is called on the event.
   */
  dispatch(event: KeyboardEvent, isMac: boolean): void {
    for (const entry of this._entries) {
      if (matchesEvent(entry.binding, event, isMac)) {
        event.preventDefault();
        entry.handler();
        return;
      }
    }
  }
}
