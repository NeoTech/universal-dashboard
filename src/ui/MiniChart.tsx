/**
 * MiniChart — lightweight SVG chart with no external dependencies.
 *
 * Supports three chart types driven by a flat `number[]` data array:
 *   line   — polyline with gradient fill (price history, sensor readings)
 *   bar    — vertical rectangles (counts, volumes)
 *   candle — synthetic candlesticks where each adjacent pair is treated as
 *            open/close; a narrow wick extends ±2 % beyond the body
 *
 * Only the last MAX_VISIBLE points are rendered so candle/bar width stays
 * constant as new data arrives (no compression effect).
 *
 * Y-axis: three price labels (max / mid / min) are rendered as an absolutely-
 * positioned overlay to avoid SVG text distortion from preserveAspectRatio=none.
 * Matching dashed guide lines are drawn inside the SVG.
 */

import { createMemo } from 'solid-js';
import type { JSX } from 'solid-js';

interface Props {
  data: number[];
  type?: 'line' | 'bar' | 'candle';
  label?: string;
  height?: number;
  /** How many data points to show at once (default 50). Older points scroll off. */
  window?: number;
}

const W = 400;          // viewBox width (unitless SVG units)
const PAD_TOP = 10;     // headroom so the tallest point isn't clipped
const PAD_BOTTOM = 10;  // footroom
const GUIDE_LEVELS = [0, 0.25, 0.5, 0.75, 1]; // fractional Y positions for guide lines

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function formatPrice(v: number): string {
  if (Math.abs(v) >= 10_000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100)   return v.toFixed(2);
  if (Math.abs(v) >= 1)     return v.toFixed(4);
  return v.toPrecision(4);
}

