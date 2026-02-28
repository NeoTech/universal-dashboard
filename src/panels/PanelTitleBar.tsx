import type { JSX } from 'solid-js';

interface Props {
  panelId: string;
  title: string;
  isFocused?: boolean;
  onClose?: (panelId: string) => void;
}

/**
 * Title bar displayed at the top of each panel.
 * Shows the panel title, a close button, and reflects focus state via
 * `data-focused` attribute (consumed by focus-ring CSS).
 */
export function PanelTitleBar(props: Props): JSX.Element {
  return (
    <div
      class="panel-titlebar"
      data-panel-id={props.panelId}
      data-focused={props.isFocused ? '' : undefined}
    >
      <span class="panel-titlebar__title">{props.title}</span>
      <button
        class="panel-titlebar__close"
        type="button"
        aria-label={`Close ${props.title}`}
        onClick={() => props.onClose?.(props.panelId)}
      >
        ✕
      </button>
    </div>
  );
}
