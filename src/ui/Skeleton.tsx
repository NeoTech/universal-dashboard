import type { JSX } from 'solid-js';

interface Props {
  width?: string;
  height?: string;
  lines?: number;
}

export function Skeleton(props: Props): JSX.Element {
  const lines = () => props.lines ?? 1;
  if (lines() === 1) {
    return (
      <div
        class="skeleton"
        style={{ width: props.width ?? '100%', height: props.height ?? '1em' }}
        aria-busy="true"
        aria-label="Loading…"
      />
    );
  }
  return (
    <div class="skeleton-group" aria-busy="true" aria-label="Loading…">
      {Array.from({ length: lines() }).map((_, i) => (
        <div
          class="skeleton"
          style={{
            width: i === lines() - 1 ? '60%' : '100%',
            height: props.height ?? '1em',
            'margin-bottom': '0.4em',
          }}
        />
      ))}
    </div>
  );
}
