import { createEffect, onCleanup, Show } from 'solid-js';
import type { JSX, Accessor } from 'solid-js';
import type { TwmKeybindings } from '../config/config';

interface Props {
  open: Accessor<boolean>;
  onClose: () => void;
  keybindings: TwmKeybindings;
}

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac/i.test(navigator.platform);

/** Convert internal key string (e.g. "mod+arrowright") to a human-readable label. */
function formatKey(raw: string): string {
  return raw
    .split('+')
    .map(seg => {
      switch (seg.toLowerCase()) {
        case 'mod':        return IS_MAC ? '⌘' : 'Ctrl';
        case 'shift':      return IS_MAC ? '⇧' : 'Shift';
        case 'alt':        return IS_MAC ? '⌥' : 'Alt';
        case 'arrowleft':  return '←';
        case 'arrowright': return '→';
        case 'arrowup':    return '↑';
        case 'arrowdown':  return '↓';
        default:           return seg.toUpperCase();
      }
    })
    .join(IS_MAC ? '' : '+');
}

interface KbRow {
  action: string;
  description: string;
  key: keyof TwmKeybindings;
}

const KB_ROWS: KbRow[] = [
  { action: 'Command palette',    description: 'Open the command palette to run any action', key: 'openPalette' },
  { action: 'Help / Shortcuts',   description: 'Show this keyboard shortcuts reference',     key: 'help' },
  { action: 'Undo',               description: 'Undo the last tile move or resize',          key: 'undo' },
  { action: 'Redo',               description: 'Redo the last undone action',                key: 'redo' },
  { action: 'Next dashboard',     description: 'Switch to the next dashboard (wraps around)',key: 'nextDashboard' },
  { action: 'Previous dashboard', description: 'Switch to the previous dashboard',           key: 'prevDashboard' },
];

const INTERACTIONS: { action: string; description: string }[] = [
  { action: 'Drag title bar',    description: 'Move a tile to a new position on the dashboard' },
  { action: 'Alt + drag tile',   description: 'Copy a tile to a new position (duplicate)' },
  { action: 'Drag resize handle',description: 'Resize a tile by dragging the bottom-right corner handle' },
  { action: 'Right-click tile',  description: 'Open the tile context menu (rename, configure, close, etc.)' },
  { action: 'Click + Ctrl+Z',    description: 'Undo the last tile layout change' },
];

export function HelpModal(props: Props): JSX.Element {
  // Close on Escape key
  createEffect(() => {
    if (!props.open()) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); props.onClose(); }
    };
    document.addEventListener('keydown', handler, true);
    onCleanup(() => document.removeEventListener('keydown', handler, true));
  });

  return (
    <Show when={props.open()}>
      {/* Backdrop — click outside closes */}
      <div
        class="help-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={props.onClose}
      >
        {/* Dialog — stop propagation so clicks inside don't close */}
        <div
          class="help-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="help-modal__header">
            <h2 class="help-modal__title">Keyboard Shortcuts &amp; Interactions</h2>
            <button
              class="help-modal__close"
              aria-label="Close help"
              onClick={props.onClose}
            >
              ✕
            </button>
          </div>

          <div class="help-modal__body">
            {/* ── Keybindings ────────────────────────────────────── */}
            <section class="help-modal__section">
              <h3 class="help-modal__section-title">Keyboard shortcuts</h3>
              <table class="help-modal__table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Key</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {KB_ROWS.map(row => (
                    <tr>
                      <td class="help-modal__action">{row.action}</td>
                      <td class="help-modal__key">
                        <kbd>{formatKey(props.keybindings[row.key])}</kbd>
                      </td>
                      <td class="help-modal__desc">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* ── Mouse / Drag interactions ──────────────────────── */}
            <section class="help-modal__section">
              <h3 class="help-modal__section-title">Mouse &amp; drag interactions</h3>
              <table class="help-modal__table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {INTERACTIONS.map(row => (
                    <tr>
                      <td class="help-modal__action">{row.action}</td>
                      <td class="help-modal__desc">{row.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <p class="help-modal__footer">Press <kbd>Esc</kbd> or click outside to close</p>
        </div>
      </div>
    </Show>
  );
}
