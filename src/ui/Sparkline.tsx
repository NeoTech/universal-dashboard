import type { JSX } from 'solid-js';

/** Props for {@link Sparkline}. */
interface Props {
  /** Ordered series of numeric values to plot. Requires at least 2 points. */
  data: number[];
  /** SVG width in pixels. Default: 120. */
  w?: number;
  /** SVG height in pixels. Default: 32. */
  h?: number;
  /** CSS colour string for the polyline stroke. Default: `var(--twm-color-accent)`. */
  color?: string;
}

/**
 * Tiny inline SVG line chart for embedding inside tile titlebars or table cells.
 *
 * Data is normalised to fill the full height, so only relative trends are
 * conveyed — not absolute values. The element is `aria-hidden` because the
 * numeric data should be accessible via surrounding text.
 *
 * @param props - See {@link Props}.
 * @returns An `<svg>` polyline element, or an empty SVG when data is insufficient.
 */
export function Sparkline(props: Props): JSX.Element {
  const w = () => props.w ?? 120;
  const h = () => props.h ?? 32;
  const color = () => props.color ?? 'var(--twm-color-accent)';

  const points = () => {
    const d = props.data;
    if (!d || d.length < 2) return '';
    const min = Math.min(...d);
    const max = Math.max(...d);
    const range = max - min || 1;
    return d
      .map((v, i) => {
        const x = (i / (d.length - 1)) * w();
        const y = h() - ((v - min) / range) * h();
        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <svg
      class="sparkline"
      width={w()}
      height={h()}
      viewBox={`0 0 ${w()} ${h()}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points()}
        fill="none"
        stroke={color()}
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
