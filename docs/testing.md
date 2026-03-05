# Testing

This document explains the test suite for the tiling window manager project: how to run tests, how each tier is configured, and how to write new tests.

---

## 1. Overview

The project uses a three-tier test pyramid:

| Tier | Runner | Environment | Config |
|---|---|---|---|
| Unit / integration | Vitest | jsdom (browser-like) | `vitest.config.ts` |
| Provider unit tests | Vitest | jsdom | `vitest.config.ts` |
| E2E / smoke | Vitest | Node.js (real HTTP) | `vitest.e2e.config.ts` |

**File counts**

- `src/**/__tests__/**/*.test.{ts,tsx}` — 45 test files covering UI components, layout engine, persistence, keyboard, drag-resize, panels, tiles, and more.
- `api/providers/__tests__/**/*.test.ts` — 2 test files covering API provider logic.
- `e2e/**/*.test.ts` — 1 test file (`smoke.test.ts`) that boots a real Vite dev server and makes HTTP requests.

Run `bun run test` to see the exact test count reported by Vitest on your machine; it varies as new tests are added.

---

## 2. Running tests

### Unit and integration tests

```bash
bun run test
```

Runs all tests matched by `vitest.config.ts` once and exits. Equivalent to `vitest run`.

```bash
bun run test:watch
```

Runs Vitest in interactive watch mode — re-runs affected tests on file save.

```bash
bun run test:coverage
```

Runs all unit/integration tests and produces a coverage report in `coverage/` (text summary, HTML, and lcov formats).

### E2E tests

```bash
bun run test:e2e
```

Boots a real Vite dev server on port 5174 inside the test process, runs the smoke suite, then shuts the server down. Uses `vitest.e2e.config.ts`.

### Type checking

```bash
bun run typecheck
```

Runs `tsc --noEmit` across the whole project. No test runner is involved; this is a pure TypeScript compilation check.

### Linting

```bash
bun run lint
```

Runs ESLint over `src/` and `e2e/` using the rules in `eslint.config.mjs`. Exit code is non-zero on any error.

```bash
bun run lint:fix
```

Same as above but rewrites fixable violations in place.

---

## 3. Unit and integration tests (Vitest)

### How vitest.config.ts works

The main config is defined in `vitest.config.ts` and merges on top of `vite.config.ts` so that the same Vite plugin pipeline (including `vite-plugin-solid` for JSX transform) applies during testing.

Key settings:

```
environment: 'jsdom'
```
Every test file runs inside a simulated browser DOM provided by jsdom. This allows components rendered with `@solidjs/testing-library` to interact with `document`, `window`, and DOM APIs without a real browser.

```
globals: false
```
Vitest globals (`describe`, `it`, `expect`, etc.) are not injected automatically. Every test file must import them explicitly from `vitest`. This keeps imports explicit and avoids accidental name shadowing.

```
pool: 'forks'
```
Each test file runs in a separate Node.js subprocess (fork). This provides full environmental isolation between files and is required when tests patch globals such as `EventSource`.

```
setupFiles: ['src/__tests__/setup.ts']
```
This file runs once per worker process before any test file. It installs global polyfills that jsdom does not provide (see section 4).

```
server.deps.inline: [/solid-js/, /@solidjs\//]
```
Forces all `solid-js` and `@solidjs/*` packages through Vite's transformation pipeline so that `resolve.conditions` selects the browser build of Solid.js rather than its SSR build. Without this, component primitives like `createSignal` behave incorrectly in tests.

**Coverage**

The `coverage` block uses the V8 provider and excludes `node_modules`, `fixtures`, `e2e`, config files, test files themselves, and barrel `index.ts` re-export files. Covered source is everything under `src/` and `api/providers/`.

### Test file locations

Unit and integration tests live alongside the code they test, inside `__tests__` subdirectories:

```
src/__tests__/              — top-level app and UI tests
src/tiles/__tests__/        — tile component tests
src/layout/__tests__/       — layout engine and tree tests
src/panels/__tests__/       — panel component tests
api/providers/__tests__/    — API provider tests
```

### Adding a new test file

1. Create a file named `<subject>.test.ts` or `<subject>.test.tsx` inside the relevant `__tests__/` directory.
2. Import test utilities explicitly:
   ```typescript
   import { describe, it, expect } from 'vitest';
   ```
3. Write tests using `describe` / `it` blocks.
4. Run `bun run test` — Vitest picks up any file matching the `include` glob automatically.

There is no registration step; the glob `src/**/__tests__/**/*.test.{ts,tsx}` discovers test files automatically.

---

## 4. MockEventSource

### Why it is needed

jsdom does not implement `EventSource`, the browser API for Server-Sent Events. Any component or module that calls `new EventSource(url)` at import time or inside a reactive effect will throw `ReferenceError: EventSource is not defined` in a jsdom environment.

