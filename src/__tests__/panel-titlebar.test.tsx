import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { PanelTitleBar } from '../panels/PanelTitleBar';

afterEach(cleanup);

describe('PanelTitleBar', () => {
  it('renders the panel title', () => {
    const { getByText } = render(() => (
      <PanelTitleBar panelId="p1" title="Terminal" />
    ));
    expect(getByText('Terminal')).toBeTruthy();
  });

  it('renders a close button', () => {
    const { container } = render(() => (
      <PanelTitleBar panelId="p1" title="Editor" />
    ));
    expect(container.querySelector('.panel-titlebar__close')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(() => (
      <PanelTitleBar panelId="p1" title="Editor" onClose={onClose} />
    ));
    fireEvent.click(container.querySelector('.panel-titlebar__close')!);
    expect(onClose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith('p1');
  });

  it('has data-panel-id on root element', () => {
    const { container } = render(() => (
      <PanelTitleBar panelId="my-panel" title="Browser" />
    ));
    const root = container.querySelector('.panel-titlebar');
    expect(root?.getAttribute('data-panel-id')).toBe('my-panel');
  });

  it('marks panel as focused via data-focused when isFocused=true', () => {
    const { container } = render(() => (
      <PanelTitleBar panelId="p1" title="X" isFocused={true} />
    ));
    const root = container.querySelector('.panel-titlebar');
    expect(root?.hasAttribute('data-focused')).toBe(true);
  });

  it('does not set data-focused when isFocused=false', () => {
    const { container } = render(() => (
      <PanelTitleBar panelId="p1" title="X" isFocused={false} />
    ));
    const root = container.querySelector('.panel-titlebar');
    expect(root?.hasAttribute('data-focused')).toBe(false);
  });
});
