import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

interface Props {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: JSX.Element;
}

export function StripeDrawer(props: Props): JSX.Element {
  return (
    <Show when={props.isOpen}>
      {/* Backdrop */}
      <div class="drawer-overlay" onClick={props.onClose} />
      {/* Panel */}
      <div class="drawer" role="dialog" aria-label={props.title}>
        <div class="drawer__header">
          <h2 class="drawer__title">{props.title}</h2>
          <button class="drawer__close" aria-label="Close drawer" onClick={props.onClose}>×</button>
        </div>
        <div class="drawer__body">{props.children}</div>
      </div>
    </Show>
  );
}
