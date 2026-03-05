# Provider Framework

This document describes the provider registration pattern used by the TWM API
server, how to add a new data source end-to-end, and the runtime conventions
shared by all providers.

---

## Overview

Each data source (Stripe, GitHub, Cloudflare, …) lives in its own file under
`api/providers/`. Every provider file exports a single `register()` function
with the signature:

```ts
export function register(ctx: ServerContext): ProviderRouteHandler
```

At server startup `api/server.ts` calls every `register()`, passing a shared
`ServerContext` object that exposes the SSE engine, polling infrastructure, and
utility helpers. The returned `ProviderRouteHandler` is appended to
`providerHandlers[]`; incoming HTTP requests are walked through this array
until a handler returns `true` to claim the request.

---

## ServerContext

`ServerContext` is defined in `api/providers/types.ts`. It is the
dependency-injection object injected into every `register()` call.

| Field | Type | Description |
|---|---|---|
| `json` | `JsonFn` | Write a JSON body with CORS headers. `json(res, 200, data)` |
| `readBody` | `ReadBodyFn` | Read the full HTTP request body as a UTF-8 string. |
| `route` | `RouteFn` | Execute an async handler; writes `200` on success or `502` on error. Eliminates boilerplate try/catch in route handlers. |
| `poll` | `(event, ms, fn) => void` | Register a recurring SSE poller. Calls `fn` once immediately, then on a `setInterval`. See [Poll intervals](#poll-interval-env-var-convention). |
| `broadcastSse` | `(event, data) => void` | Broadcast an event to all connected SSE clients **and** cache the payload in `resourceCache` for replay on reconnect. |
| `broadcastSseEphemeral` | `(event, data) => void` | Broadcast an event to all current clients **without** caching it. Use for one-shot commands (e.g. `tile-op`) that must not be replayed. |
| `resourceCache` | `Map<string, unknown>` | Read-only view of the SSE cache. Keyed by event name. Populated by `broadcastSse()`. |
| `refreshRegistry` | `Map<string, () => Promise<void>>` | On-demand refresh functions keyed by channel name. Populated by `poll()`. Webhook handlers use this to trigger an immediate re-fetch. |
| `STRIPE_API_URL` | `string` | Stripe REST base URL. Defaults to `https://api.stripe.com`. Override via env for tests. |
| `GITHUB_API_URL` | `string` | GitHub REST base URL. Defaults to `https://api.github.com`. |
| `CLOUDFLARE_API_URL` | `string` | Cloudflare API base URL. Defaults to `https://api.cloudflare.com/client/v4`. |
| `PAYPAL_API_URL` | `string` | PayPal API base URL. Empty string defers to `PAYPAL_ENV` logic in the PayPal provider. |
| `BACKEND_BASE_URL` | `string` | Optional prefix prepended to relative proxy URLs used by Custom API tiles. |

---

## Adding a new provider end-to-end

The following steps use a hypothetical `myprovider` as the example name.

### 1. Create `api/providers/myprovider.ts`

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ServerContext, ProviderRouteHandler } from './types.ts';

