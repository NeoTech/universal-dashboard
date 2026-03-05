# Agent Lessons

## Never add test tiles via MCP without cleaning up first

**Lesson (TWM-139):** Added 11 test REST tiles via MCP during debugging. The DB accumulated stale test data. When the user hard-reloaded the browser, `loadLayoutFromServer` returned those stale tiles and the "server-wins" logic unconditionally overwrote localStorage, destroying the real dashboard layout.

**Rule:** Never leave test tiles in the DB. Remove them immediately after testing with `mcp_twm_remove_tile`. If you must test, note all tile IDs you add and remove them in the same session before asking the user to reload anything.

**Lesson (TWM-139):** Kept making server.ts edits expecting watch-api to auto-restart, but never confirmed the restart happened before testing. When watch-api is not running or fails to restart, the agent cannot trigger a restart — only the user can.

**Rule:** After editing server.ts, inform the user the server needs to restart and wait for them to confirm it's up. Never assume watch-api restarted. Verify by calling an MCP tool — if it responds, the server is live.

**Lesson (TWM-139 verification):** Repeatedly spawned new bash terminals instead of reusing an existing idle one. This hit Git Bash's hard limit of 32 consoles, causing `fatal error - console device allocation failure` and crashing all subsequent terminal commands.

**Rule:** Before calling `run_in_terminal`, check the terminal list in context for an existing idle terminal (no active command running). Reuse it. Only open a new terminal if every existing one is actively occupied. This is also stated in the copilot-instructions.md agent rules.

## add_tile config must be nested under the type sub-key

**Lesson (TWM-139):** The `add_tile` MCP handler was spreading `configFields` flat onto the tile object. `renderTile.tsx` checks `tile.rest`, `tile.ws`, `tile.customApi`, `tile.graphql`, `tile.rss` — all nested sub-keys — not top-level fields. This caused MCP-created REST tiles to show "Unknown tile type" and never fetch or report data.

**Rule:** When writing or editing the `add_tile` MCP handler, always nest config fields under the type-appropriate sub-key:
- `rest` → `tile.rest`
- `websocket` → `tile.ws`
- `custom-api` → `tile.customApi`
- `graphql` → `tile.graphql`
- `rss-feed` → `tile.rss`
- Provider tiles (stripe-payments, etc.) → spread flat (no sub-key needed)

## Do not overcomplicate things

**Lesson (general):** Spent multiple turns fighting stripe mock hoisting, tmp file redirects, and class-based mock gymnastics when the right call was to just run `bun run test` and move on. Over-engineered the verification step.

**Rule:** If a verification step is taking more than one attempt, stop and do the simplest possible thing. A plain `bun run test` in a background terminal is enough. Do not chain, pipe, redirect, or write clever workarounds — just run the command.

## Never pipe or redirect in terminal commands

**Lesson (TWM-138):** Using `| tail`, `> file`, or `2>&1` in terminal commands causes the tool to simplify and crash the terminal. The same happens when chaining with `;`.

**Rule:** Never use pipes, redirects, or semicolon-chained commands. Run a single plain command (e.g. `bun run test`). Use `isBackground: true` and `await_terminal` to collect output.

## Subagent Handoff Verification

**Lesson (TWM-105, Subagent B → C):** When a subagent reports "done", verify that the key artifact types were actually created by doing a targeted grep before dispatching the next subagent. Subagent B added poll blocks and API routes for 6 Finnhub tiles but silently omitted ALL 6 data function implementations — the code compiled only because TypeScript can't catch undeclared functions in the same module scope until it processes the whole file. The next subagent (C) had to fix this.

**Rule:** After each subagent completes multi-file work in `api/server.ts`, run:
```
grep "async function dataXxx" api/server.ts | wc -l
```
and compare against expected count before dispatching the next subagent.

## Missing oldString Context

**Lesson (TWM-104, Subagents A/B/C):** Some edits resulted in lines being joined together (e.g. `'alphavantage-forex-rates':      { w: 560, h: 280, title: 'Forex Rates' },  'alphavantage-commodities':`) because the subagent's `oldString` did not match exactly and the tool fell through to a partial match. 

