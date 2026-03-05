# Architecture

## System Overview

The Tiling Window Manager Dashboard is a developer-focused browser dashboard built with SolidJS on the frontend and a plain Bun HTTP server on the backend. It aggregates live data from more than 35 external API providers (Stripe, GitHub, Cloudflare, Linear, CoinGecko, and others) into a freeform tiled canvas where each tile is an independently rendered SolidJS component. Tile layouts are persisted per workspace in both `localStorage` and a server-side SQLite database. Live data is delivered to the browser without polling by a single Server-Sent Events (SSE) stream that the API server broadcasts to whenever a provider poller produces new data. An optional Model Context Protocol (MCP) interface allows AI assistants to read and manipulate the dashboard layout programmatically, with changes reflected in the browser in real time through the same SSE channel.

---

## Component Responsibility Map

| Component | File | Responsibility |
|---|---|---|
| Entry point | `src/main.ts` | Mounts the SolidJS `App` component into the DOM root element |
| App root | `src/App.tsx` | Orchestrates dashboards, panels, keybindings, SSE tile-op channel, auth state, and dashboard navigation |
| Tile registry | `src/tiles/tileRegistry.ts` | Declares every available tile type with label, icon, category, and tags for the Add Tile modal |
| Tile renderer | `src/tiles/renderTile.tsx` | Single `switch` that maps a `TileType` string to its SolidJS component |
| Tile grid | `src/tiles/TileGrid.tsx` | Freeform absolutely-positioned canvas; handles pointer-driven drag and resize |
| Tile persistence | `src/tiles/tilePersistence.ts` | Saves and restores tile layouts to `localStorage` and syncs them to the API server |
| Base tile | `src/tiles/BaseTile.tsx` | Shared wrapper for loading skeleton, error display, and consistent CSS |
| SSE hook | `src/ui/useSseChannel.ts` | Browser hook that subscribes to a named SSE channel and returns a reactive SolidJS signal |
| Auth context | `src/ui/AuthContext.tsx` | Provides login state and JWT token management to the component tree |
| Config | `src/config/config.ts` | Default runtime config (`TwmConfig`) consumed by the App |
| API server | `api/server.ts` | Plain Bun HTTP server; owns the SSE bus, provider registration, layout REST API, auth endpoints, webhook receivers, and MCP tool handlers |
| Provider modules | `api/providers/*.ts` | One file per external service; each exports `register(ctx)` which calls `ctx.poll()` to schedule fetches and broadcast results |
| Database | `api/db.ts` | Opens and exposes the SQLite `auth.db` instance for layout storage and user accounts |
| MCP layout | `api/mcp-layout.ts` | Implements MCP tool handlers (`list_workspaces`, `read_layout`, `add_tile`, `remove_tile`, `reload_env`, etc.) and the `CHANNEL_TO_TILE_TYPES` map |
| SAML auth | `api/saml.ts` | Builds SAML AuthnRequests, verifies IdP responses, and generates SP metadata for SSO providers |
| Vite config | `vite.config.ts` | Configures the SolidJS plugin, build target, dev server port, and `/api` + `/health` proxy rules |
| Docker stack | `docker-compose.all-in-one.yml` | Defines the local all-in-one container runtime for frontend, API, Traefik, and optional ngrok |

---

## ASCII Architecture Diagram

```
  Local development
  ─────────────────────────────────────────────────────────────────────────

  Browser (SolidJS app)
    │  HTTP page load, JS/CSS assets
    │  GET  /api/events  (SSE — persistent connection)
    │  POST /api/layout  (tile layout sync)
    ▼
  Vite Dev Server  :8080
    │  /api/*  →  proxy  →  :3001
    │  /health →  proxy  →  :3001
    ▼
  Bun API Server  :3001
    ├── SSE bus  ──────────────────────────────────────────────────────────┐
    │     Maintains a set of active Response writers.                      │
    │     Broadcasts a named event to all writers on every poll result.    │
    │                                                                      │
    ├── Provider pollers  (api/providers/*.ts)                             │
    │     setInterval per provider → fetch external API                   │
    │     → cache result in memory → broadcast to SSE bus ─────────────────┘
    │                                                                      ▼
    ├── Layout REST API                                          Browser tile re-render
    │     GET  /api/layout          (read from SQLite)           via useSseChannel()
    │     POST /api/layout          (write to SQLite)            reactive SolidJS signal
    │     DELETE /api/layout/:ws    (delete workspace)
    │
    ├── Auth endpoints  (/api/auth/*)
    │     local login (PBKDF2 + JWT) or SAML 2.0 SSO
    │
    └── MCP tool handlers  (/api/mcp/*)
          list_workspaces, read_layout, add_tile, remove_tile,
          update_tile, reload_env, get_env, set_env
              │
              ▼
          SQLite  (auth.db)
              │  layout write
              ▼
          SSE broadcast  →  Browser tile update


  Docker / local all-in-one
  ─────────────────────────────────────────────────────────────────────────

  Browser / ngrok
      │
      ▼
  Traefik :8080 (inside all-in-one container)
      ├── /api/* /health /ws  → Bun API :3001
      └── /                   → static frontend :5187

  AI assistant (MCP client)
    │  HTTP POST  /api/mcp/*  (tool calls)
    ▼
  Bun API Server  :3001
    │  reads/writes SQLite layout
    │  broadcasts SSE event  (tile-op, layout-update, …)
    ▼
  Browser  →  tile added/removed/updated in real time
```

