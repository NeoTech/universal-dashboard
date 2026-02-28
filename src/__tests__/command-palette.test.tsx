import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { CommandPalette } from '../ui/CommandPalette';
import type { Command } from '../ui/CommandPalette';

afterEach(cleanup);

const COMMANDS: Command[] = [
  { id: 'split-h', label: 'Split Horizontal', run: vi.fn() },
  { id: 'split-v', label: 'Split Vertical', run: vi.fn() },
  { id: 'close-panel', label: 'Close Panel', run: vi.fn() },
  { id: 'new-workspace', label: 'New Workspace', run: vi.fn() },
];

describe('CommandPalette', () => {
  it('is not visible when isOpen=false', () => {
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={() => false} />
    ));
    const palette = container.querySelector('.command-palette');
    expect(palette).toBeNull();
  });

  it('is visible when isOpen=true', () => {
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={() => true} />
    ));
    expect(container.querySelector('.command-palette')).toBeTruthy();
  });

  it('renders all commands initially', () => {
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={() => true} />
    ));
    const items = container.querySelectorAll('.command-palette__item');
    expect(items.length).toBe(COMMANDS.length);
  });

  it('filters commands by query', () => {
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={() => true} />
    ));
    const input = container.querySelector<HTMLInputElement>('.command-palette__input')!;
    fireEvent.input(input, { target: { value: 'split' } });
    const items = container.querySelectorAll('.command-palette__item');
    expect(items.length).toBe(2); // "Split Horizontal" and "Split Vertical"
  });

  it('calls run callback when a command item is clicked', () => {
    const onRun = vi.fn();
    const cmds: Command[] = [{ id: 'cmd-a', label: 'Do Something', run: onRun }];
    const { container } = render(() => (
      <CommandPalette commands={cmds} isOpen={() => true} />
    ));
    fireEvent.click(container.querySelector('.command-palette__item')!);
    expect(onRun).toHaveBeenCalledOnce();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={() => true} onClose={onClose} />
    ));
    fireEvent.keyDown(container.querySelector('.command-palette__input')!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('clears query when reopened', () => {
    const [open, setOpen] = createSignal(true);
    const { container } = render(() => (
      <CommandPalette commands={COMMANDS} isOpen={open} />
    ));
    const input = container.querySelector<HTMLInputElement>('.command-palette__input')!;
    fireEvent.input(input, { target: { value: 'workspace' } });
    expect(input.value).toBe('workspace');
    // Close and reopen
    setOpen(false);
    setOpen(true);
    const refreshedInput = container.querySelector<HTMLInputElement>('.command-palette__input')!;
    expect(refreshedInput.value).toBe('');
  });
});
