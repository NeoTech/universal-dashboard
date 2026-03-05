import type { JSX } from 'solid-js';

/** Props for {@link Skeleton}. */
interface Props {
  /** CSS width of each skeleton line. Default: `'100%'`. */
  width?: string;
  /** CSS height of each skeleton line. Default: `'1em'`. */
  height?: string;
  /** Number of animated placeholder lines to render. Default: 1. */
  lines?: number;
}

/**
 * Animated loading placeholder that occupies space while content is fetching.
 *
 * When `lines` is greater than 1, the last line renders at 60 % width to
 * mimic the natural end of a paragraph.
 *
 * @param props - See {@link Props}.
 * @returns One or more shimmer blocks with `aria-busy="true"`.
 */
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
