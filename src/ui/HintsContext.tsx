import { createContext, useContext, createSignal } from 'solid-js';
import type { JSX, Accessor } from 'solid-js';

export interface Hint {
  keys: string;
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

export function HintsProvider(props: { children: JSX.Element }): JSX.Element {
  const [hints, setHints] = createSignal<Hint[]>([]);
  return (
    <HintsContext.Provider value={{ hints, setHints }}>
      {props.children}
    </HintsContext.Provider>
  );
}

export function useHints(): HintsContextValue {
  return useContext(HintsContext);
}

/** Convenience: publish a set of hints from any child component */
export function usePublishHints(hints: Hint[]): void {
  const ctx = useContext(HintsContext);
  ctx.setHints(hints);
}

// Default global hint sets
export const HINTS_DEFAULT: Hint[] = [
  { keys: 'Ctrl+P',      label: 'Command palette' },
  { keys: 'Ctrl+→/←',   label: 'Switch dashboard' },
  { keys: 'Ctrl+Z',      label: 'Undo' },
  { keys: '?',           label: 'Help' },
];

export const HINTS_PALETTE: Hint[] = [
  { keys: '↑↓', label: 'Navigate' },
  { keys: 'Enter', label: 'Run' },
  { keys: 'Esc', label: 'Close' },
];