**Rule:** When replacing in TileConfig.ts or similar densely-packed files, include the newline after the line being inserted-after as part of the `oldString`. Check for merged lines in TileConfig.ts after each batch.

## useSseChannel Import Path and API Pattern

**Lesson (TWM-106):** Subagent used wrong import path and destructuring for tiles. Correct patterns:
- Import: `import { useSseChannel } from '../../ui/useSseChannel';`
- Usage: `const { data: store, loading, error } = useSseChannel<MyData>('event', default);`

**Rule:** Before writing tile component code for any provider, check an existing tile file in the same provider folder for the correct useSseChannel import path and destructuring. SolidJS style objects also require kebab-case CSS properties, not camelCase (e.g. 'margin-bottom' not marginBottom).

## Verify CSS classes before using them in new components

**Lesson (TWM-108/110):** Used field__error CSS class in new modal components without checking if it existed. Rule: grep for any new CSS class before using it; add it to base.css if missing.

## Review section format in todo.md

**Lesson:** Review sections must be formatted as `**Review**` (bold inline text), not `### Review` (a heading). Using `###` creates a sub-heading which breaks the visual hierarchy of the todo file.

**Rule:** When appending a review block after a completed task, always write `**Review**` on its own line, not `### Review`.

**Rule:** When adding a new UI component that uses CSS classes not already in existing similar components, grep for those classes first: grep -n 'field__error' src/styles/base.css. If missing, add the class definition alongside related classes.

## New todos always go at the end of todo.md

**Lesson (TWM-129/130):** Added a SAML todo as TWM-129 by inserting it mid-file after TWM-128, but TWM-129 was already taken by an existing task. The correct entry ended up as TWM-130 and had to be re-added at the end.

**Rule:** Before adding a new todo, always read the last ~20 lines of `.github/tasks/todo.md` to find the current highest TWM number, increment it by 1, and append the new entry at the very end of the file. Never insert mid-file.

## DOMParser is not available in Bun server runtime

**Lesson (TWM-130):** Used `new DOMParser()` in `api/saml.ts` (both `parseIdpMetadata` and `verifySamlResponse`). Tests passed because jsdom provides `DOMParser` globally, but Bun server throws `DOMParser is not defined`. Additionally, xmldom's `NodeList` does not implement `Symbol.iterator`, so `for...of childNodes` also fails — must use index-based loops (`for (let i = 0; i < nodes.length; i++)`).

**Rule:** Never use browser-only globals (`DOMParser`, `document`, `window`) in `api/` server code. Use `@xmldom/xmldom` for server-side XML parsing. When iterating `NodeList`/`childNodes` in code that runs on both jsdom (tests) and xmldom (server), always use index-based loops, not `for...of`. Tests under jsdom will NOT catch these issues because jsdom polyfills both `DOMParser` and iterable `NodeList`.

## SolidJS: never use early `if` returns based on signals

**Lesson (TWM-130):** Used `if (auth.provider() === 'saml') { return <SSOButton /> }` at the top of a SolidJS component. This ran once synchronously during component creation, before the `onMount` fetch to `/api/auth/config` completed, so `provider()` always returned `'local'` and the SSO button never appeared.

**Rule:** In SolidJS components, signals called outside the JSX reactive tree are NOT reactive — they run once and never re-run. ALWAYS use `<Show when={signal() === value}>` (or `<Switch>/<Match>`) inside the JSX return to conditionally render based on signal values. Never use `if (signal())` as an early return or branch outside JSX.

## vite.config.ts must NOT use the defineConfig callback form

**Lesson (TWM-131):** Changed `vite.config.ts` to `defineConfig(({ mode }) => { ... return {...} })` to use `loadEnv`. This caused `bun run test` to fail immediately with "Cannot merge config in form of callback" because `vitest.config.ts` uses `mergeConfig(viteConfig, ...)` which cannot accept a function-form config.

**Rule:** Keep `vite.config.ts` as `export default defineConfig({...})` (plain object form) so `vitest.config.ts` can continue to `mergeConfig` it. To read `.env` values at vite config time without the callback form, parse the `.env` file manually (a simple `readDotEnvKey` helper using `readFileSync`) and fall back to `process.env`. Never switch to the callback form without also updating `vitest.config.ts`.