export function register(ctx: ServerContext): ProviderRouteHandler {
  // ... set up pollers and return a route handler (steps 2–3 below)
}
```

### 2. Implement `register(ctx)` — use `ctx.poll()` and `ctx.route()`

```ts
export function register(ctx: ServerContext): ProviderRouteHandler {
  const token = process.env['MYPROVIDER_TOKEN'];

  if (token) {
    const ms = parseInt(process.env['MYPROVIDER_POLL_MS'] ?? '60000', 10);

    ctx.poll('myprovider-data', ms, async () => {
      const res = await fetch('https://api.myprovider.com/data', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.json();
    });
  }

  return async (
    req: IncomingMessage,
    res: ServerResponse,
    _url: URL,
    path: string,
    method: string,
    body: string,
  ): Promise<boolean> => {
    if (!path.startsWith('/api/myprovider/')) return false;

    if (path === '/api/myprovider/data' && method === 'GET') {
      return ctx.route(res, async () => {
        const r = await fetch('https://api.myprovider.com/data', {
          headers: { Authorization: `Bearer ${token ?? ''}` },
        });
        return r.json();
      }),
      true;
    }

    ctx.json(res, 404, { error: `Unknown route: ${method} ${path}` });
    return true;
  };
}
```

Key conventions:
- Return `false` immediately when the path does not belong to this provider.
- Return `true` after writing a response (even error responses).
- Use `ctx.route(res, fn)` for async fetches; it handles the try/catch and
  writes a `502` response on error so you do not need to.
- Use `ctx.json(res, status, data)` for manual responses.

### 3. Export the `register` function

The function is already exported by the `export function register` declaration.
No additional step needed.

### 4. Import and call `register()` in `api/server.ts`

```ts
// At the top with the other provider imports:
import { register as registerMyprovider } from './providers/myprovider.ts';

// Inside startPollers(), in the providerHandlers.push() call:
providerHandlers.push(
  // ... existing providers ...
  registerMyprovider(ctx),
);
```

### 5. Register env vars and channel mappings

**`api/server.ts` — `CHANNEL_ENV_MAP`**

Add an entry so the `env-status` broadcast tells tiles which env vars are
needed:

```ts
'myprovider-data': ['MYPROVIDER_TOKEN'],
```

**`api/mcp-layout.ts` — `CHANNEL_TO_TILE_TYPES`**

Map the SSE channel name to the tile type(s) that consume it. This is used by
`hasActiveTiles()` to skip polling when no tiles of that type are on screen:

```ts
'myprovider-data': ['myprovider-data'],
```

**`src/tiles/TileConfig.ts` — `TILE_DEFAULTS`**

Add a `TILE_DEFAULTS` entry for the default tile dimensions and label:

```ts
'myprovider-data': { w: 6, h: 4, title: 'My Provider' },
```

Also add `'myprovider-data'` to the `TileType` union at the top of the file.

### 6. Create the tile component and register it

1. Create `src/tiles/myprovider/MyProviderTile.tsx` (or an appropriate
   subdirectory).
2. Register the tile type in `src/tiles/tileRegistry.ts`.
3. Add a `case 'myprovider-data':` branch to `src/renderer/renderTile.tsx` (or
   the equivalent rendering switch).

---

## Poll interval env var convention

Every provider that registers a poller reads its interval from a dedicated
environment variable. The naming convention is:

```
POLL_INTERVAL_<PROVIDER>_<CHANNEL_SUFFIX>
```

In practice most providers use a simpler short-form, for example:

| Provider | Env var | Default | Channels affected |
|---|---|---|---|
| Stripe | `STRIPE_POLL_MS` | `30000` | payments, refunds, webhooks |
| Stripe | `STRIPE_SLOW_POLL_MS` | `60000` | products, subscriptions, customers, invoices |
| Stripe | `STRIPE_REVENUE_POLL_MS` | `300000` | revenue |
| GitHub | `GITHUB_POLL_MS` | `60000` | github-runs |

Default values are set inside each provider's `register()` using
`parseInt(process.env['PROVIDER_POLL_MS'] ?? '<default>', 10)`.

### Overriding at runtime via `poll-settings.json`

The client can override any channel's interval at runtime by sending
`PATCH /api/poll/:event` with `{ "intervalMs": <ms> }`. The server persists
the override to `poll-settings.json` and reloads it on restart. The file
format is:

```json
{
  "paused": ["stripe-revenue"],
  "intervals": {
    "github-runs": 120000
  },
  "webhookChannels": ["stripe-payments"]
}
```

A poller can also be **paused** by setting `intervalMs` to `0` via the same
endpoint. Paused channels are listed in `poll-settings.json` under `paused`.

---

## Webhook mode

Some providers support real-time push delivery via webhooks as an alternative
to periodic polling.

### Detection

Webhook mode is auto-detected at startup: if a provider's webhook-secret env
var is configured (e.g. `STRIPE_WEBHOOK_SECRET`, `GITHUB_WEBHOOK_SECRET`),
the server suspends the polling interval for the related channels and marks
them as webhook-driven. Affected channels are also written to
`poll-settings.json` under `webhookChannels` so the mode persists across
restarts.

Webhook mode can also be set explicitly from the client via
`PATCH /api/poll/:event` with `{ "deliveryMode": "webhook" }`.

### Inbound webhook endpoints

Each provider registers a unified inbound endpoint under
`POST /api/webhooks/<provider>` (e.g. `POST /api/webhooks/stripe`). When a
webhook arrives the handler:

1. Verifies the signature using the provider's webhook secret.
2. Determines which SSE channel(s) the event affects.
3. Calls `ctx.refreshRegistry.get(channel)()` for each affected channel to
   trigger an immediate re-fetch and broadcast, replacing the cached data.

### Initial fetch in webhook mode

Even when a channel is in webhook mode, `ctx.poll()` still performs one
initial data fetch at startup so tiles are populated immediately without
waiting for the first webhook event.

---

## SSE cache semantics

### What is stored

`resourceCache` is a `Map<string, unknown>` that holds the most-recently
broadcast payload for every SSE channel. It is the single source of truth for
"current state" of each channel.

### When it is replaced vs. appended

`broadcastSse(event, data)` always **replaces** the value for `event` in
`resourceCache`. There is no append or merge; the new payload fully supersedes
the previous one. Tile components therefore receive the complete dataset on
every SSE event and are responsible for rendering it in full.

`broadcastSseEphemeral(event, data)` **never writes** to `resourceCache`. Use
it for one-shot commands (e.g. `tile-op` layout mutations) that clients must
only react to once and that must not be replayed.

### How new clients get replayed data on connect

When a new browser tab opens an SSE connection (`GET /api/events`), the
`handleSseStream()` handler immediately iterates `resourceCache` and writes
every cached event to the response stream before adding the client to
`sseClients`. This means tiles render with current data as soon as the
connection opens — they do not have to wait for the next poll cycle.

### Cache lifecycle

Entries live for the entire server process lifetime. There is no TTL or
eviction. An entry is overwritten by the next successful fetch for that
channel, and overwritten with `{ error: "..." }` if a poll cycle fails.

---

## Route handler pattern

### Registration

`ctx.route()` is a convenience wrapper (type `RouteFn`) that runs an async
factory and writes the result as a `200 OK` JSON response. If the factory
throws, a `502 Bad Gateway` JSON response is written instead:

```ts
ctx.route(res, async () => {
  const data = await fetchSomething();
  return data; // serialised as JSON with status 200
});
```

For responses that require a non-`200` status, call `ctx.json()` directly:

```ts
ctx.json(res, 404, { error: 'Not found' });
return true;
```

### HTTP method conventions

| Method | Purpose |
|---|---|
| `GET` | Read / list resource(s). Never mutate state. |
| `POST` | Create a new resource or trigger an action (e.g. `/capture`, `/resume`). |
| `PATCH` | Partial update of an existing resource. |
| `DELETE` | Delete or cancel a resource. |

### Error response format

All error responses use the same JSON shape:

```json
{ "error": "<human-readable message>" }
```

Status codes:
- `400` — client sent invalid input (bad JSON, missing required field, etc.)
- `404` — route not matched within this provider
- `500` — unexpected server-side error (thrown by route handler)
- `502` — upstream API call failed (propagated by `ctx.route()`)
- `503` — provider not configured (e.g. missing API key)

### Route handler return value

Every `ProviderRouteHandler` must return a `boolean` (or `Promise<boolean>`):

- `true` — the request was handled; `res` has already been written.
- `false` — this provider does not own the request; pass to the next handler.

A provider must **not** write to `res` and then return `false`, and must
**not** return `true` without having written a complete response.
