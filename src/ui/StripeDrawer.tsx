import { Show } from 'solid-js';
import type { JSX } from 'solid-js';

/** Props for {@link StripeDrawer}. */
interface Props {
  /** Whether the drawer is currently open. */
  isOpen: boolean;
  /** Heading text shown in the drawer header and used as `aria-label`. */
  title: string;
  /** Called when the user clicks the close button or the backdrop. */
  onClose: () => void;
  /** Body content rendered inside the drawer panel. */
  children: JSX.Element;
}

/**
 * Slide-in side panel for displaying Stripe object details.
 *
 * Renders a translucent backdrop that dismisses the panel on click. The drawer
 * itself is a `role="dialog"` region labelled by the `title` prop.
 *
 * @param props - See {@link Props}.
 * @returns A backdrop + panel pair, or nothing when `isOpen` is `false`.
 */
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
