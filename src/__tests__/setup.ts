/**
 * Vitest global test setup.
 * Polyfills browser APIs that jsdom does not provide.
 */

// --- EventSource mock --------------------------------------------------
// jsdom does not implement EventSource; stub it so useSseChannel can be
// imported in tests without throwing "EventSource is not defined".
class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  readyState: number = MockEventSource.CONNECTING;
  url: string;

  private listeners: Record<string, EventListener[]> = {};

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: EventListener): void {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: EventListener): void {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter((l) => l !== listener);
    }
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  dispatchEvent(_event: Event): boolean {
    return false;
  }
}

Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  writable: true,
  configurable: true,
});

// --- ResizeObserver mock -----------------------------------------------
// jsdom does not implement ResizeObserver; stub it so useFlintDensity
// can be imported in tests without throwing "ResizeObserver is not defined".
class MockResizeObserver {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
}

Object.defineProperty(globalThis, 'ResizeObserver', {
  value: MockResizeObserver,
  writable: true,
  configurable: true,
});