---

## Request Lifecycle

1. **Page load** — The user opens `http://localhost:8080`. Vite serves `index.html` and the compiled SolidJS bundle.
2. **App mount** — `src/main.ts` calls `render()`, mounting `App` into `#wm-root`. `App` reads `DEFAULT_CONFIG` and restores the last workspace tree from `localStorage`.
3. **SSE connection** — `useSseChannel()` opens a persistent `GET /api/events` connection. Vite proxies this to the Bun API server at `:3001`. The server registers the browser client in its SSE writer set and starts streaming `data:` events immediately.
4. **Layout restore** — `tilePersistence.ts` calls `GET /api/layout` for the active workspace. The API server reads the saved tile configuration from SQLite and returns it. The tile grid renders each tile at its persisted position and size.
5. **Tile initial render** — Each provider tile calls `useSseChannel('stripe-payments')` (for example). If a cached value already exists on the server, the server sends it immediately on SSE connection. The tile renders with that data.
6. **Provider poll fires** — The server-side `setInterval` for a provider elapses. The provider module fetches the external API, updates the in-memory cache, and calls the SSE broadcast function.
7. **SSE event delivered** — The server writes `event: stripe-payments\ndata: {...}\n\n` to every active SSE writer.
8. **Tile re-render** — The `useSseChannel()` hook in the browser receives the event, parses the JSON payload, and updates the SolidJS reactive signal. The tile component re-renders with the new data automatically, without a page reload.
9. **Layout change** — The user drags or resizes a tile. `TileGrid` calls `saveTileLayout()`, which updates `localStorage` synchronously and sends `POST /api/layout` to the server so the layout is persisted to SQLite and visible to MCP agents.

---

## MCP Data Flow

1. An AI assistant sends a tool call (for example, `add_tile`) to `POST /api/mcp/add_tile` with a JSON body describing the new tile type, position, and size.
2. The API server's MCP handler in `api/mcp-layout.ts` validates the tool arguments, reads the current layout from SQLite via `readLayout()`, appends the new tile, and writes the updated layout back via `writeLayout()`.
3. The handler then calls the SSE broadcast function with the `tile-op` channel, emitting `{ op: "add-tile", workspace: "...", tile: {...} }` to all connected browsers.
4. In the browser, `App.tsx` subscribes to the `tile-op` SSE channel via `useSseChannel()`. The effect that watches this signal fires, reads the operation type, and calls the appropriate tile persistence function to update `localStorage` and re-render the tile grid.
5. The new tile appears in the browser without any user interaction. If the tile type has an associated provider channel, `useSseChannel()` is called for that channel and live data begins flowing as soon as the next poll fires on the server.
6. The AI assistant receives a success response from the MCP endpoint and can proceed with further tool calls (for example, `list_workspaces` to verify the change).

---

## Port Map

| Service | Port | Notes |
|---|---|---|
| Vite dev server | 5187 | Serves the SolidJS frontend in development; proxies `/api/*`, `/health`, and `/ws` to `:3001` |
| Bun API server | 3001 | SSE bus, provider pollers, layout REST API, auth, MCP tools, webhooks |
| Traefik HTTP (local) | 8080 | Reverse proxy front door; routes `/api/*`, `/health`, `/ws` to API and `/*` to frontend |
| Traefik dashboard (local) | 8081 | Traefik admin UI |
| Ngrok local API | 4040 | Ngrok agent admin interface when ngrok is enabled |

---

## Key Configuration Files

| File | Purpose |
|---|---|
| `.env` | All secrets and feature flags: API keys, `AUTH_ENABLED`, `JWT_SECRET`, `AUTH_PROVIDER`, port overrides, and per-provider poll interval overrides (`*_POLL_MS`) |
| `.env.example` | Template listing every supported variable with comments; copy to `.env` to get started |
| `vite.config.ts` | Vite plugin setup (SolidJS), build target (`es2022`), dev server port (`8080`), and proxy rules for `/api` and `/health` |
| `tsconfig.json` | TypeScript compiler options shared by frontend source, API server, and tests |
| `docker-compose.all-in-one.yml` | Single-service all-in-one container for local desktop use |
| `traefik.local.yml` | Traefik static configuration used by host mode and copied into all-in-one image |
| `traefik.local.routes.yml` | Traefik dynamic routes and middleware (including gzip compression) |
| `poll-settings.json` | Runtime-editable poll interval overrides stored on disk; updated by the MCP `set_poll_interval` tool without a server restart |
| `vitest.config.ts` | Unit and integration test configuration (jsdom environment, aliases, coverage) |
| `vitest.e2e.config.ts` | End-to-end test configuration targeting the running dev server |
| `eslint.config.mjs` | ESLint flat config for TypeScript and SolidJS source files |
