import type { JSX } from 'solid-js';

interface Props {
  panelId: string;
  label: string;
  isFocused?: boolean;
  children: JSX.Element;
}

/**
 * Accessible wrapper for a tiling panel.
 *
 * Adds semantic ARIA attributes so assistive technologies can navigate between
 * panels using landmarks and understand the current focus state.
 */
export function AriaPanel(props: Props): JSX.Element {
  return (
    <div
      role="region"
      aria-label={props.label}
      aria-current={props.isFocused ? 'true' : undefined}
      data-panel-id={props.panelId}
      // Panels should be focusable by keyboard (tabIndex=0)
      tabIndex={0}
    >
      {props.children}
    </div>
  );
}
