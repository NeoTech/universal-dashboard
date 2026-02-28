import type { JSX } from 'solid-js';

export type BadgeVariant = 'success' | 'warning' | 'danger' | 'neutral';

interface Props {
  variant?: BadgeVariant;
  children: JSX.Element;
}

export function Badge(props: Props): JSX.Element {
  const variant = () => props.variant ?? 'neutral';
  return (
    <span class={`badge badge--${variant()}`} data-variant={variant()}>
      {props.children}
    </span>
  );
}
