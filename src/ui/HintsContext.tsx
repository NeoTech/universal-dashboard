import { createContext, useContext, createSignal } from 'solid-js';
import type { JSX, Accessor } from 'solid-js';

/** A single keyboard shortcut hint displayed in the status-bar hints strip. */
export interface Hint {
  /** Key combination string, e.g. `'Ctrl+P'` or `'↑↓'`. */
  keys: string;
  /** Human-readable description of the action. */
  label: string;
}

interface HintsContextValue {
  hints: Accessor<Hint[]>;
  setHints: (hints: Hint[]) => void;
}

const HintsContext = createContext<HintsContextValue>({
  hints: () => [],
  setHints: () => undefined,
});

/**
 * Context provider that owns the live hint list.
 *
 * Wrap the component tree with `HintsProvider` so that descendants can call
 * {@link useHints} or {@link usePublishHints} to update the status-bar hints.
 *
 * @param props.children - Child component tree.
 * @returns Provider node.
 */
export function HintsProvider(props: { children: JSX.Element }): JSX.Element {
  const [hints, setHints] = createSignal<Hint[]>([]);
  return (
    <HintsContext.Provider value={{ hints, setHints }}>
      {props.children}
    </HintsContext.Provider>
  );
}

/**
 * Returns the {@link HintsContextValue} from the nearest {@link HintsProvider}.
 *
 * @returns Context value exposing the `hints` accessor and `setHints` setter.
 */
export function useHints(): HintsContextValue {
  return useContext(HintsContext);
}

/** Convenience: publish a set of hints from any child component */
export function usePublishHints(hints: Hint[]): void {
  const ctx = useContext(HintsContext);
  ctx.setHints(hints);
}

/** Default hint set shown when no panel or modal is active. */
export const HINTS_DEFAULT: Hint[] = [
  { keys: 'Ctrl+P',      label: 'Command palette' },
  { keys: 'Ctrl+→/←',   label: 'Switch dashboard' },
  { keys: 'Ctrl+Z',      label: 'Undo' },
  { keys: '?',           label: 'Help / Shortcuts' },
];

/** Hint set shown while the {@link CommandPalette} is open. */
export const HINTS_PALETTE: Hint[] = [
  { keys: '↑↓', label: 'Navigate' },
  { keys: 'Enter', label: 'Run' },
  { keys: 'Esc', label: 'Close' },
];
