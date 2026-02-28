import { describe, it, expect } from 'vitest';
import { render } from '@solidjs/testing-library';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { Sparkline } from '../../ui/Sparkline';

describe('Badge', () => {
  it('renders children', () => {
    const { container } = render(() => <Badge>Test</Badge>);
    expect(container.textContent).toContain('Test');
  });

  it('applies variant class', () => {
    const { container } = render(() => <Badge variant="success">ok</Badge>);
    expect(container.querySelector('.badge--success')).toBeTruthy();
  });

  it('defaults to neutral variant', () => {
    const { container } = render(() => <Badge>neutral</Badge>);
    expect(container.querySelector('.badge--neutral')).toBeTruthy();
  });

  it('sets data-variant attribute', () => {
    const { container } = render(() => <Badge variant="danger">!</Badge>);
    expect(container.querySelector('[data-variant="danger"]')).toBeTruthy();
  });
});

describe('Skeleton', () => {
  it('renders a single skeleton div', () => {
    const { container } = render(() => <Skeleton />);
    expect(container.querySelector('.skeleton')).toBeTruthy();
  });

  it('renders multiple line skeletons in a group', () => {
    const { container } = render(() => <Skeleton lines={3} />);
    const skeletons = container.querySelectorAll('.skeleton');
    expect(skeletons.length).toBe(3);
    expect(container.querySelector('.skeleton-group')).toBeTruthy();
  });

  it('applies width and height styles', () => {
    const { container } = render(() => <Skeleton width="80%" height="2em" />);
    const el = container.querySelector('.skeleton') as HTMLElement;
    expect(el.style.width).toBe('80%');
    expect(el.style.height).toBe('2em');
  });

  it('has aria-busy attribute', () => {
    const { container } = render(() => <Skeleton />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
  });
});

describe('Sparkline', () => {
  it('renders an SVG element', () => {
    const { container } = render(() => <Sparkline data={[1, 2, 3, 4]} />);
    expect(container.querySelector('svg.sparkline')).toBeTruthy();
  });

  it('renders a polyline with points', () => {
    const { container } = render(() => <Sparkline data={[10, 20, 30]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline).toBeTruthy();
    expect(polyline?.getAttribute('points')).toBeTruthy();
  });

  it('renders nothing meaningful with <2 data points', () => {
    const { container } = render(() => <Sparkline data={[5]} />);
    const polyline = container.querySelector('polyline');
    expect(polyline?.getAttribute('points')).toBe('');
  });

  it('respects custom width and height', () => {
    const { container } = render(() => <Sparkline data={[1, 2]} w={200} h={50} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.getAttribute('width')).toBe('200');
    expect(svg.getAttribute('height')).toBe('50');
  });
});
