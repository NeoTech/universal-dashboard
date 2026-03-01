# SSE Channels & Data Flow

## How `get_tile_data` resolves channels

The `get_tile_data` tool looks up cached SSE data by channel name. It uses a 3-step lookup:

1. **Exact match** — use the `channel` param as-is against the SSE cache
2. **Tile ID match** — for client-side tiles (rest, websocket, custom-api, graphql), pass the tile's UUID as `channel`
3. **Provider channel** — for SSE-based tiles, use the channel name from the table below

## Channel Name Exceptions

Most tile types map directly to their type name as the SSE channel (e.g. `stripe-payments` → channel `stripe-payments`). These 8 types have **different** channel names:

| Tile Type | SSE Channel |
|---|---|
| `github-actions` | `github-runs` |
| `cloudflare-pages` | `cf-pages` |
| `cloudflare-functions` | `cf-functions` |
| `vercel-deployments` | `vercel-deploys` |
| `netlify-deployments` | `netlify-deploys` |
| `circleci-pipelines` | `circleci-builds` |
| `dockerhub-repositories` | `dockerhub-repos` |
| `dockerhub-tags` | `dockerhub-tags` |

## Ephemeral SSE Events

### `tile-op`
Broadcast when any MCP tool mutates tile state (add/remove/update). Payload:

```json
{
  "op": "add" | "remove" | "update",
  "workspace": "dashboard-1",
  "tile": { ... }
}
```

### `remove-dashboard`
Broadcast when a dashboard is deleted via MCP. Payload:

```json
{
  "workspace": "dashboard-xyz"
}
```

## Client-Side Tiles

Generic tiles (`rest`, `websocket`, `custom-api`, `graphql`, `rss-feed`) fetch data client-side, not via SSE pollers. Their data is reported back by tile UUID. To read their data with `get_tile_data`, pass the tile's UUID as the `channel` parameter.
