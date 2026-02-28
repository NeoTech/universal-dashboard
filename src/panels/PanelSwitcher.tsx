import { createSignal, For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface Props {
  types: string[];
  current: string;
  onSelect: (type: string) => void;
}

/**
 * Inline dropdown that lets users switch a panel's content type.
 * Renders a trigger button showing the current type, and a list of options.
 */
export function PanelSwitcher(props: Props): JSX.Element {
  const [open, setOpen] = createSignal(false);

  function select(type: string) {
    setOpen(false);
    props.onSelect(type);
  }

  return (
    <div class="panel-switcher">
      <button
        class="panel-switcher__trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open()}
        onClick={() => setOpen(v => !v)}
      >
        {props.current}
      </button>

      <Show when={open()}>
        <ul class="panel-switcher__list" role="listbox">
          <For each={props.types}>
            {(type) => (
              <button
                class="panel-switcher__option"
                role="option"
                type="button"
                aria-selected={type === props.current}
                onClick={() => select(type)}
              >
                {type}
              </button>
            )}
          </For>
        </ul>
      </Show>
    </div>
  );
}
