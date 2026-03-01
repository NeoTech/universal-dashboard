````skill
---
name: twm-mcp
description: Comprehensive guide for using the Tiling Window Manager (TWM) MCP tools to manage dashboards, tiles, and data. Use when interacting with TWM dashboards via MCP tools like add_tile, remove_tile, update_tile, list_tiles, list_workspaces, remove_dashboard, get_tile_data, or reload_env.
---

# TWM MCP Usage Guide

Operate the TWM dashboard server through 8 MCP tools exposed at `/api/mcp` via JSON-RPC 2.0.

## Tools Quick Reference

| Tool | Purpose | Required Params |
|---|---|---|
| `add_tile` | Add a tile to a dashboard | `type` |
| `remove_tile` | Remove a tile by ID | `id` |
| `update_tile` | Patch a tile's config | `id`, `patch` |
| `list_tiles` | Get all tiles (optionally per workspace) | — |
| `list_workspaces` | Get all workspace names | — |
| `remove_dashboard` | Delete an entire workspace | `workspace` |
| `get_tile_data` | Fetch latest data for an SSE channel or tile UUID | `channel` |
| `reload_env` | Reload `.env` and apply changes | — |

## Core Concepts

- **Workspace** = dashboard. Default: `dashboard-1`. Always pass `workspace` when targeting a non-default dashboard.
- **Tile ID** = UUID string (e.g. `a1b2c3d4-...`). Get IDs from `list_tiles`.
- **Write tools** (`add_tile`, `remove_tile`, `update_tile`, `reload_env`, `remove_dashboard`) require JWT when `MCP_AUTH_REQUIRED=true`.
- **Read tools** (`list_tiles`, `list_workspaces`, `get_tile_data`) always work.
- All position/size values snap to a 16px grid. Defaults: x=8, y=8, w=400, h=300.

## Workflows

### Discover what exists
1. `list_workspaces` to see all dashboards
2. `list_tiles` (no workspace = all dashboards grouped) or `list_tiles` with `workspace` for one
3. `get_tile_data` with a channel name to see latest cached data

### Add a provider tile
```
add_tile { type: "stripe-payments", workspace: "dashboard-1" }
```
No config needed for provider tiles — they use server env vars. Optionally set `x`, `y`, `w`, `h`.

### Add a Reddit tile
```
add_tile {
  type: "reddit-keyword-monitor",
  config: { subreddits: "MachineLearning,LocalLLaMA", keywords: "RAG,fine-tuning" },
  workspace: "dashboard-1"
}
```

### Add a REST/API tile
Config is nested under the type sub-key automatically by the server:
```
add_tile {
  type: "rest",
  config: { url: "https://api.example.com/data", refreshInterval: 30000 }
}
```
Sub-key mapping: `rest` -> `tile.rest`, `websocket` -> `tile.ws`, `custom-api` -> `tile.customApi`, `graphql` -> `tile.graphql`, `rss-feed` -> `tile.rss`. Provider tiles spread flat (no sub-key).

### Update a tile
```
update_tile { id: "<uuid>", patch: { subreddits: "golang,rust", w: 600, h: 400 } }
```

### Remove a tile vs. a dashboard
- `remove_tile { id: "<uuid>" }` — removes one tile
- `remove_dashboard { workspace: "dashboard-1772333880068" }` — deletes the entire workspace and all its tiles

### Check tile data
```
get_tile_data { channel: "stripe-payments" }     // by SSE channel name
get_tile_data { channel: "<tile-uuid>" }          // by tile ID (REST tiles fetched live)
```

### After changing env vars
```
reload_env {}
```

## Important Rules

1. **Always `list_tiles` before modifying** — get fresh tile IDs, never guess UUIDs.
2. **Clean up test tiles** — after testing, `remove_tile` every tile you added. Never leave test data.
3. **One workspace param** — omit `workspace` to target `dashboard-1` (default). Always specify for other dashboards.
4. **SSE channel names** — most tiles use their type as channel. Exceptions exist (see `references/channels.md`).
5. **`get_tile_data` 3-step lookup**: (1) SSE cache by channel name, (2) live fetch for REST tiles by UUID, (3) null.
6. **No `npm`/`node`/`yarn`** — the project uses `bun` exclusively.

## Tile Types

139 tile types across 35 providers + 5 generic types. See `references/tile-types.md` for the full list.

**Most common:** `stripe-payments`, `github-actions`, `reddit-hot-posts`, `reddit-keyword-monitor`, `rest`, `rss-feed`, `coingecko-prices`, `hn-top-stories`

## References

- `references/tile-types.md` — Complete list of all 139 tile types by category
- `references/channels.md` — SSE channel name exceptions and data flow
- `references/tile-config.md` — Full TileConfig interface shape and sub-configs

````
