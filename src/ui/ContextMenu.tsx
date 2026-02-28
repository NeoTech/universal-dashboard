import { createEffect, onCleanup, For, Show } from 'solid-js';
import type { JSX, Accessor } from 'solid-js';

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

interface Props {
  items: MenuItem[];
  position: { x: number; y: number };
  isOpen: Accessor<boolean> | boolean;
  onSelect?: (id: string) => void;
  onClose?: () => void;
}

/**
 * Right-click context menu rendered at a fixed document position.
 * Closes when clicking outside the menu.
 */
export function ContextMenu(props: Props): JSX.Element {
  const isOpen = (): boolean =>
    typeof props.isOpen === 'function' ? props.isOpen() : props.isOpen;

  // Attach outside-click listener while open
  createEffect(() => {
    if (!isOpen()) return;

    const handler = (e: MouseEvent) => {
      // Let a frame pass so the trigger click doesn't immediately close the menu
      const menu = document.querySelector('.context-menu');
      if (!menu || !menu.contains(e.target as Node)) {
        props.onClose?.();
      }
    };

    document.addEventListener('mousedown', handler);
    onCleanup(() => document.removeEventListener('mousedown', handler));
  });

  return (
    <Show when={isOpen()}>
      <ul
        class="context-menu"
        role="menu"
        style={{
          position: 'fixed',
          left: `${props.position.x}px`,
          top: `${props.position.y}px`,
        }}
      >
        <For each={props.items}>
          {(item) => (
            <li
              class="context-menu__item"
              role="menuitem"
              data-id={item.id}
              data-disabled={item.disabled ? 'true' : undefined}
              aria-disabled={item.disabled}
              onClick={() => {
                if (!item.disabled) {
                  props.onSelect?.(item.id);
                  props.onClose?.();
                }
              }}
            >
              {item.label}
            </li>
          )}
        </For>
      </ul>
    </Show>
  );
}
