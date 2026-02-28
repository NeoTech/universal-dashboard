import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { App } from '../App';
import { DEFAULT_CONFIG } from '../config/config';

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('App', () => {
  it('renders without crashing', () => {
    expect(() => render(() => <App config={DEFAULT_CONFIG} />)).not.toThrow();
  });

  it('renders the status bar', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    expect(container.querySelector('.status-bar')).toBeTruthy();
  });

  it('renders at least one panel', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    expect(container.querySelector('.panel')).toBeTruthy();
  });

  it('applies the configured theme via data-theme', () => {
    render(() => <App config={{ ...DEFAULT_CONFIG, theme: 'dark' }} />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('shows command palette when mod+p is pressed', () => {
    const { container } = render(() => <App config={DEFAULT_CONFIG} />);
    // Palette should be hidden initially
    expect(container.querySelector('.command-palette')).toBeNull();
    // Simulate Ctrl+P
    fireEvent.keyDown(document.body, { key: 'p', ctrlKey: true });
    expect(container.querySelector('.command-palette')).toBeTruthy();
  });
});