### How setup.ts installs the mock

`src/__tests__/setup.ts` defines a minimal `MockEventSource` class and assigns it to `globalThis.EventSource` before any test file executes:

```typescript
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

  addEventListener(type: string, listener: EventListener): void { ... }
  removeEventListener(type: string, listener: EventListener): void { ... }
  close(): void { this.readyState = MockEventSource.CLOSED; }
  dispatchEvent(_event: Event): boolean { return false; }
}

Object.defineProperty(globalThis, 'EventSource', {
  value: MockEventSource,
  writable: true,
  configurable: true,
});
```

The global mock is intentionally minimal. It records listeners and exposes `close()`, but it never connects to a real server. Individual test files that need to simulate incoming events replace this global with a more capable local mock that adds an `emit()` helper (see `sse-bridge.test.tsx` as the canonical example).

### How to use MockEventSource in a new tile test

For tests that only need to prevent the `EventSource is not defined` error (i.e., the component opens a connection but the test does not need to simulate SSE messages), no extra setup is required. The global mock installed by `setup.ts` is sufficient.

For tests that need to emit SSE events and observe component behaviour, replace `window.EventSource` with a local mock that has an `emit` helper:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { afterEach } from 'vitest';
import { MyTile } from '../MyTile';

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
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
    this.listeners[type] = (this.listeners[type] ?? []).filter(h => h !== handler);
  }

  emit(type: string, data: string) {
    const evt = { type, data } as unknown as MessageEvent;
    (this.listeners[type] ?? []).forEach(h => h(evt));
  }

  close() {}
}

afterEach(() => {
  cleanup();
  MockEventSource.instances = [];
  delete (window as unknown as Record<string, unknown>).EventSource;
});

describe('MyTile', () => {
  it('updates on SSE message', () => {
    (window as unknown as Record<string, unknown>).EventSource = MockEventSource;

    const { getByText } = render(() => <MyTile channel="/events/my-tile" />);
    const source = MockEventSource.instances[0];

    source.emit('message', JSON.stringify({ value: 42 }));

    expect(getByText('42')).toBeTruthy();
  });
});
```

The `afterEach` block restores the global to the setup-installed mock so that later test files are not affected.

---

## 5. Fixture server

### What fixtures/server.ts does

`fixtures/server.ts` is a lightweight Node.js HTTP server used during tests to serve predictable HTML fragments and a Server-Sent Events stream. It has no external dependencies and is created with Node's built-in `node:http` module.

**Endpoints**

| Path | Method | Response |
|---|---|---|
| `/` | GET | JSON manifest: `{ service: "twm-fixtures", fragments: [...names] }` |
| `/fragment/:name` | GET | HTML fragment for `terminal`, `editor`, `browser`, `filetree`, or `empty` |
| `/fragment/:name` | GET (unknown name) | 404 with a plain-text error listing valid names |
| `/events` | GET | SSE stream; sends `connected` immediately, then `ping` every 5 seconds |
| any | OPTIONS | 204 CORS preflight |

All responses include permissive CORS headers (`Access-Control-Allow-Origin: *`) so that tests running in jsdom can fetch from the fixture server without cross-origin errors.

### How fixture-server.test.ts uses it

`src/__tests__/fixture-server.test.ts` imports `createFixtureServer` directly, starts the server on port 5175 in `beforeAll`, and tears it down in `afterAll`. Tests then use `fetch` to make real HTTP requests against the running server:

```typescript
import { createFixtureServer } from '../../fixtures/server';

beforeAll(() => new Promise<void>((resolve) => {
  server = createFixtureServer();
  server.listen(5175, resolve);
}));

