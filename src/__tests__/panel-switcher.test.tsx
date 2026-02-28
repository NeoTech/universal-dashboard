import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { PanelSwitcher } from '../panels/PanelSwitcher';

afterEach(cleanup);

const TYPES = ['terminal', 'editor', 'browser', 'filetree'];

describe('PanelSwitcher', () => {
  it('renders a button/trigger for opening the switcher', () => {
    const { container } = render(() => (
      <PanelSwitcher types={TYPES} current="terminal" onSelect={vi.fn()} />
    ));
    expect(container.querySelector('.panel-switcher__trigger')).toBeTruthy();
  });

  it('shows the current content type on the trigger', () => {
    const { getByText } = render(() => (
      <PanelSwitcher types={TYPES} current="editor" onSelect={vi.fn()} />
    ));
    expect(getByText('editor')).toBeTruthy();
  });

  it('opens the dropdown on trigger click', () => {
    const { container } = render(() => (
      <PanelSwitcher types={TYPES} current="terminal" onSelect={vi.fn()} />
    ));
    expect(container.querySelector('.panel-switcher__list')).toBeNull();
    fireEvent.click(container.querySelector('.panel-switcher__trigger')!);
    expect(container.querySelector('.panel-switcher__list')).toBeTruthy();
  });

  it('renders all available types in the dropdown', () => {
    const { container } = render(() => (
      <PanelSwitcher types={TYPES} current="terminal" onSelect={vi.fn()} />
    ));
    fireEvent.click(container.querySelector('.panel-switcher__trigger')!);
    const options = container.querySelectorAll('.panel-switcher__option');
    expect(options.length).toBe(TYPES.length);
  });

  it('calls onSelect with the chosen type', () => {
    const onSelect = vi.fn();
    const { container } = render(() => (
      <PanelSwitcher types={TYPES} current="terminal" onSelect={onSelect} />
    ));
    fireEvent.click(container.querySelector('.panel-switcher__trigger')!);
    const options = container.querySelectorAll<HTMLButtonElement>('.panel-switcher__option');
    fireEvent.click(options[1]); // 'editor'
    expect(onSelect).toHaveBeenCalledWith('editor');
  });

  it('closes the dropdown after selecting', () => {
    const { container } = render(() => (
      <PanelSwitcher types={TYPES} current="terminal" onSelect={vi.fn()} />
    ));
    fireEvent.click(container.querySelector('.panel-switcher__trigger')!);
    fireEvent.click(container.querySelectorAll('.panel-switcher__option')[0]);
    expect(container.querySelector('.panel-switcher__list')).toBeNull();
  });
});
