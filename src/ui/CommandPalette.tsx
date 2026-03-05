import { createSignal, createEffect, For, Show } from 'solid-js';
import type { JSX, Accessor } from 'solid-js';

/** A single entry in the {@link CommandPalette} command list. */
export interface Command {
  /** Stable identifier used to track the command across re-renders. */
  id: string;
  /** Human-readable label shown in the list and searched by the filter. */
  label: string;
  /** Callback invoked when the command is selected via Enter or click. */
  run: () => void;
}

interface Props {
  commands: Command[];
  isOpen: Accessor<boolean> | boolean;
  onClose?: () => void;
}

/**
 * Convert a string to lowercase for case-insensitive substring matching.
 *
 * @param s - Input string.
 * @returns Lowercased copy of `s`.
 */
function normalise(s: string): string {
  return s.toLowerCase();
}

/**
 * Fuzzy-search command palette overlay.
 *
 * Opens when `isOpen` is truthy. Filters commands by label substring match.
 * Arrow keys navigate the list, Enter runs the selected command, Escape closes.
 */
export function CommandPalette(props: Props): JSX.Element {
  const isOpen = (): boolean =>
    typeof props.isOpen === 'function' ? props.isOpen() : props.isOpen;

  const [query, setQuery] = createSignal('');
  const [selectedIndex, setSelectedIndex] = createSignal(0);

  // Reset query and selection whenever the palette opens
  createEffect(() => {
    if (isOpen()) { setQuery(''); setSelectedIndex(0); }
  });

  const filtered = (): Command[] => {
    const q = normalise(query());
    if (!q) return props.commands;
    return props.commands.filter(cmd => normalise(cmd.label).includes(q));
  };

  // Reset selection when query changes so it doesn't go out of bounds
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  function runSelected(): void {
    const cmds = filtered();
    const idx = selectedIndex();
    if (cmds.length > 0) {
      cmds[Math.min(idx, cmds.length - 1)].run();
      props.onClose?.();
    }
  }

  function handleKeyDown(e: KeyboardEvent): void {
    const len = filtered().length;
    if (e.key === 'Escape') { e.preventDefault(); props.onClose?.(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, len - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') { e.preventDefault(); runSelected(); return; }
  }

  return (
    <Show when={isOpen()}>
      <div
        class="command-palette-overlay"
        onClick={() => props.onClose?.()}
      >
        <div
          class="command-palette"
          role="dialog"
          aria-label="Command Palette"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            class="command-palette__input"
            type="text"
            placeholder="Search commands…"
            value={query()}
            onInput={(e) => setQuery(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            autofocus
          />
          <ul class="command-palette__list" role="listbox">
            <For each={filtered()}>
              {(cmd, i) => (
                <li
                  class={`command-palette__item${selectedIndex() === i() ? ' command-palette__item--selected' : ''}`}
                  role="option"
                  aria-selected={selectedIndex() === i()}
                  data-id={cmd.id}
                  onMouseEnter={() => setSelectedIndex(i())}
                  onClick={() => { cmd.run(); props.onClose?.(); }}
                >
                  {cmd.label}
                </li>
              )}
            </For>
          </ul>
        </div>
      </div>
    </Show>
  );
}