## replace_string_in_file: oldString ending mid-block drops the continuation

**Lesson (TWM-131):** When `oldString` ends with the opening line of a block (e.g., `createEffect(() => {`) and `newString` ends with the same token to "keep" it, the replacement REPLACES that opening line — it does not preserve it. The block body that was supposed to follow the opening line is NOT re-wrapped because the `createEffect(() => {` line in `newString` is the last token, but the content in the file that comes AFTER the matched region (the block body) now appears without the wrapper. Result: syntax error.

**Rule:** When inserting new code BEFORE an existing block without disturbing it, include a few lines of the existing block's body in both `oldString` and `newString` so the region clearly encompasses the full transition — or use a follow-up edit to add the missing wrapper rather than trying to do it in one shot with an incomplete `oldString`.

## Docker: use PathPrefix routing instead of Host-based when ngrok is involved

**Lesson (TWM-132):** Host-based Traefik rules (`Host('dashboard.localhost')`) only work when the client's `Host` header matches exactly. With ngrok, the public URL changes on every restart (free plan) and the `Host` header will be `abc123.ngrok-free.app` — not `dashboard.localhost`. A `HostRegexp` middleware is needed to cover both cases, which adds complexity.

**Rule:** For Traefik deployments that include an ngrok tunnel (or any situation where the hostname is unpredictable), use PathPrefix-based routing rather than Host-based rules. Route `/api/*` + `/health` to the API container (priority 10) and `/*` to the dashboard container (priority 1). This works identically for localhost, ngrok ephemeral URLs, ngrok static domains, and any future reverse proxy — zero config changes required.

## Docker: don't bake NGROK_AUTHTOKEN into images; pass via env at runtime

**Lesson (TWM-132):** The user's ngrok authtoken lives in `~/.config/ngrok/ngrok.yml` on the host. This file should NOT be mounted into Docker containers (it would expose the token to anyone with `docker inspect` access and it's a host-specific path). The `ngrok/ngrok` Docker image reads `NGROK_AUTHTOKEN` from environment automatically.

**Rule:** Always inject secrets (ngrok authtokens, API keys) via `environment:` or `env_file:` in docker-compose.yml, never via volume-mounted config files or `COPY` in Dockerfiles. `.dockerignore` must exclude `.env`.



## broadcastSse caches events — never use it for ephemeral mutations

**Lesson (TWM-137):** `broadcastSse(event, data)` stores the value in `resourceCache` AND pushes it to all clients. On a new SSE connection, the server replays ALL cached events to the connecting client. If a mutation event (like `tile-op` for add/remove/update) is broadcast with `broadcastSse`, it will be replayed every time the page reloads or reconnects — causing the same add/remove/update to be applied again on top of the already-correct localStorage state (e.g. duplicate tiles, ghost removes).

**Rule:** Only use `broadcastSse` for events that represent current resource state (poll data, resource snapshots). For one-shot mutation commands — add, remove, update — use a non-caching variant (`broadcastSseEphemeral`) that pushes to all current clients but does NOT write to `resourceCache`. This prevents the mutation from being replayed on future reconnects.

## layout-change vs tile-op: always use tile-op for incremental mutations

**Lesson (TWM-137):** Wiring a `createEffect` on `layout-change` to call `setTiles(incoming)` caused ALL dashboard tiles to be wiped when a cached `layout-change` event (containing only the MCP-added tile) was replayed to the reconnecting client.

**Rule:** MCP tools (and any server-initiated layout mutation) must NEVER broadcast a full `layout-change` snapshot. Broadcast a targeted `tile-op` `{ op: 'add'|'remove'|'update', ... }` instead. The frontend applies it incrementally on top of existing state. Also add deduplication in the `add` handler: `if (tiles().some(t => t.id === op.tile.id)) return;`.


## Never touch git — no commits, no staging, no resets

**Lesson:** The agent ran `git add`, `git reset`, and `git diff --cached` without being asked, interfering with the user's own commit workflow.

