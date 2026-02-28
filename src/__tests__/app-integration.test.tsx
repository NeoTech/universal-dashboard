import { describe, it, expect } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { App } from '../App';
import { DEFAULT_CONFIG } from '../config/config';

describe('App integration smoke', () => {
  it('renders the app root element', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    expect(container.querySelector('.twm-app')).toBeTruthy();
    cleanup();
  });

  it('renders the status bar', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    expect(container.querySelector('.status-bar')).toBeTruthy();
    cleanup();
  });

  it('command palette is hidden by default', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    expect(container.querySelector('.command-palette')).toBeNull();
    cleanup();
  });

  it('Ctrl+P opens the command palette', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(container.querySelector('.command-palette')).toBeTruthy();
    cleanup();
  });

  it('command palette lists registered commands', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    const items = container.querySelectorAll('.command-palette__item');
    expect(items.length).toBeGreaterThan(0);
    cleanup();
  });

  it('Escape closes the command palette', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    expect(container.querySelector('.command-palette')).toBeTruthy();
    const input = container.querySelector('.command-palette__input') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(container.querySelector('.command-palette')).toBeNull();
    cleanup();
  });

  it('palette filters commands by label', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    fireEvent.keyDown(document, { key: 'p', ctrlKey: true });
    const input = container.querySelector('.command-palette__input') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'new dashboard' } });
    const items = container.querySelectorAll('.command-palette__item');
    expect(items.length).toBe(1);
    expect(items[0].textContent?.toLowerCase()).toContain('new dashboard');
    cleanup();
  });
});
