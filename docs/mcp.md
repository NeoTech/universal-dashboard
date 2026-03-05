# MCP Tool Reference

The TWM server exposes a [Model Context Protocol](https://spec.modelcontextprotocol.io/) (MCP) endpoint at `/api/mcp`. All communication follows JSON-RPC 2.0 over Server-Sent Events (SSE).

## Contents

- [Authentication](#authentication)
- [Tool Reference](#tool-reference)
  - [add_tile](#add_tile)
  - [remove_tile](#remove_tile)
  - [update_tile](#update_tile)
  - [get_tile_data](#get_tile_data)
  - [list_tiles](#list_tiles)
  - [list_workspaces](#list_workspaces)
  - [remove_dashboard](#remove_dashboard)
  - [reload_env](#reload_env)
- [Config Sub-Key Nesting (add_tile)](#config-sub-key-nesting)
- [Example Workflow](#example-workflow)

---

## Authentication

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `MCP_ENABLED` | `false` | Must be `true` to activate the `/api/mcp` endpoint. |
| `MCP_AUTH_REQUIRED` | inherits `AUTH_ENABLED` | When `true`, all **write** tools require a valid JWT. |

### Read vs. write tools

| Category | Tools | Auth required (when `MCP_AUTH_REQUIRED=true`) |
|---|---|---|
| Read | `list_tiles`, `list_workspaces`, `get_tile_data` | No |
| Write | `add_tile`, `remove_tile`, `update_tile`, `reload_env`, `remove_dashboard` | Yes |

### Passing a JWT

Obtain a token from `POST /api/auth/login` and pass it in the `Authorization` header when establishing the SSE connection:

```
Authorization: Bearer <your-jwt-token>
```

Without a valid token, write tool calls return:

```json
{ "error": { "code": -32001, "message": "Unauthorized — provide a JWT via Authorization: Bearer <token>" } }
```

---

## Tool Reference

### add_tile

Appends a new tile to a dashboard. The tile is broadcast to all connected browsers via SSE and persisted to `auth.db` for authenticated users.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `type` | `string` | Yes | Tile type identifier, e.g. `"stripe-payments"`, `"rest"`, `"rss-feed"`. |
| `config` | `object` | No | Provider-specific configuration. See [Config Sub-Key Nesting](#config-sub-key-nesting). |
| `x` | `number` | No | Grid column offset (snapped to 16 px grid). Default: `8`. |
| `y` | `number` | No | Grid row offset (snapped to 16 px grid). Default: `8`. |
| `w` | `number` | No | Width in pixels (snapped to 16 px grid). Default: `400`. |
| `h` | `number` | No | Height in pixels (snapped to 16 px grid). Default: `300`. |
| `workspace` | `string` | No | Target workspace name. Default: `"dashboard-1"`. |

**Returns**

```json
{
  "ok": true,
  "tile": {
    "id": "<uuid>",
    "type": "<type>",
    "x": 8,
    "y": 8,
    "w": 400,
    "h": 300
  }
}
```

**Example — provider tile (no config needed)**

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_tile",
    "arguments": {
      "type": "stripe-payments",
      "workspace": "dashboard-1",
      "x": 16,
      "y": 16,
      "w": 480,
      "h": 320
    }
  }
}
```

**Example — REST tile**

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_tile",
    "arguments": {
      "type": "rest",
      "config": {
        "url": "https://api.example.com/status",
        "method": "GET",
        "headers": { "Accept": "application/json" },
        "interval": 30000
      },
      "workspace": "dashboard-1"
    }
  }
}
```

**Example — Reddit keyword monitor**

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_tile",
    "arguments": {
      "type": "reddit-keyword-monitor",
      "config": {
        "subreddits": "MachineLearning,LocalLLaMA",
        "keywords": "RAG,fine-tuning"
      },
      "workspace": "dashboard-1"
    }
  }
}
```

---

### remove_tile

Removes a single tile from a workspace dashboard by its UUID. The removal is broadcast via SSE and persisted for authenticated users.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | UUID of the tile to remove. Obtain from `list_tiles`. |
| `workspace` | `string` | No | Workspace name. Default: `"dashboard-1"`. |

**Returns**

```json
{ "ok": true }
```

**Example**

```json
{
  "method": "tools/call",
  "params": {
    "name": "remove_tile",
    "arguments": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "workspace": "dashboard-1"
    }
  }
}
```

---

### update_tile

Merges a patch object into an existing tile. Fields in `patch` overwrite the matching top-level keys on the tile; all other fields are preserved. The change is broadcast via SSE and persisted for authenticated users.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | Yes | UUID of the tile to update. |
| `patch` | `object` | Yes | Key/value pairs to merge into the tile (shallow merge). |
| `workspace` | `string` | No | Workspace name. Default: `"dashboard-1"`. |

**Returns**

```json
{ "ok": true }
```

**Example — resize a tile**

```json
{
  "method": "tools/call",
  "params": {
    "name": "update_tile",
    "arguments": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "patch": { "w": 640, "h": 480 },
      "workspace": "dashboard-1"
    }
  }
}
```

**Example — change Reddit subreddits**

```json
{
  "method": "tools/call",
  "params": {
    "name": "update_tile",
    "arguments": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "patch": { "subreddits": "golang,rust,zig" }
    }
  }
}
```

---

### get_tile_data

Returns the latest data for a given SSE channel or tile UUID. Uses a three-step lookup:

1. **SSE resource cache** — data populated by server-side pollers (provider tiles like `stripe-payments`, `github-actions`, etc.). Pass the channel name.
2. **Live REST fetch** — when `channel` is a UUID and the tile has a `rest.url`, the server fetches the URL directly and caches the result.
3. **Null fallback** — returned when neither of the above yields data (e.g. client-side-only tile types like WebSocket or GraphQL that require the browser to report data).

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `channel` | `string` | Yes | SSE channel name (e.g. `"stripe-payments"`) or tile UUID (for REST tiles). |
| `workspace` | `string` | No | Workspace name (only used for UUID lookup). Default: `"dashboard-1"`. |

**Returns**

```json
{
  "channel": "<channel>",
  "data": { /* latest cached payload, or null */ }
}
```

**Example — provider tile by channel name**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tile_data",
    "arguments": {
      "channel": "stripe-payments"
    }
  }
}
```

**Example — REST tile by UUID**

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tile_data",
    "arguments": {
      "channel": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "workspace": "dashboard-1"
    }
  }
}
```

---

### list_tiles

Returns the tiles currently saved in `auth.db` for the authenticated user. When `workspace` is omitted, all workspaces are returned grouped by name.

> **Note:** Read tools always work; authentication is only required for write tools.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `workspace` | `string` | No | Workspace name. Omit to get tiles from all workspaces. |

**Returns (single workspace)**

```json
[
  { "id": "<uuid>", "type": "stripe-payments", "x": 16, "y": 16, "w": 480, "h": 320 }
]
```

**Returns (all workspaces)**

```json
{
  "dashboard-1": [ /* tiles */ ],
  "dashboard-2": [ /* tiles */ ]
}
```

**Example**

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_tiles",
    "arguments": {
      "workspace": "dashboard-1"
    }
  }
}
```

---

### list_workspaces

Returns all workspace (dashboard) names that have a saved layout for the current user, ordered by most-recently updated first.

**Parameters**

None.

**Returns**

```json
["dashboard-1", "dashboard-1772333880068"]
```

**Example**

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_workspaces",
    "arguments": {}
  }
}
```

---

### remove_dashboard

Deletes an entire workspace and all its tiles from `auth.db`. Also broadcasts a `remove-dashboard` SSE event to connected browsers. This action is **irreversible**.

**Parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `workspace` | `string` | Yes | Name of the workspace to delete. |

**Returns**

```json
{ "ok": true, "removed": "dashboard-1772333880068" }
```

**Example**

```json
{
  "method": "tools/call",
  "params": {
    "name": "remove_dashboard",
    "arguments": {
      "workspace": "dashboard-1772333880068"
    }
  }
}
```

---

### reload_env

Reads the server's `.env` file, applies any changed values to `process.env`, and returns the list of keys that were updated. This lets you rotate API keys or toggle feature flags without restarting the server.

**Parameters**

None.

**Returns**

```json
{ "ok": true, "reloaded": ["STRIPE_SECRET_KEY", "GITHUB_TOKEN"] }
```

`reloaded` is an empty array when no values changed.

**Example**

```json
{
  "method": "tools/call",
  "params": {
    "name": "reload_env",
    "arguments": {}
  }
}
```

---

## Config Sub-Key Nesting

When calling `add_tile`, the `config` object you pass is **automatically nested** under the correct sub-key so the tile renderer can find it. You always pass a flat `config` — the server handles the nesting.

| Tile type | Sub-key applied | Resulting shape |
|---|---|---|
| `rest` | `rest` | `tile.rest = { url, method, headers, interval }` |
| `websocket` | `ws` | `tile.ws = { url, maxMessages, fields, chartField }` |
| `custom-api` | `customApi` | `tile.customApi = { ... }` |
| `graphql` | `graphql` | `tile.graphql = { url, query, variables, headers }` |
| `rss-feed` | `rss` | `tile.rss = { url, maxItems }` |
| Provider tiles (e.g. `stripe-payments`, `github-actions`) | *(none)* | Config fields spread flat onto the tile root |

### REST tile config fields

| Field | Type | Description |
|---|---|---|
| `url` | `string` | Endpoint URL to fetch. |
| `method` | `string` | HTTP method. Default: `"GET"`. |
| `headers` | `object` | Key/value request headers. |
| `interval` | `number` | Refresh interval in milliseconds. |

### WebSocket tile config fields

| Field | Type | Description |
|---|---|---|
| `url` | `string` | WebSocket URL to connect to. |
| `maxMessages` | `number` | Maximum messages to buffer. |
| `fields` | `string[]` | Fields to extract from each message. |
| `chartField` | `string` | Field to plot on the chart. |

### Reddit tile config fields

Reddit tile types (`reddit-posts`, `reddit-hot-posts`, `reddit-keyword-monitor`) are provider tiles and do **not** use a sub-key. Pass config fields flat:

| Field | Type | Description |
|---|---|---|
| `subreddits` | `string` | Comma-separated subreddit names, e.g. `"MachineLearning,LocalLLaMA"`. |
| `keywords` | `string` | Comma-separated filter terms (for `reddit-keyword-monitor` only). |
| `fetchLimit` | `number` | Maximum posts to fetch per subreddit. |

---

## Example Workflow

Add a Stripe payments tile to `dashboard-1`, then verify it was added.

### Step 1 — list_workspaces

Confirm the target workspace exists:

```json
{
  "method": "tools/call",
  "params": { "name": "list_workspaces", "arguments": {} }
}
```

Response:

```json
{ "content": [{ "type": "text", "text": "[\"dashboard-1\"]" }] }
```

### Step 2 — add_tile

```json
{
  "method": "tools/call",
  "params": {
    "name": "add_tile",
    "arguments": {
      "type": "stripe-payments",
      "workspace": "dashboard-1",
      "x": 16,
      "y": 16,
      "w": 480,
      "h": 320
    }
  }
}
```

Response:

```json
{
  "content": [{
    "type": "text",
    "text": "{\n  \"ok\": true,\n  \"tile\": {\n    \"id\": \"a1b2c3d4-e5f6-7890-abcd-ef1234567890\",\n    \"type\": \"stripe-payments\",\n    \"x\": 16,\n    \"y\": 16,\n    \"w\": 480,\n    \"h\": 320\n  }\n}"
  }]
}
```

### Step 3 — list_tiles

Verify the tile was saved:

```json
{
  "method": "tools/call",
  "params": {
    "name": "list_tiles",
    "arguments": { "workspace": "dashboard-1" }
  }
}
```

Expected: the array contains the new tile with `"type": "stripe-payments"`.

### Step 4 — get_tile_data

Check that the server has polled Stripe data:

```json
{
  "method": "tools/call",
  "params": {
    "name": "get_tile_data",
    "arguments": { "channel": "stripe-payments" }
  }
}
```

Response shape: `{ "channel": "stripe-payments", "data": { /* Stripe payload */ } }`.

### Step 5 — cleanup (optional)

Remove the tile when done testing:

```json
{
  "method": "tools/call",
  "params": {
    "name": "remove_tile",
    "arguments": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "workspace": "dashboard-1"
    }
  }
}
```
