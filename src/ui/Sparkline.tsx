import type { JSX } from 'solid-js';

interface Props {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
}

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