afterAll(() => new Promise<void>((resolve, reject) => {
  server.close(err => err ? reject(err) : resolve());
}));
```

Port 5175 is deliberately different from the e2e server port (5174) to allow both to coexist.

### Adding new fixture endpoints

1. Open `fixtures/server.ts`.
2. Add a new `if` branch in the `handleRequest` function before the 404 fallback:
   ```typescript
   if (pathname === '/my-endpoint') {
     res.writeHead(200, { 'Content-Type': 'application/json', ...CORS });
     res.end(JSON.stringify({ hello: 'world' }));
     return;
   }
   ```
3. Add a corresponding test in `src/__tests__/fixture-server.test.ts`.
4. If the endpoint returns an HTML fragment, add an entry to the `fragments` record at the top of `fixtures/server.ts` and serve it via the existing `/fragment/:name` handler.

---

## 6. E2E tests

### vitest.e2e.config.ts vs the main config

The e2e config is a standalone `defineConfig` — it does not merge `vite.config.ts`. Key differences from the main config:

| Setting | Main config | E2E config |
|---|---|---|
| `environment` | `jsdom` | `node` |
| `include` | `src/**/__tests__/**/*.test.{ts,tsx}` | `e2e/**/*.test.ts` |
| `setupFiles` | `src/__tests__/setup.ts` | (none) |
| `testTimeout` | default (5 s) | 20 000 ms |
| `hookTimeout` | default | 20 000 ms |

The Node.js environment is used because e2e tests make real network requests using Node's `fetch` rather than rendering components in a DOM. The extended timeouts account for the time needed to boot the Vite dev server inside the test process.

### What smoke.test.ts covers

`e2e/smoke.test.ts` boots a real Vite dev server programmatically using `createServer` from the `vite` package, waits for it to be ready, and then makes `fetch` requests:

| Test | What it verifies |
|---|---|
| `responds with HTML containing title TWM` | Root route returns 200 and the page title is `TWM` |
| `serves main entry script` | `/src/main.ts` returns 200 |
| `HTML references a module script tag` | The root HTML contains `type="module"` |
| `serves tokens CSS file` | `/src/styles/tokens.css` returns 200 and contains `--twm-color-bg` |
| `App.tsx is served and is TypeScript/JSX` | `/src/App.tsx` returns 200 |

The server starts in `beforeAll` and is closed in `afterAll`. The 20-second timeout in the e2e config is required because Vite's initial build scan can take several seconds on first run.

### Running against the real dev server

By default `bun run test:e2e` starts the Vite server inside the test process. If you prefer to run against a separately started server, start the dev server manually (`bun run dev`) and then modify the `beforeAll` block to skip creating a new server. There is no built-in flag for this; the test currently always manages its own server lifecycle.

---

## 7. Writing a new tile test

This is a step-by-step walkthrough for adding a test file for a hypothetical `MyTile` component that renders a value received over SSE.

**Step 1 — Create the test file**

Create `src/tiles/__tests__/MyTile.test.tsx`. The `.tsx` extension is required for JSX.

**Step 2 — Import dependencies**

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@solidjs/testing-library';
import { MyTile } from '../MyTile';
```

**Step 3 — Define a local MockEventSource with an emit helper**

For components that use SSE, you need a mock that can push events into the component. See section 4 for the full pattern. If the component does not use SSE, you can skip this step — the global mock from `setup.ts` is already in place.

**Step 4 — Install the mock and render the component**

```typescript
it('renders the live value', () => {
  (window as unknown as Record<string, unknown>).EventSource = MockEventSource;

  const { getByText } = render(() => <MyTile channel="/events/my-tile" />);
  const source = MockEventSource.instances[0];

  // Emit a server-sent event with JSON payload
  source.emit('message', JSON.stringify({ value: 99 }));

  expect(getByText('99')).toBeTruthy();
  cleanup();
});
```

**Step 5 — Clean up after each test**

```typescript
afterEach(() => {
  cleanup();
  MockEventSource.instances = [];
  delete (window as unknown as Record<string, unknown>).EventSource;
});
```

`cleanup()` unmounts any components rendered with `@solidjs/testing-library` and removes their DOM nodes. Resetting `MockEventSource.instances` prevents one test from observing connections made by another. Deleting `window.EventSource` returns the global to the minimal mock installed by `setup.ts`.

**Step 6 — Run the test**

```bash
bun run test
```

Vitest discovers the new file automatically.

---

## 8. Lint guard test

`src/__tests__/lint-guard.test.ts` is an unusual test: it invokes the linter from inside the test runner.

### What it does

```
lint-guard
  eslint.config.mjs exists
  .prettierrc exists
  src passes ESLint with no errors
```

The third test calls `execSync('bun run lint --max-warnings 0', ...)` and asserts that the command exits successfully and that the output does not match `/error/i`. The timeout for this test is 30 seconds, matching the `execSync` timeout, because ESLint scans the full `src/` directory.

### Why it exists

Running ESLint as a test ensures that linting is gated by the same CI check that runs the unit tests. A developer who skips `bun run lint` before pushing will still get a lint failure reported alongside their test results when CI runs `bun run test`. It also verifies that `eslint.config.mjs` and `.prettierrc` exist in the repository root, catching accidental deletion of those config files.

---

## 9. CI

The following checks run in CI on every push and pull request:

| Step | Command |
|---|---|
| Type checking | `bun run typecheck` |
| Linting | `bun run lint` |
| Unit and integration tests | `bun run test` |
| E2E smoke tests | `bun run test:e2e` |
| Production build | `bun run build` |

All five steps must pass for a build to be considered green. The lint guard test (`lint-guard.test.ts`) means that `bun run test` also implicitly enforces linting, providing a second gate.

Coverage reporting is available via `bun run test:coverage` but is not currently enforced as a blocking CI step.
