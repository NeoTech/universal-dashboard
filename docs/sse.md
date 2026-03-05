# SSE & Polling Subsystem

## Overview

The server pushes data to every connected browser through a **single shared
Server-Sent Events (SSE) connection** per browser tab.  All tile types —
regardless of their data source — subscribe to this one stream; the server
fans out named events so each tile only processes updates for its own channel.

Key properties of the design:

- **One TCP connection per tab** — no per-tile polling, no WebSocket upgrade.
- **Broadcast model** — the server iterates a `Set<ServerResponse>` and writes
  the same SSE frame to every connected client simultaneously.
- **Replay on reconnect** — a server-side `resourceCache` stores the latest
  payload for every channel; new connections receive the full cache immediately
  so tiles render without waiting for the next poll cycle.
- **Tile-aware polling** — each provider's poll loop calls `hasActiveTiles()`
  before making an external API request.  If no tile for that channel appears
  in any user's layout, the fetch is skipped — saving bandwidth and API quota.

---

## Server-side Architecture

### `sseClients` Set

```ts
const sseClients = new Set<ServerResponse>();
```

Holds one `ServerResponse` object per active SSE connection.  Entries are
added inside `handleSseStream()` (the `GET /api/sse` route handler) and
removed on the HTTP `close` event.  `broadcastSse` and `broadcastSseEphemeral`
iterate this set to fan out events.

### `resourceCache` Map

```ts
const resourceCache = new Map<string, unknown>();
```

Stores the most recent successful payload for every SSE channel.

- **Written by** `broadcastSse()` after each successful poll cycle.
- **Not written by** `broadcastSseEphemeral()` — ephemeral events (e.g. one-off
  notifications) are never replayed on reconnect.
- **Read by** `handleSseStream()` on every new connection: the handler iterates
  the map and writes every cached entry before the client starts receiving live
  events.

### `broadcastSse` vs `broadcastSseEphemeral`

| Function                  | Updates `resourceCache`? | Use case                          |
|---------------------------|:------------------------:|-----------------------------------|
| `broadcastSse()`          | Yes                      | Regular poll results (replayed)   |
| `broadcastSseEphemeral()` | No                       | One-shot events (layout changes)  |

### Keepalive heartbeat

The server writes a `: keepalive` SSE comment to every client every **25 seconds**.
This prevents NAT gateways, load balancers, and CDN edge nodes from silently
dropping the idle TCP connection.

### Replay on reconnect

When a client connects, `handleSseStream()`:

1. Writes HTTP headers (`text/event-stream`, `Cache-Control: no-cache`).
2. Iterates `resourceCache` and writes one SSE frame per entry.
3. Adds the `ServerResponse` to `sseClients`.
4. On `req.on('close')` removes it again.

This means tiles render immediately with the last-known data rather than
showing a blank skeleton until the next poll fires.

---

## Tile-aware Polling (`hasActiveTiles`)

### `CHANNEL_TO_TILE_TYPES` mapping

`CHANNEL_TO_TILE_TYPES` in `api/mcp-layout.ts` maps SSE channel names to the
tile `type` strings that consume them.  Only non-identity entries are needed
— channels where the SSE event name differs from the tile type, or where
multiple tile types share one broadcast channel.