**Rule:** NEVER run any git command that modifies repository state (`git add`, `git commit`, `git reset`, `git stash`, `git checkout`, `git rm`, etc.) unless the user explicitly asks for it. Read-only git commands (`git log`, `git diff`, `git status`) are acceptable for research. The user owns their git history.

## Per-tile filtering must be client-side — never switch to per-tile REST polling

**Lesson (TWM-140):** When implementing per-tile subreddit filtering for Reddit tiles, the agent introduced a `useRedditFeed.ts` hook that did per-tile REST polling when a `subreddits` prop was set. This broke keyword filtering (keywords were no longer reactive because the REST path bypassed the SSE channel), caused auth issues (REST endpoint needed JWT), and over-complicated the data flow.

**Rule:** All tiles of a shared provider type (reddit, crypto, etc.) MUST subscribe to the single shared SSE channel (`useSseChannel`). Per-tile config (`subreddits`, `keywords`, etc.) is ALWAYS a client-side filter applied after receiving the full SSE payload — never a server query param that spawns a separate REST request.

## Server-side poll data must come from tile config in DB, not .env

**Lesson (TWM-140):** The user explicitly wanted `REDDIT_SUBREDDITS` removed from `.env` — subreddits should be sourced from the `subreddits` field set on each tile in the layout DB. The agent kept reinserting the env var and using it as the primary source, which defeated the per-tile config purpose entirely.

**Rule:** When a provider's data is parameterized per-tile (e.g. subreddits for reddit tiles), the server-side poller must scan `tile_layouts` in the DB to collect the union of all values across all tiles/users/workspaces. The `.env` var is only a last-resort fallback, documented in `.env.example` as optional. Use `getAllRedditSubreddits()` pattern:
```typescript
// mcp-layout.ts
export function getAllRedditSubreddits(): string[] {
  // SELECT tiles_json FROM tile_layouts → parse all → collect subreddits set
}

// providers/reddit.ts
const fromTiles = getAllRedditSubreddits();
const targets = fromTiles.length > 0 ? fromTiles : envFallback ?? [];
```
Always register the poller unconditionally — it returns `{ posts: [] }` gracefully when no subreddits are configured anywhere.

Pattern:
```tsx
const { data: store } = useSseChannel<{ posts: RedditPost[] }>('reddit-posts', { posts: [] });
const filtered = () => {
  const subs = parseList(props.subreddits);
  return subs.length ? store().posts.filter(p => subs.includes(p.subreddit.toLowerCase())) : store().posts;
};
```

## Verify API endpoints exist before writing provider functions

**Lesson (TWM-150):** Invented a `/dashboard/summary` endpoint that does not exist in the LOPC API. The API returned 404 at runtime.

**Rule:** Before writing a `flintFetch('/some/path')` call, verify the endpoint actually exists. The LOPC API exposes its full route manifest at `GET /` (the root). Fetch it and confirm the path is listed. If no dedicated endpoint exists for aggregated data, compute it from the individual resource endpoints that do exist (`/orders`, `/products`, `/customers`, etc.).

## Bun .env parser collapses $$ to $ — use base64 for passwords with $ characters

**Lesson (TWM-150):** The LOPC password `!InvestigationGadgets890$$` contained `$$`. Bun's `.env` parser collapses every form of `$$` (single-quoted, double-quoted, unquoted, even `$$$$`) to a single `$`, making it impossible to store the literal password in a `.env` file.

**Rule:** When a credential contains `$` characters that must be preserved exactly, store it base64-encoded in `.env` and decode it in the provider using `Buffer.from(raw, 'base64').toString('utf8')`. Update the JSDoc comment for the env var to document the base64 encoding. Never try to work around this with different quoting styles — none of them work.

## persistLayout must save to localStorage AND the server

**Lesson:** `persistLayout()` in `DashboardPanel.tsx` was only calling `saveLayoutToServer()` and skipping `saveTileLayout()` (localStorage). This caused a subtle rollback loop:
1. User makes changes → only server is updated, localStorage stays stale
2. On reload: `localStorage = stale`, `server = current`
3. Merge logic: "no server-only tiles" → pushes stale localStorage back to server
4. Server reverts to the old layout — user's changes are lost

