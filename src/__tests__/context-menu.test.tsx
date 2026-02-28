import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { ContextMenu } from '../ui/ContextMenu';
import type { MenuItem } from '../ui/ContextMenu';

afterEach(cleanup);

const ITEMS: MenuItem[] = [
  { id: 'split-h', label: 'Split Horizontal' },
  { id: 'split-v', label: 'Split Vertical' },
  { id: 'close', label: 'Close Panel' },
  { id: 'disabled-action', label: 'Unavailable', disabled: true },
];

describe('ContextMenu', () => {
  it('renders nothing when isOpen=false', () => {
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 100, y: 200 }} isOpen={() => false} />
    ));
    expect(container.querySelector('.context-menu')).toBeNull();
  });

  it('renders menu when isOpen=true', () => {
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 100, y: 200 }} isOpen={() => true} />
    ));
    expect(container.querySelector('.context-menu')).toBeTruthy();
  });

  it('positions the menu at the given coordinates', () => {
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 150, y: 75 }} isOpen={() => true} />
    ));
    const menu = container.querySelector<HTMLElement>('.context-menu')!;
    expect(menu.style.left).toBe('150px');
    expect(menu.style.top).toBe('75px');
  });

  it('renders all menu items', () => {
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 0, y: 0 }} isOpen={() => true} />
    ));
    expect(container.querySelectorAll('.context-menu__item').length).toBe(ITEMS.length);
  });

  it('calls onSelect with item id when item is clicked', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 0, y: 0 }} isOpen={() => true} onSelect={onSelect} />
    ));
    const items = container.querySelectorAll<HTMLElement>('.context-menu__item');
    fireEvent.click(items[0]);
    expect(onSelect).toHaveBeenCalledWith('split-h');
  });

  it('does not call onSelect for disabled items', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <ContextMenu items={ITEMS} position={{ x: 0, y: 0 }} isOpen={() => true} onSelect={onSelect} />
    ));
    const disabledItem = container.querySelector('.context-menu__item[data-disabled="true"]')!;
    fireEvent.click(disabledItem);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('calls onClose when clicking outside', () => {
    const onClose = vi.fn();
    render(() => (
      <ContextMenu items={ITEMS} position={{ x: 0, y: 0 }} isOpen={() => true} onClose={onClose} />
    ));
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
