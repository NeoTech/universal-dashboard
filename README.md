# Tiling Window Manager Dashboard

A developer dashboard built with SolidJS + Bun that aggregates data from dozens of API providers into a customisable tiled layout.

## Quick start

```bash
bun install
cp .env.example .env   # fill in your API keys
bun run dev            # Vite frontend on :8080 + API server on :3001
```

## Agent / MCP access

The server exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint so LLM agents (Claude Desktop, Cursor, Copilot Chat, etc.) can read and control the dashboard.

### Enabling MCP

Add to your `.env`:

```env
MCP_ENABLED=true
# Optional: require a JWT to call mutating tools (defaults to AUTH_ENABLED)
# MCP_AUTH_REQUIRED=true
```

Restart the API server (`bun run api`). The endpoint is now live at:

| Transport | URL |
|-----------|-----|
| HTTP (single request) | `POST http://localhost:3001/api/mcp` |
| SSE (streaming notifications) | `GET  http://localhost:3001/api/mcp` |

### Connecting Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "twm": {
      "command": "curl",
      "args": ["-s", "-N", "-X", "GET", "http://localhost:3001/api/mcp"]
    }
  }
}
```

For auth-enabled deployments, add `"-H", "Authorization: Bearer <your-jwt>"` to `args`.

### Resources

| URI | Description |
|-----|-------------|
| `dashboard://tiles` | Full tile layout array for the current user |
| `dashboard://layout` | Active SSE channels and connection statistics |

### Tools

All mutating tools are auth-gated when `MCP_AUTH_REQUIRED=true`.

| Tool | Description |
|------|-------------|
| `add_tile` | Append a new tile to the dashboard (`type`, optional `config`, `x`, `y`, `w`, `h`) |
| `remove_tile` | Remove a tile by `id` |
| `update_tile` | Merge a `patch` object into a tile by `id` |
| `reload_env` | Reload `.env` and apply updated environment variables |
| `get_tile_data` | Return the latest cached SSE data for a `channel` name |

### Prompts

| Prompt | Description |
|--------|-------------|
| `dashboard_summary` | Markdown table of all tiles (type, title, endpoint) |

### Example — list tiles via HTTP

```bash
curl -s -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"resources/read","params":{"uri":"dashboard://tiles"}}'
```

### Example — add a tile

```bash
curl -s -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "jsonrpc": "2.0", "id": 2, "method": "tools/call",
    "params": {
      "name": "add_tile",
      "arguments": { "type": "ws", "config": { "url": "wss://example.com/feed" } }
    }
  }'
```
