# Frontend Architecture

## Overview

The dashboard UI is a SolidJS single-page application bundled with Vite.

- **SolidJS** provides fine-grained reactivity via signals and effects — there
  is no virtual DOM; components compile to direct DOM operations.
- **Vite** serves the app in development (`bun run dev`) and produces an
  optimised static bundle for production.
- **SSE (Server-Sent Events)** streams live data from the API server to every
  open tile. The `useSseChannel` hook wraps a single shared `EventSource` per
  channel so all tiles sharing a channel receive the same push event without
  opening redundant connections.
- **Alpine.js** is loaded as a script tag for lightweight progressive
  enhancements (live clock in the status bar) that do not require Solid's
  render cycle.

---

## Signal topology

```
DashboardManager  (class, not reactive)
  │  .ids[]  .activeIndex
  ▼
App  (creates signals from DashboardManager state)
  │  dashIds()  activeDashIdx()
  ▼
DashboardPanel(s)  (all mounted simultaneously; inactive ones are hidden)
  │  tiles()
  ▼
TileGrid
  │  renderTile(tile)
  ▼
tile components  (stripe-payments, github, rest, websocket, rss-feed, ...)
  │  useSseChannel(channel)  or self-poll via TileRefreshContext
  ▼
live data displayed to the user
```

All `DashboardPanel` instances are kept mounted at all times so their SSE
subscriptions and tile signals survive dashboard switches. Only the active
panel's wrapping `<div>` has `display: flex`; inactive ones use
`display: none`.

---

## DashboardManager

`src/workspace/DashboardManager.ts`

Manages up to `MAX_DASHBOARDS` (4) independent dashboard slots. State is
persisted to `localStorage` under the key `twm:multi-dash`.

### localStorage keys

| Key | Description |
|---|---|
| `twm:multi-dash` | JSON blob `{ ids: string[], activeIndex: number }` |
| `twm-dashboard-<id>` | Tile layout array for a given dashboard (written by `saveTileLayout`) |

### Public API

| Method / getter | Description |
|---|---|
| `ids` | Immutable snapshot of all dashboard IDs. |
| `count` | Number of dashboards currently open (1–4). |
| `activeIndex` | Zero-based index of the currently visible dashboard. |
| `activeDashboardId` | ID string of the currently visible dashboard. |
| `canAdd` | `true` when fewer than `MAX_DASHBOARDS` dashboards exist. |
| `canRemove` | `true` when more than one dashboard exists. |
| `goto(index)` | Switch to dashboard at `index`; no-op if out of range. |
| `next()` | Switch to the next dashboard, wrapping around. |
| `prev()` | Switch to the previous dashboard, wrapping around. |
| `add()` | Add a new dashboard and switch to it; returns new ID or `null`. |
| `addExisting(id)` | Register a server-discovered dashboard without switching to it. |
| `remove(index?)` | Remove the dashboard at `index` (default: active); no-op if only one. |

`DashboardManager` is a plain class — it is **not** reactive. `App` creates
SolidJS signals (`dashIds`, `activeDashIdx`) and syncs them after every
mutation call.

---

## DashboardPanel lifecycle

`src/panels/DashboardPanel.tsx`

### onMount load sequence

1. Read `localStorage` immediately via `loadTileLayout(workspaceName)` for an
   instant first render (no flash of empty canvas).
2. If the user is authenticated, call `loadLayoutFromServer` and reconcile:
   - **Both present**: merge server-only tiles (added by MCP while offline) into
     the local base, then push the merged result back to the server.
   - **Server only**: server wins — overwrite localStorage (e.g. fresh browser).
   - **Local only**: push local to server to re-establish the mirror.
   - **Neither**: generate `defaultTiles()` (4 Stripe quadrants) and persist to
     both stores.
3. POST resolved poll intervals for every SSE channel to
   `POST /api/poll/sync` so the server polls at the rates the user configured.
4. POST `webhook` delivery mode for any tile that was configured as
   webhook-delivered, so the server does not try to poll those channels.

### SSE tile-op effect

A `createEffect` subscribes to the `tile-op` SSE channel. Incoming operations
are applied to the `tiles` signal and reflected in `localStorage`:

```
{ op: 'add',    tile: TileConfig,               workspace?: string }
{ op: 'remove', id: string,                     workspace?: string }
{ op: 'update', id: string, patch: Partial<TileConfig>, workspace?: string }
```

`untrack(tiles)` is used when reading the current tile list inside the effect
to prevent the effect from re-running on every user tile mutation (which would
replay the last MCP op — e.g. re-adding a tile the user just removed).

### AbortController / swallowAbort pattern

An `AbortController` is created on mount and aborted in `onCleanup`. Every
async fetch passes `{ signal }`. Rejections are caught by `swallowAbort`, which
re-throws anything that is not an `AbortError` so genuine network failures
still surface as unhandled rejections.

```ts
const swallowAbort = (e: unknown): void => {
  if ((e as { name?: string })?.name !== 'AbortError') throw e as Error;
};
// usage:
void someAsyncFetch(signal).catch(swallowAbort);
```

### persistLayout

After every user mutation (drag, resize, add, remove, configure) `persistLayout`
is called:

```ts
function persistLayout(updated: TileConfig[]): void {
  saveTileLayout(workspaceName(), updated);           // localStorage
  if (auth.isAuthenticated()) {
    void saveLayoutToServer(workspaceName(), updated, API_BASE_URL);
  }
}
```

