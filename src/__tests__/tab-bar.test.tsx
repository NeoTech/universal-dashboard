import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup, fireEvent } from '@solidjs/testing-library';
import { TabBar } from '../ui/TabBar';
import type { Tab } from '../ui/TabBar';

afterEach(cleanup);

const TABS: Tab[] = [
  { id: 't1', label: 'shell', contentType: 'terminal' },
  { id: 't2', label: 'index.ts', contentType: 'editor' },
  { id: 't3', label: 'localhost', contentType: 'browser' },
];

describe('TabBar', () => {
  it('renders all tabs', () => {
    const { container } = render(() => (
      <TabBar tabs={TABS} activeTabId="t1" onTabSelect={vi.fn()} />
    ));
    expect(container.querySelectorAll('.tab-bar__tab').length).toBe(TABS.length);
  });

  it('marks the active tab with aria-selected', () => {
    const { container } = render(() => (
      <TabBar tabs={TABS} activeTabId="t2" onTabSelect={vi.fn()} />
    ));
    const tabs = container.querySelectorAll<HTMLElement>('.tab-bar__tab');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
  });

  it('calls onTabSelect with tab id on click', () => {
    const onTabSelect = vi.fn();
    const { container } = render(() => (
      <TabBar tabs={TABS} activeTabId="t1" onTabSelect={onTabSelect} />
    ));
    fireEvent.click(container.querySelectorAll('.tab-bar__tab')[1]);
    expect(onTabSelect).toHaveBeenCalledWith('t2');
  });

  it('renders close buttons on each tab', () => {
    const { container } = render(() => (
      <TabBar tabs={TABS} activeTabId="t1" onTabSelect={vi.fn()} onTabClose={vi.fn()} />
    ));
    expect(container.querySelectorAll('.tab-bar__close').length).toBe(TABS.length);
  });

  it('calls onTabClose with tab id when close button clicked', () => {
    const onTabClose = vi.fn();
    const { container } = render(() => (
      <TabBar tabs={TABS} activeTabId="t1" onTabSelect={vi.fn()} onTabClose={onTabClose} />
    ));
    fireEvent.click(container.querySelectorAll('.tab-bar__close')[2]);
    expect(onTabClose).toHaveBeenCalledWith('t3');
  });

  it('renders tab labels', () => {
    const { getByText } = render(() => (
      <TabBar tabs={TABS} activeTabId="t1" onTabSelect={vi.fn()} />
    ));
    expect(getByText('shell')).toBeTruthy();
    expect(getByText('index.ts')).toBeTruthy();
  });
});
