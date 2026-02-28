import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { PanelContent } from '../panels/PanelContent';

afterEach(() => cleanup());

const BASE_URL = 'http://localhost:5174';

describe('PanelContent', () => {
  it('renders with hx-get pointing to the correct fragment URL', () => {
    const { container } = render(() => (
      <PanelContent panelId="p1" contentType="terminal" fixtureBaseUrl={BASE_URL} />
    ));
    const loader = container.querySelector('[hx-get]') as HTMLElement;
    expect(loader).not.toBeNull();
    expect(loader.getAttribute('hx-get')).toBe(`${BASE_URL}/fragment/terminal`);
  });

  it('sets hx-trigger to "load" for auto-fetch', () => {
    const { container } = render(() => (
      <PanelContent panelId="p1" contentType="editor" fixtureBaseUrl={BASE_URL} />
    ));
    const loader = container.querySelector('[hx-trigger]') as HTMLElement;
    expect(loader?.getAttribute('hx-trigger')).toBe('load');
  });

  it('sets hx-swap to innerHTML', () => {
    const { container } = render(() => (
      <PanelContent panelId="p2" contentType="terminal" fixtureBaseUrl={BASE_URL} />
    ));
    const loader = container.querySelector('[hx-swap]') as HTMLElement;
    expect(loader?.getAttribute('hx-swap')).toBe('innerHTML');
  });

  it('applies the panel-id as data attribute', () => {
    const { container } = render(() => (
      <PanelContent panelId="my-panel" contentType="terminal" fixtureBaseUrl={BASE_URL} />
    ));
    const root = container.firstElementChild as HTMLElement;
    expect(root?.getAttribute('data-panel-id')).toBe('my-panel');
  });

  it('shows a loading indicator by default', () => {
    const { container } = render(() => (
      <PanelContent panelId="p1" contentType="terminal" fixtureBaseUrl={BASE_URL} />
    ));
    // Should have some fallback content while loading
    expect(container.textContent?.trim().length).toBeGreaterThan(0);
  });
});
