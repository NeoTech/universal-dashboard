import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { SseBridge } from '../panels/SseBridge';

// Minimal EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((e: MessageEvent) => void) | null = null;
  listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(handler);
  }

  removeEventListener(type: string, handler: (e: MessageEvent) => void) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(h => h !== handler);
  }

  emit(type: string, data: string) {
    const evt = { type, data } as unknown as MessageEvent;
    (this.listeners[type] ?? []).forEach(h => h(evt));
  }

  close() {}
}

describe('SseBridge', () => {
  afterEach(() => {
    cleanup();
    MockEventSource.instances = [];
    // restore
    if ('EventSource' in window) {
      delete (window as unknown as Record<string, unknown>).EventSource;
    }
  });

  function setup(onReload = vi.fn()) {
    (window as unknown as Record<string, unknown>).EventSource = MockEventSource;
    const result = render(() => (
      <SseBridge eventsUrl="/events" onReload={onReload}>
        <div id="child">panel</div>
      </SseBridge>
    ));
    const source = MockEventSource.instances[0];
    return { ...result, source, onReload };
  }

  it('renders children', () => {
    const { getByText } = setup();
    expect(getByText('panel')).toBeTruthy();
  });

  it('connects to the provided eventsUrl', () => {
    const { source } = setup();
    expect(source).toBeDefined();
    expect(source.url).toBe('/events');
  });

  it('calls onReload when a reload SSE event fires', () => {
    const { source, onReload } = setup();
    source.emit('reload', '');
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('does not call onReload for other SSE event types', () => {
    const { source, onReload } = setup();
    source.emit('ping', '');
    source.emit('message', '');
    expect(onReload).not.toHaveBeenCalled();
  });

  it('can be rendered without onReload (optional prop)', () => {
    (window as unknown as Record<string, unknown>).EventSource = MockEventSource;
    expect(() =>
      render(() => (
        <SseBridge eventsUrl="/events">
          <div>hi</div>
        </SseBridge>
      ))
    ).not.toThrow();
    cleanup();
    MockEventSource.instances = [];
  });
});