---

## Keybindings

`src/keyboard/keybindings.ts`

### KeybindingRegistry

```ts
const registry = new KeybindingRegistry();
registry.register('mod+p', 'palette', () => setPaletteOpen(true));
// ...
document.addEventListener('keydown', (e) => registry.dispatch(e, IS_MAC));
```

`dispatch` iterates registered entries in order; the first match calls
`preventDefault()` and invokes the handler.

### DEFAULT_CONFIG bindings

| Action | Default key |
|---|---|
| Command palette | `mod+p` |
| Help / shortcuts | `?` |
| Undo | `mod+z` |
| Redo | `mod+shift+z` |
| Next dashboard | `mod+arrowright` |
| Previous dashboard | `mod+arrowleft` |

`mod` maps to `Cmd` on macOS and `Ctrl` on Windows / Linux.

### How to register a shortcut

1. Add a key name to the `TwmKeybindings` interface in `src/config/config.ts`.
2. Add a default value to `DEFAULT_CONFIG.keybindings`.
3. In `AppInner`, call `registry.register(kb.yourKey, 'action-id', handler)`.

### Guard for input fields

The global `keydown` listener in `AppInner.onMount` skips modifier-free
shortcuts when the event target is an `<input>`, `<textarea>`, or
`contentEditable` element:

```ts
const inInput =
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target.isContentEditable;
if (inInput && !e.ctrlKey && !e.metaKey && !e.altKey) return;
```

This prevents characters like `?` from triggering the help modal while the
user is typing in a tile search box.

---

## Command palette

`src/ui/CommandPalette.tsx`

The palette is a fuzzy-search overlay driven by an array of `Command` objects:

```ts
interface Command {
  id: string;
  label: string;
  run: () => void | Promise<void>;
}
```

### How to add a command

Add an entry to the `commands` array in `AppInner` (`src/App.tsx`):

```ts
const commands: Command[] = [
  {
    id: 'my-action',
    label: 'My Action',
    run: () => { /* ... */ },
  },
  // ...
];
```

The palette's internal `filteredCommands` memo lower-cases both `query` and
each `label` for a simple substring match. Open the palette with `mod+p`; the
search box receives focus automatically.

---

## AddTileModal

`src/tiles/AddTileModal.tsx`

### Overview

A two-screen modal for adding a new tile to the active dashboard:

1. **Picker screen** — shown when no tile requiring configuration is selected.
   - Left sidebar: category filter from `CATEGORIES` in `tileRegistry.ts`
     (`all`, `payments`, `analytics`, `infra`, etc.).
   - Right grid: tiles grouped by provider, filtered by `activeCategory()` or
     by free-text `query()` (matches `label`, `provider`, and `tags`).
   - Clicking a tile card calls `selectTile(def)`.

2. **Inline config screen** — shown when `rest`, `websocket`, `rss-feed`, or
   `custom-api` is selected, replacing the picker with a minimal form:
   - `rest`: URL + optional JSON headers.
   - `websocket`: WebSocket URL + max-messages limit.
   - `rss-feed`: Feed URL (validated as `http/https`) + max-items.
   - `custom-api`: Endpoint URL (method and headers configurable after add).
   - A "Back" button returns to the picker without adding.

All signals are reset via `reset()` on every successful add or close.

### Tile registry integration

`TILE_REGISTRY` (from `src/tiles/tileRegistry.ts`) is the single source of
truth for what tiles can be added. Each `TileDefinition` has:

```ts
interface TileDefinition {
  type: TileType;
  label: string;
  provider: string;
  category: Category;
  icon: string;
  tags: string[];
  status?: 'stable' | 'coming-soon';
  description?: string;
}
```

`coming-soon` tiles render with an overlay badge and have their card button
disabled — `selectTile` returns early for them.

---

## StatusBar

`src/panels/StatusBar.tsx`

The status bar is rendered by Solid but partially driven by Alpine.js for the
live clock:

| Region | Owner | Content |
|---|---|---|
| Left | Solid | Active workspace name |
| Centre-left | Solid | Dashboard pip indicators (`●` per dashboard, active one highlighted) |
| Centre | Solid | Focused BSP panel ID |
| Right | Solid | Contextual keyboard hints from `HintsContext` |
| Far right | Alpine | Live clock — `x-text="time"` updated every second via `x-init` |

### Dashboard pip signals

`StatusBar` receives `dashCount` and `activeDashIdx` as plain props from
`AppInner`. These are derived from the `dashIds` and `activeDashIdx` SolidJS
signals that are synced to `DashboardManager` after every navigation or add/
remove operation.

```tsx
<StatusBar
  focusedPanelId={focusedId()}
  workspaceName={props.config.defaultWorkspace}
  dashCount={dashIds().length}
  activeDashIdx={activeDashIdx()}
/>
```

### HintsContext

`src/ui/HintsContext.tsx` exposes a tiny context that lets any component
request a different hint set. `AppInner` switches between `HINTS_DEFAULT`
(shown normally) and `HINTS_PALETTE` (shown while the command palette is open):

```ts
const { setHints } = useHints();
setHints(HINTS_PALETTE);   // when palette opens
setHints(HINTS_DEFAULT);   // when palette closes
```

`StatusBar` reads `hints()` from the context and renders each hint as a
`<kbd>` + label pair.
