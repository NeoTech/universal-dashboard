import type { JSX } from 'solid-js';

/** Visual style variant for a {@link Badge}. */
export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface Props {
  variant?: BadgeVariant;
  children: JSX.Element;
}

/**
 * Inline status badge that colour-codes a short label.
 *
 * @param props.variant - Visual style; defaults to `'neutral'`.
 * @param props.children - Badge text content.
 * @returns A `<span>` styled with the appropriate badge class.
 */
export function Badge(props: Props): JSX.Element {
  const variant = () => props.variant ?? 'neutral';
  return (
    <span class={`badge badge--${variant()}`} data-variant={variant()}>
      {props.children}
    </span>
  );
}