**Rule:** Any function named `persist*` or `save*` that writes to a remote store MUST also write to localStorage first. localStorage is the instant-render cache and the fallback; if it is stale it becomes the source of truth during the merge. Always call `saveTileLayout(workspaceName(), updated)` before or at the same time as `saveLayoutToServer()`.

## Empty array [] must be treated as intentional state, not "no data"

**Lesson:** In `DashboardPanel.onMount`, the reconcile logic used `local.length > 0` and `serverTiles.length > 0` to determine whether data existed. An intentionally cleared/empty dashboard `[]` has length 0 → treated as "no data" → falls into the "neither" branch → `defaultTiles()` generated and persisted → reloading an empty dashboard always spawned the default Stripe tiles.

The same bug manifested in two ways:
1. **Cleared dashboard**: User clears all tiles, `persistLayout([])` writes `[]` to both stores, reload sees `length === 0` on both → generates defaults. 
2. **New dashboard**: `new-dashboard` command pre-seeded `saveTileLayout(newId, [])`. Even without a prior clear, `[]` in localStorage caused the same "neither" branch on reload.

**Rule:** Always distinguish `null` (truly no data: key absent, network error, new workspace) from `[]` (user deliberately emptied the dashboard). Use `!== null` checks, not `.length > 0`:
```tsx
const hasLocal = local !== null;      // [] is intentionally empty
const hasServer = serverTiles !== null; // [] is intentionally empty
```

**Corollary:** Never pre-seed a new dashboard workspace with `[]`.

## LOPC prices are decimal dollars, not Stripe cents

**Lesson:** `formatCurrency` was copied from Stripe utilities and contained `amount / 100` (converting from cents to dollars). LOPC stores prices as decimal dollars (e.g. `29.99`). Applying `/100` made every price 100x too small — $30 sneakers showed as $0.30.

**Rule:** Each provider has its own monetary unit convention. Document it in the utility and verify against real API data before writing any formatting code. Never assume all providers use minor-unit integers (cents). For LOPC: prices are decimal dollars, no division needed.

**Corollary:** Product edit/create forms that did `price / 100` to display and `Math.round(price * 100)` to submit were also wrong. When the API uses dollars natively, both conversions must be removed.

## Aggregation functions should use Drizzle cache, not re-fetch

**Lesson:** `dataFlintDashboard`, `dataFlintInventory`, `dataFlintSales`, and `dataFlintCustomerReport` all called `dataFlintOrders()`, `dataFlintProducts()`, and `dataFlintCustomers()` directly. These functions each make HTTP requests to LOPC, so aggregate pollers triggered 3-6 extra LOPC fetches every minute -- on top of the dedicated order/product/customer pollers. The dashboard poll took 2.7s because it made 3 serial LOPC calls.

## FLINT startup auth must have a single caller

**Lesson:** Startup was triggering FLINT auth twice by calling `loginFlint()` directly and also running the immediate `flint-session` warm path that authenticates through session polling.

**Rule:** Do not call `loginFlint()` as a parallel startup side effect when `flint-session` is already registered with immediate warm. Use `getFlintToken()` inside `dataFlintSession()` so auth is deduped by the single-flight guard and the auth tile only reflects backend session state.

## Ngrok debugging must match actual runtime topology

**Lesson:** Assumed Docker Compose + Traefik routing while the user was running ngrok directly against local dev (`localhost:8080`). This led to chasing the wrong network layer.

**Rule:** Before diagnosing tunnel/proxy traffic, confirm the active topology first (direct ngrok-to-dev-server vs docker-compose/traefik). For direct ngrok HTTPS sessions, avoid forcing `VITE_API_URL=http://localhost:3001` in browser runtime paths; fall back to same-origin relative routes for `/api` and `/ws`.

## WebSocket CONNECTING can hang forever behind tunnels

**Lesson:** In ngrok/proxy scenarios, the FLINT socket could remain in `CONNECTING` with provisional headers and never emit a usable open/data path, leaving tiles in permanent loading because fallback was never triggered.

**Rule:** Always enforce a WS connect timeout and count failed handshakes even when close occurs without a clean data phase. This guarantees fallback activation instead of infinite loading screens.

