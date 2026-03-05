# FLINT / LOPC Provider

This provider integrates the FLINT (LOPC) commerce API into the dashboard with:

- Server-side polling + cache projection (`api/providers/flint.ts`)
- WebSocket-first tile transport (`/ws/flint`)
- Automatic SSE fallback when WebSocket fails repeatedly
- A shared cross-tile store (`src/tiles/flint/flintStore.ts`)

The FLINT catalog currently ships **15 tile types**.

## Runtime Architecture

### Server data pipeline

1. Pollers fetch FLINT resources into local cache/projections.
2. Each refresh broadcasts to:
   - WebSocket subscribers (`broadcastResource`)
   - SSE subscribers (`ctx.broadcastSse`)
3. WS clients subscribing to a resource receive immediate cached data when available.

Primary resources are warmed first (`products`, `categories`, `orders`, `customers`, `shipments`, `data-health`, `webhooks`), then aggregate resources (`dashboard`, `inventory`, `sales`, `customer-report`) start after a delay to avoid upstream burst load.

### Client transport model

- Tiles read through `useFlintResource()`.
- `useFlintResource()` uses WS via `useFlintSocket` and falls back to SSE after repeated WS failures.
- Mutations go through `sendCommand()` (WS command queue), not direct tile-side REST in most flows.
- One-shot cache reads use `queryResource()` (for example: `flint-order-detail`).

### Authentication lifecycle

- Token state is held server-side (`_accessToken`, `_refreshToken`, `_tokenExpiry`).
- `getFlintToken()` uses single-flight refresh/login to prevent duplicate startup auth calls.
- `flint-session` is cache-seeded at register time and updated by poll/login/logout.

## Configuration

### Required

| Env | Purpose |
|---|---|
| `FLINT_FUNCTION_URL` | Base URL for the FLINT API |
| `FLINT_AUTH_EMAIL` | Login email |
| `FLINT_AUTH_TOKEN` | **Base64-encoded** password/token |

### Poll interval overrides (optional)

| Env | Default |
|---|---|
| `FLINT_POLL_ORDERS_MS` | `30000` |
| `FLINT_POLL_PRODUCTS_MS` | `120000` |
| `FLINT_POLL_CATEGORIES_MS` | `300000` |
| `FLINT_POLL_CUSTOMERS_MS` | `120000` |
| `FLINT_POLL_SHIPMENTS_MS` | `60000` |
| `FLINT_POLL_HEALTH_MS` | `300000` |
| `FLINT_POLL_WEBHOOKS_MS` | `30000` |
| `FLINT_POLL_DASHBOARD_MS` | `60000` |
| `FLINT_POLL_INVENTORY_MS` | `60000` |
| `FLINT_POLL_SALES_MS` | `300000` |
| `FLINT_POLL_CUSTOMER_REPORT_MS` | `300000` |

### Frontend WS/API routing (dev)

Use `.env` / `.env.example` keys:

- `VITE_API_URL` (leave empty for same-origin proxy mode)
- `VITE_PROXY_TARGET` (API proxy target)
- `VITE_WS_PROXY_TARGET` (explicit WS proxy target)
- `VITE_WS_URL` (explicit FLINT WS base)

## FLINT Realtime Resources

Server resources used by tiles:

- `flint-session`
- `flint-products`
- `flint-categories`
- `flint-orders`
- `flint-customers`
- `flint-shipments`
- `flint-data-health`
- `flint-webhooks`
- `flint-dashboard`
- `flint-inventory`
- `flint-sales`
- `flint-customer-report`

## Tiles and Behavior

### Core commerce

- `flint-auth`: sign in/out via `/api/flint/auth/login|logout`, shows session expiry.
- `flint-overview`: KPI summary; low-stock chip triggers inventory low-stock filter.
- `flint-orders`: filtering/search, expandable rows, batch status actions, hide/unhide local state, shipment/refund/status actions, opens receipt tile.
- `flint-order-receipt`: focused order receipt view with status pipeline, shipment prefill action, and status transitions.
- `flint-order-search`: UUID/email lookup and quick status transitions.

### Catalog and customers

