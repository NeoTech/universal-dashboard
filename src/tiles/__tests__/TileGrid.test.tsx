import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, cleanup } from '@solidjs/testing-library';
import { TileGrid } from '../TileGrid';
import { makeTile } from '../TileConfig';
import type { TileConfig } from '../TileConfig';

function noopRender(_t: TileConfig) {
  return <div class="mock-content">content</div>;
}

describe('TileGrid', () => {
  it('renders all tiles', () => {
    const tiles = [makeTile('stripe-payments'), makeTile('stripe-orders')];
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} />
    ));
    expect(container.querySelectorAll('.tile').length).toBe(2);
    cleanup();
  });

  it('renders tile type as data attribute', () => {
    const tiles = [makeTile('stripe-payments')];
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} />
    ));
    expect(container.querySelector('[data-tile-type="stripe-payments"]')).toBeTruthy();
    cleanup();
  });

  it('renders tile title in title bar', () => {
    const tiles = [makeTile('stripe-revenue', { title: 'Revenue' })];
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} />
    ));
    expect(container.querySelector('.tile__title')?.textContent).toContain('Revenue');
    cleanup();
  });

  it('remove button calls onRemoveTile', () => {
    const tiles = [makeTile('stripe-payments', { id: 'tile-1' })];
    const onRemove = vi.fn();
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} onRemoveTile={onRemove} />
    ));
    fireEvent.click(container.querySelector('.tile__close')!);
    expect(onRemove).toHaveBeenCalledWith('tile-1');
    cleanup();
  });

  it('tiles are positioned absolutely from config', () => {
    const tiles = [makeTile('stripe-orders', { id: 'tile-pos', x: 48, y: 96 })];
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} />
    ));
    const tileEl = container.querySelector('[data-tile-id="tile-pos"]') as HTMLElement;
    expect(tileEl.style.left).toBe('48px');
    expect(tileEl.style.top).toBe('96px');
    cleanup();
  });

  it('renders resize handle', () => {
    const tiles = [makeTile('stripe-payments')];
    const { container } = render(() => (
      <TileGrid tiles={tiles} onLayoutChange={() => undefined} renderTile={noopRender} />
    ));
    expect(container.querySelector('.tile__resize-handle')).toBeTruthy();
    cleanup();
  });
});