## Fallback transports must be fed by server broadcasts

**Lesson:** FLINT switched to WS-first broadcasts, but fallback still relied on SSE. When WS degraded, fallback activated but had no FLINT payload stream to consume, so tiles remained loading.

**Rule:** When introducing or changing transport layers, verify fallback channels receive the same resource snapshots. For FLINT, pollers must broadcast to both WS and SSE so fallback is functional under proxy/tunnel WS failures.

## Use host-aware WS origin selection in dev

**Lesson:** Relying on one WS route strategy for all environments caused instability: localhost dev benefited from direct API WS origin, while ngrok/public hosts require same-origin tunnel WS.

**Rule:** Select WebSocket origin based on runtime host. Prefer direct API origin in localhost dev (using `VITE_PROXY_TARGET`/`VITE_WS_URL`) and same-origin for non-local hosts (ngrok/public).

## Validate persisted JWT at startup

**Lesson:** A stale JWT left in localStorage caused `/api/sse?token=...` to return Unauthorized repeatedly, producing infinite red reconnect attempts and permanently loading tiles.

**Rule:** On app startup, always validate any persisted JWT via `/api/auth/me`. If it returns 401/403, clear token/user state immediately so auth UI can recover instead of retry loops.

## Free ngrok WSS can stall even when localhost WS is healthy

**Lesson:** Localhost WebSocket upgraded (`101`) while the same path over free ngrok remained stuck in provisional CONNECTING state. Waiting for WSS there caused delayed/empty tile renders.

**Rule:** Detect ngrok hosts and skip WS transport for FLINT resource subscriptions; use SSE immediately so tiles load reliably over tunnels.

## Verify websocket path with a valid JWT on every hop

**Lesson:** A valid token proved `ws://localhost:3001/ws/flint` opens, while `ws://localhost:8080/ws/flint` (Vite/Bun proxy hop) and `wss://<ngrok>/ws/flint` both stayed in CONNECTING timeout. Local HTTPS was not the missing piece.

**Rule:** For realtime debugging, test WS upgrade at each hop (API direct, dev proxy, public tunnel) using the same valid JWT. If direct API works but proxy hop hangs, treat it as a proxy/tunnel upgrade issue rather than auth/TLS configuration.

**Rule:** Aggregation functions that depend on already-polled entities MUST use the Drizzle cache (`getCache<T>(key)`) when non-empty. Only fall through to a live fetch if the cache is empty (first run). Pattern:
```typescript
const cachedOrders = getCache<FlintOrder[]>('flint-orders');
const orders = cachedOrders && cachedOrders.length > 0 ? cachedOrders : await dataFlintOrders();
```

## Add field normalization to all provider data functions

**Lesson:** LOPC API field names and our TypeScript types were assumed to match. When they diverge (e.g. snake_case vs camelCase, `total` vs `totalAmount`) the values silently become `undefined`, producing `$NaN` and blank columns. The only way to know the real field names is to log the raw response.

**Rule:** Every provider that maps external API responses to internal types should have a `normalize*` function that explicitly maps known field name variants. Add one-time `console.log('[provider] raw sample:', raw[0])` on first fetch so field names are visible in server logs from the start. Never rely on TypeScript types to validate external API shapes — they're assertions, not validators.


## Fire-and-forget deletes race with concurrent server queries

**Lesson:** In `App.tsx` `onMount`, `pending-deletes` (failed server DELETEs from a previous session) were fired as `void deleteLayoutFromServer(ws)` (fire-and-forget) and then `loadWorkspacesFromServer` was called immediately in parallel. If the server hadn't processed the in-flight DELETE before the workspace query returned, the deleted workspace appeared in the results and `dm.addExisting(ws)` resurrected it. On the next reload, `twm:multi-dash` contained the re-added workspace, and the "closed" dashboard was back.

**Rule:** Whenever you fire async side-effects (like server DELETEs) and then immediately query for state that depends on those side-effects having completed, you must either:
1. Await the side-effects before querying, OR

## Order detail cache must not short-circuit unresolved line-item names