- `flint-products`: search/status filter, inline stock edit, archive/restore, full edit/create/delete flows.
- `flint-categories`: tree view with inline rename and add-category flow.
- `flint-inventory`: flattened inventory (product + variants), low-stock toggle, open product action.
- `flint-customers`: profile/orders/addresses tabs with lazy detail fetch.
- `flint-customer-reports`: active/inactive/new KPIs with sparkline.

### Logistics and admin

- `flint-shipments`: create/update shipments, tracking lookup, quick deliver action.
- `flint-sales-chart`: compact sparkline or full bar chart with date-range command.
- `flint-data-health`: diagnostics plus destructive/admin actions with confirmation.
- `flint-stripe-sync`: manual sync runner with phase selection and elapsed timer.
- `flint-webhook-monitor`: webhook stream viewer, mark-processed action, sync trigger.

## Cross-Tile Integration (flintStore)

Cross-tile coordination no longer uses DOM custom events; it uses `flintStore` signals/actions:

- `filterOrders(...)` / `clearOrderFilter()`
- `openProduct(id)` / `clearSelectedProduct()`
- `openCustomer(id)` / `clearSelectedCustomer()`
- `filterInventory(...)` / `clearInventoryFilter()`
- `prefillShipment(...)` / `clearShipmentPrefill()`
- `triggerSync()`
- `triggerOrderRefresh()`
- `openOrderReceipt(orderId, snapshot?)`

Key interaction examples:

- Overview low-stock KPI → Inventory filter
- Inventory row action → Products drawer
- Orders customer link / search results → Customers drawer
- Orders/Receipt shipment action → Shipments create prefill
- Orders row “Full Details” → Order Receipt tile (+ auto-add if missing)
- Webhook monitor sync button → Stripe Sync runner

## Mutation and Query Surface

### WS command actions

`sendCommand()` maps to these action keys:

- `update-order-status`, `delete-order`, `refund-order`
- `create-product`, `update-product`, `delete-product`
- `create-variant`, `update-variant`
- `create-category`, `update-category`, `delete-category`
- `update-customer`
- `create-shipment`, `update-shipment`
- `sync-stripe`, `run-data-health`, `set-sales-range`

### WS query

- `queryResource('flint-order-detail', { id })` returns projected/cached enriched order detail with zero upstream call.

## HTTP API Routes

All routes are implemented in `api/providers/flint.ts` under `/api/flint/*`.

### Auth

- `POST /api/flint/auth/login`
- `POST /api/flint/auth/logout`

### Orders

- `GET /api/flint/orders/:id`
- `PUT /api/flint/orders/:id/status`
- `POST /api/flint/orders/:id/refund`
- `DELETE /api/flint/orders/:id`

### Products / categories

- `POST /api/flint/products`
- `GET /api/flint/products/:id`
- `PUT /api/flint/products/:id`
- `DELETE /api/flint/products/:id`
- `POST /api/flint/products/:id/variants`
- `PUT /api/flint/products/:productId/variants/:variantId`
- `POST /api/flint/categories`
- `PUT /api/flint/categories/:id`
- `DELETE /api/flint/categories/:id`

### Customers

- `GET /api/flint/customer-360?email=...`
- `GET /api/flint/customers?email=...|search=...`
- `GET /api/flint/customers/:id`
- `PUT /api/flint/customers/:id`
- `GET /api/flint/customers/:id/orders`
- `GET /api/flint/customers/:id/addresses`

### Logistics / admin

- `GET /api/flint/tracking/:trackingNumber`
- `POST /api/flint/shipments`
- `PUT /api/flint/shipments/:id`
- `POST /api/flint/admin/sync-stripe?phase=...`
- `POST /api/flint/admin/data-health?action=...`
- `POST /api/flint/sales-range`
- `GET /api/flint/queue/status`

## Notes

- Webhook events are maintained in a local ring buffer (max 50), deduped by event id, cache-backed as `flint-webhooks`.
- Provider refreshes broadcast to both WS and SSE so fallback mode remains live.
- `flint-orders` detail responses enrich product/customer names from local projections before returning.
