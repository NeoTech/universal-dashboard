import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { AriaPanel } from '../ui/AriaPanel';

afterEach(cleanup);

describe('AriaPanel (ARIA accessibility)', () => {
  it('has role="region"', () => {
    const { container } = render(() => (
      <AriaPanel panelId="p1" label="Terminal">
        <div>content</div>
      </AriaPanel>
    ));
    expect(container.querySelector('[role="region"]')).toBeTruthy();
  });

  it('has aria-label matching the label prop', () => {
    const { container } = render(() => (
      <AriaPanel panelId="p1" label="My Editor">
        <div />
      </AriaPanel>
    ));
    const region = container.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('My Editor');
  });

  it('has a non-negative tabIndex for keyboard focus', () => {
    const { container } = render(() => (
      <AriaPanel panelId="p1" label="Terminal">
        <div />
      </AriaPanel>
    ));
    const region = container.querySelector<HTMLElement>('[role="region"]')!;
    expect(region.tabIndex).toBeGreaterThanOrEqual(0);
  });

  it('sets aria-current="true" when isFocused=true', () => {
    const { container } = render(() => (
      <AriaPanel panelId="p1" label="Focused" isFocused={true}>
        <div />
      </AriaPanel>
    ));
    const region = container.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-current')).toBe('true');
  });

  it('does not set aria-current when isFocused=false', () => {
    const { container } = render(() => (
      <AriaPanel panelId="p1" label="Normal" isFocused={false}>
        <div />
      </AriaPanel>
    ));
    const region = container.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-current')).toBeNull();
  });

  it('renders children inside the region', () => {
    const { getByText } = render(() => (
      <AriaPanel panelId="p1" label="Test">
        <span>panel content</span>
      </AriaPanel>
    ));
    expect(getByText('panel content')).toBeTruthy();
  });
});