See [Channel-to-type mapping table](#channel-to-type-mapping-table) below.

### `hasActiveTiles(channel)`

Before making an external API call, every provider's poll function calls:

```ts
if (!hasActiveTiles('github-runs')) return;
```

`hasActiveTiles`:

1. Resolves `channel` through `CHANNEL_TO_TILE_TYPES` to a set of tile type strings.
2. Iterates every `tile_layouts` row in SQLite.
3. Parses the JSON tile array and short-circuits on the first match.
4. Returns `false` (skip the poll) when no match is found.

This is evaluated on every poll interval, so a user who removes the last tile
of a given type will cause that provider's HTTP requests to stop at the next
scheduled tick — no restart required.

---

## Poll Lifecycle

```
Server startup
     |
     v
startPollers() called for each provider
     |
     +---> poll(channel, fn, intervalMs)
               |
               v
         [ setInterval fires ]
               |
               v
         hasActiveTiles(channel)?
          /            \
        No              Yes
         |               |
      (skip)       fn() — external API fetch
                         |
                    success?
                   /          \
                 No            Yes
                  |             |
              (log err)   broadcastSse(channel, data)
                               |
                         resourceCache.set(channel, data)
                               |
                         iterate sseClients
                               |
                         write SSE frame to each client
```

**Webhook mode branch**: when `WEBHOOK_MODE=true`, `startPollers()` registers
an HTTP route (`POST /api/refresh/:event`) instead of a `setInterval`.
An external system (e.g. a CI webhook) posts to that route to trigger an
immediate fetch, and `pollerRunFns` maps the event name to the corresponding
fetch function so `handleSseStream` can serve replayed data.

---

## Channel-to-type Mapping Table

Entries in `CHANNEL_TO_TILE_TYPES` in `api/mcp-layout.ts`.  Channels not
listed here use identity mapping (channel name === tile type).

| SSE Channel            | Tile Type(s)                                             |
|------------------------|----------------------------------------------------------|
| `github-runs`          | `github-actions`                                         |
| `cf-pages`             | `cloudflare-pages`                                       |
| `cf-workers`           | `cloudflare-functions`                                   |
| `paypal-data`          | `paypal-transactions`                                    |
| `coingecko-markets`    | `coingecko-prices`                                       |
| `hibp-breaches`        | `hibp-breach-status`, `hibp-recent-breaches`             |
| `plaid-accounts`       | `plaid-balances`                                         |
| `shodan-search`        | `shodan-exposed-services`, `shodan-vuln-summary`         |
| `virustotal-analyses`  | `virustotal-domain-threats`, `virustotal-url-scan`       |
| `hn-top-stories`       | `hn-top-stories`, `hn-mentions`                          |
| `reddit-posts`         | `reddit-posts`, `reddit-hot-posts`, `reddit-keyword-monitor` |

---

## Browser Hook (`useSseChannel`)

Located in `src/ui/useSseChannel.ts`.

### Singleton `EventSource`

A module-level `sharedEs` variable holds the one `EventSource` for the tab.
Reference counting (`refCount`) tracks how many `useSseChannel` hook instances
are currently mounted.

| Function        | Effect                                                         |
|-----------------|----------------------------------------------------------------|
| `acquireEs()`   | Increments `refCount`; opens a new connection if needed.       |
| `releaseEs()`   | Decrements `refCount`; closes and nulls `sharedEs` if it hits 0. |

### `channelListeners` registry

```ts
const channelListeners = new Map<string, Set<(e: MessageEvent<string>) => void>>();
```

A module-level map that survives `EventSource` replacement.  When
`acquireEs()` creates a new `EventSource` (because `sharedEs` was closed),
`setupEs()` re-iterates the map and re-attaches every listener — so tile
components that remained mounted continue receiving events without
re-registering themselves.

### `reconnectCallbacks` set

```ts
const reconnectCallbacks = new Set<() => void>();
```

Each `useSseChannel` hook registers a callback that resets `loading → true`.
All callbacks fire inside `es.onopen`, which triggers on both the initial
connection and every automatic browser reconnect.  This ensures tiles show a
skeleton while the server replays cached data rather than staying permanently
black after a network interruption.

### Module-level signals (`sseReceivedAt`, `sseRevision`)

| Export          | Type                    | Purpose                                           |
|-----------------|-------------------------|---------------------------------------------------|
| `sseReceivedAt` | `Map<string, number>`   | Epoch-ms timestamp of the last message per channel; read by `TileFooter` to display "Updated X ago". |
| `sseRevision`   | `Accessor<number>`      | Reactive counter incremented on every SSE message; components import it to react instantly. |
| `sseEnvStatus`  | `Accessor<Record<string, string[]>>` | Map of channel → missing env var names; populated by the server's `env-status` event; used by `BaseTile` to show configuration banners. |

---

## Connection Lifecycle Diagram

```
Tile mounts
    |
    v
onMount()
    |
    +---> acquireEs()
    |         |
    |         +-- (refCount was 0 or sharedEs closed)
    |         |       --> new EventSource(getSseUrl())
    |         |       --> setupEs(sharedEs)
    |         |             |
    |         |             +-- re-attach all channelListeners
    |         |             +-- attach env-status handler
    |         |             +-- set es.onopen = notify reconnectCallbacks
    |         |
    |         +-- (sharedEs already open)
    |               --> refCount++, reuse connection
    |
    +---> addChannelListener(eventName, onMessage)
    |         |
    |         +--> recorded in channelListeners registry
    |         +--> attached to sharedEs immediately
    |
    +---> reconnectCallbacks.add(onReconnect)
    |
    |   [ SSE message received ]
    |         |
    |         v
    |     onMessage(e)
    |         |
    |         +--> parse e.data
    |         +--> setData(), sseReceivedAt.set(), setSseRevision()
    |         +--> setLoading(false)
    |
    |   [ EventSource (re)connects ]
    |         |
    |         v
    |     es.onopen fires
    |         |
    |         +--> all reconnectCallbacks run
    |               --> setLoading(true) per hook
    |
Tile unmounts
    |
    v
onCleanup()
    |
    +---> removeChannelListener(eventName, onMessage)
    |         +--> removed from channelListeners registry
    |         +--> removed from sharedEs
    |
    +---> reconnectCallbacks.delete(onReconnect)
    |
    +---> releaseEs()
              |
              +-- refCount-- > 0 --> nothing
              |
              +-- refCount == 0
                    --> sharedEs.close()
                    --> sharedEs = null
```

---

## Resilience Mechanisms

| Mechanism                     | What it prevents                                                       |
|-------------------------------|------------------------------------------------------------------------|
| 25s keepalive comment         | Proxies and NAT gateways dropping the idle connection.                 |
| `channelListeners` registry   | Stale closure references silently dropping events after ES replacement. |
| `loading` reset in `onopen`   | Tiles showing a permanently blank state after a network interruption.  |
| `resourceCache` replay        | Cold-start blank tiles when the server has already fetched data.       |
| `hasActiveTiles()` gate       | Unnecessary external API calls when no tile needs the data.            |
| Animation burst debounce      | `TileGrid` batches rapid successive SSE messages to prevent layout thrash on reconnect. |

---

## Usage Example

Add a new tile component that consumes a custom SSE channel:

```tsx
// src/tiles/my-tile/MyTile.tsx
import { useSseChannel } from '../../ui/useSseChannel';
import BaseTile from '../../ui/BaseTile';

interface MyPayload {
  items: { id: string; name: string }[];
}

export default function MyTile() {
  // Subscribe to the 'my-channel' SSE event.
  // `initial` is returned until the first message arrives.
  const { data, loading, error } = useSseChannel<MyPayload>(
    'my-channel',
    { items: [] },
  );

  return (
    <BaseTile title="My Tile" loading={loading} error={error}>
      <ul>
        {data().items.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </BaseTile>
  );
}
```

On the server side, add a corresponding provider in `api/providers/` that
calls `broadcastSse('my-channel', payload)` and register it in `server.ts`
via `poll('my-channel', fetchFn, intervalMs)`.  If the channel name differs
from the tile type string, add an entry to `CHANNEL_TO_TILE_TYPES` in
`api/mcp-layout.ts` so `hasActiveTiles()` resolves it correctly.