**Lesson (TWM-151):** The FLINT order detail route treated any projected order with `lines.length > 0` as "detailed enough" and returned it immediately. When those lines had placeholder names (`productName = '—'`), hard reloads kept serving the stale projected detail and the order tile never hydrated product names.

**Rule:** In `/api/flint/orders/:id`, only short-circuit cache/projection reads when line details are fully resolved. `lines.length > 0` is not enough — require all line `productName` values to be non-placeholder. If unresolved names exist, continue through live enrichment (cache products + `/products/:id` fallback) before returning.
2. Capture the IDs being mutated in a Set and filter them from the query results

Example — filter approach (preferred when onMount can't be async):
```tsx
const deletedIds = new Set<string>();
for (const ws of pending) {
  deletedIds.add(ws);
  void deleteLayoutFromServer(ws, API_BASE_URL);
}
void loadWorkspacesFromServer(API_BASE_URL).then((serverWs) => {
  const newIds = serverWs.filter((ws) => !localIds.has(ws) && !deletedIds.has(ws));
  ...
});
```


## vi.mock ws does not work reliably in vitest for CJS native modules

**Lesson (TWM-156):** Attempted to mock the ws package in hub tests using vi.mock. Despite vitest hoisting, the real ws handleUpgrade was still called. CJS native modules are difficult to mock in vitest ESM transform.

**Rule:** When testing modules that depend on CJS native packages (ws, better-sqlite3, etc.), export a __testing const from the module with internal state (Maps, Sets, functions). In tests, directly populate internal state and test the logic. Leave upgrade/connection flow for integration tests.

## Drizzle query mocks need SQL column names not JS property names

**Lesson (TWM-156):** Mocking bun:sqlite prepare().all() return values with JS property names (expiresAt) instead of SQL column names (expires_at) causes null results. Drizzle maps SQL columns to JS properties internally.

**Rule:** When mocking Drizzle query results, use SQL column names (snake_case) from the schema. Since this is fragile, prefer testing at a higher abstraction level.

## LOPC API uses page+pageSize, never limit

**Lesson (TWM-161):** Multiple endpoints in flint.ts used `?limit=200` or `?limit=5` as query parameters. The LOPC API uses `page` + `pageSize` for pagination, not `limit`. This caused the API to ignore the parameter and return its default page size, silently returning wrong result counts.

**Rule:** When writing fetch URLs for the LOPC API, always use `?page=1&pageSize=N`. Never use `?limit=N` or `?sort=`. The LOPC response envelope is always `{ data, meta: { page, pageSize, total } }`.

## Product names must be resolved server-side from relational cache

**Lesson (TWM-161):** LOPC `order_lines` table has `product_id` FK but no `product_name` column. The old code tried sequential upstream fetches at interaction time to resolve names (5+ round-trips per order detail). This was slow, fragile, and often failed.

**Rule:** Always resolve product names from the local `flint_products` relational cache via `getProductNameMap()` or `resolveOrderLineNames()`. Never fetch individual products from upstream to resolve names. The product cache is populated by the `dataFlintProducts()` poller and is available immediately after the first poll cycle.

## Register pollers in dependency order

**Lesson (TWM-161):** Orders poller fired at `initialDelayMs: 0` while products poller fired at `initialDelayMs: 2000`. First poll cycle had empty product name map, resulting in unresolved product names for ~6 seconds after startup.

**Rule:** Register resource pollers in dependency order: products/categories first (they're referenced by other entities), then orders (which depend on product names), then customers, then shipments.

## disconnect() must drain pending promises cleanly

**Lesson (TWM-161):** Adding pending promise drainage to `disconnect()` with `.reject()` caused unhandled rejection errors in tests where promises were fire-and-forget (`void sendWsCommand(...)`). 

**Rule:** When draining pending promises on WS disconnect, use `.resolve()` with a clean failure status (e.g., `{ status: 'failed', error: 'disconnected' }`) instead of `.reject()`. This avoids unhandled-rejection noise in tests and gives callers a predictable failure path.

## Extract shared normalizers to utils

**Lesson (TWM-161):** Three copies of the exact same 15-line order line normalizer (camelCase/snake_case field mapping) existed across FlintOrdersTile, FlintOrderReceiptTile, and a createEffect inline. Changes to one copy were easily missed in the others.

**Rule:** Any field normalization logic used by more than one component must be extracted to a shared function in `utils.ts`. Import it everywhere instead of duplicating.

## LOPC API defaults to active-only products for all callers

**Lesson (TWM-161-19):** `dataFlintProducts()` fetched `/products?page=1&pageSize=200` without a `status` filter. The LOPC API returns only `active` products by default, even for admin tokens. Archived products (still referenced by historical orders via `product_id` FK) were missing from the name-resolution cache, causing product names to show as UUIDs.

**Rule:** When fetching products from the LOPC API for cache population, always fetch all three statuses (`active`, `draft`, `archived`) in parallel. The product cache exists for name resolution across all orders, including historical ones that reference archived products.

## Never silently swallow non-active product fetch failures

**Lesson (TWM-161-19 follow-up):** The first fix still allowed `draft`/`archived` fetches to fail silently (`continue` on non-OK response), so the cache stayed active-only with no obvious signal. This masked auth-role misconfiguration and made debugging slow.

**Rule:** For status-scoped product sync, always emit explicit diagnostics for `401/403` on non-active statuses and include per-status distribution logs. Silent fallback is allowed only after logging the exact status and likely cause.

## Verify upstream behavior with plain curl before local refactors

**Lesson (TWM-161-19 user correction):** I started implementing local workaround logic before conclusively proving upstream behavior in a simple reproducible way. This created churn and delayed root-cause confirmation.

**Rule:** For API behavior disputes (filters, pagination, auth scope), first run a plain bash `curl` reproduction with the exact endpoint/query/auth flow and record the output. Only then implement local code changes.

## Order status UX must support bidirectional changes and hidden-only visibility

**Lesson (TWM-161 follow-up):** The orders UI encoded a forward-only lifecycle and treated several statuses as terminal in the view layer. This prevented reversing status changes and made hidden orders leak into the `all` list when hidden should be a dedicated-only view.

**Rule:** For Flint orders, model `hidden` as a first-class status in shared types/labels, allow changing to any other status from the UI, and enforce filter behavior explicitly: `all` excludes `hidden`, and hidden orders appear only in the `hidden` filter.

## Never expose UI status actions the backend cannot execute

**Lesson (TWM-161 correction):** I exposed full bidirectional status actions in the UI without verifying backend transition rules first. This produced user-facing `422 UNPROCESSABLE` errors (e.g. shipped → confirmed) on click.

**Rule:** UI action lists must be generated from backend-allowed transitions only. If product requirements demand extra states (like hidden), implement them as local UI state unless/until the backend contract explicitly supports them.

## For cross-tile workflows, prefer store-prefill + auto-add tile pattern

**Lesson (TWM-161 shipment UX):** Users need one-click flow from receipt to shipment creation. The reliable pattern is: if target tile is missing, add it, then pass prefill state via `flintStore` signal consumed by the target tile.

**Rule:** Implement cross-tile handoffs with `useDashboardActions` + `makeTile(...)` + `flintStore` prefill signal. In target create forms, add lightweight autocomplete from existing cached resource data for UUID-heavy fields.

## Bun-compiled frontend/backend reduce runtime lag

**Lesson (TWM-162):** Running both frontend and backend as Bun-compiled binaries significantly improved runtime responsiveness versus script/interpreted startup paths. UI lag and interaction latency dropped noticeably.

**Rule:** For local Docker and production-like runs where responsiveness matters, prefer Bun-compiled binaries for both frontend and backend. Keep non-compiled dev mode for iteration speed, but validate performance-sensitive behavior on the compiled path.

## Local compile scripts must auto-target host architecture

**Lesson (TWM-163):** Hardcoding Linux compile targets in local scripts creates incompatible binaries on Windows/macOS hosts and causes confusion between Docker and local runtime paths.

**Rule:** For local `compile:*` scripts, do not pass `--target`; let Bun infer the current host OS/architecture. Keep explicit Linux targets only in Dockerfiles where the runtime target is known to be Linux.