export function MiniChart(props: Props): JSX.Element {
  const H = () => props.height ?? 200;
  const maxVisible = () => props.window ?? 50;
  const chartH = () => H() - PAD_TOP - PAD_BOTTOM;

  /** Slice to the rightmost window of points */
  const visible = createMemo<number[]>(() => {
    const d = props.data;
    return d.length > maxVisible() ? d.slice(-maxVisible()) : d;
  });

  const bounds = createMemo(() => {
    const d = visible();
    if (d.length === 0) return { min: 0, max: 1, range: 1 };
    let lo = d[0], hi = d[0];
    for (const v of d) { if (v < lo) lo = v; if (v > hi) hi = v; }
    // Add a small margin so candles at the very edge aren't clipped
    const raw = hi - lo || Math.abs(hi) * 0.01 || 1;
    const margin = raw * 0.04;
    const min = lo - margin;
    const max = hi + margin;
    return { min, max, range: max - min };
  });

  /** Map a data value to SVG y coordinate (0 = top) */
  const toY = (v: number): number => {
    const { min, range } = bounds();
    return PAD_TOP + chartH() - clamp((v - min) / range, 0, 1) * chartH();
  };

  /** Y coordinate of a guide line at fractional position f (0=bottom, 1=top) */
  const guideY = (f: number): number => PAD_TOP + chartH() * (1 - f);

  /* ------------------------------------------------------------------ line */
  const linePoints = createMemo<string>(() => {
    const d = visible();
    if (d.length < 2) return '';
    const step = W / (d.length - 1);
    return d.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
  });

  const fillPoints = createMemo<string>(() => {
    const d = visible();
    if (d.length < 2) return '';
    const step = W / (d.length - 1);
    const pts = d.map((v, i) => `${(i * step).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    return `0,${H()} ${pts} ${W},${H()}`;
  });

  /* ------------------------------------------------------------------ bar */
  interface Bar { x: number; y: number; bw: number; bh: number; }
  const bars = createMemo<Bar[]>(() => {
    const d = visible();
    if (d.length === 0) return [];
    const slotW = W / d.length;
    const bw = Math.max(1, slotW * 0.75);
    const gap = (slotW - bw) / 2;
    return d.map((v, i) => {
      const y = toY(v);
      return { x: i * slotW + gap, y, bw, bh: H() - PAD_BOTTOM - y };
    });
  });

  /* --------------------------------------------------------------- candle */
  /** Fixed slot width based on maxVisible so width never changes */
  const candleSlotW = () => W / maxVisible();

  interface Candle { x: number; cw: number; bodyY: number; bodyH: number; wickY: number; wickH: number; green: boolean; }
  const candles = createMemo<Candle[]>(() => {
    const d = visible();
    if (d.length < 2) return [];
    const slotW = candleSlotW();
    const cw = Math.max(2, slotW * 0.65);
    // Offset so candles fill from left; older candles on left, newest on right
    const startIdx = maxVisible() - d.length; // pad left when fewer than maxVisible
    const result: Candle[] = [];
    for (let i = 1; i < d.length; i++) {
      const open = d[i - 1];
      const close = d[i];
      const green = close >= open;
      const bodyTop = toY(Math.max(open, close));
      const bodyBot = toY(Math.min(open, close));
      const bodyH = Math.max(1.5, bodyBot - bodyTop);
      // Wick: extend 30% of body height beyond body on each side
      const wickExt = Math.max(2, bodyH * 0.3);
      const wickY = bodyTop - wickExt;
      const wickH = bodyH + wickExt * 2;
      result.push({
        x: (startIdx + i) * slotW,
        cw,
        bodyY: bodyTop,
        bodyH,
        wickY,
        wickH,
        green,
      });
    }
    return result;
  });

  const gradId = `mc-grad-${Math.random().toString(36).slice(2, 7)}`;

  /* ------------------------------------------------------------ Y labels */
  const yLabels = createMemo(() => {
    const { min, max, range } = bounds();
    return [
      { f: 1,    price: max },
      { f: 0.5,  price: min + range * 0.5 },
      { f: 0,    price: min },
    ];
  });

  return (
    <div class="mini-chart">
      <div class="mini-chart__inner">
        <svg
          class="mini-chart__svg"
          viewBox={`0 0 ${W} ${H()}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop class="mini-chart__grad-stop-top"    offset="0%"   stop-opacity="0.35" />
              <stop class="mini-chart__grad-stop-bottom" offset="100%" stop-opacity="0"    />
            </linearGradient>
          </defs>

          {/* Horizontal guide lines — horizontal geometry is fine with preserveAspectRatio=none */}
          {GUIDE_LEVELS.map(f => (
            <line
              class="mini-chart__guide"
              x1={0} y1={guideY(f)} x2={W} y2={guideY(f)}
            />
          ))}

          {/* Line chart */}
          {(props.type ?? 'line') === 'line' && linePoints() && (
            <>
              <polygon class="mini-chart__fill" points={fillPoints()} fill={`url(#${gradId})`} />
              <polyline class="mini-chart__line" points={linePoints()} fill="none" />
            </>
          )}

          {/* Bar chart */}
          {props.type === 'bar' && bars().map(b => (
            <rect class="mini-chart__bar"
              x={b.x} y={b.y} width={b.bw} height={b.bh} rx="1" />
          ))}

          {/* Candle chart */}
          {props.type === 'candle' && candles().map(c => (
            <>
              <rect
                class={`mini-chart__wick${c.green ? ' mini-chart__wick--green' : ' mini-chart__wick--red'}`}
                x={c.x - 0.5} y={c.wickY} width={1} height={c.wickH} />
              <rect
                class={`mini-chart__candle${c.green ? ' mini-chart__candle--green' : ' mini-chart__candle--red'}`}
                x={c.x - c.cw / 2} y={c.bodyY} width={c.cw} height={c.bodyH} rx="1" />
            </>
          ))}
        </svg>

        {/* Y-axis price labels — positioned overlay avoids SVG text distortion */}
        <div class="mini-chart__y-axis" aria-hidden="true">
          {yLabels().map(({ price }) => (
            <span class="mini-chart__y-label">{formatPrice(price)}</span>
          ))}
        </div>
      </div>
      {props.label && <div class="mini-chart__label">{props.label}</div>}
    </div>
  );
}
