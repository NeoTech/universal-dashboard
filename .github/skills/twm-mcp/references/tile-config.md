# TileConfig Interface

## Core Fields

```typescript
interface TileConfig {
  id: string;           // UUID — auto-generated on add, required on update/remove
  type: string;         // One of the 139 tile types (see tile-types.md)
  x: number;            // Grid column (0-based)
  y: number;            // Grid row (0-based)
  w: number;            // Width in grid columns (default varies by type)
  h: number;            // Height in grid rows (default varies by type)
  title?: string;       // Display title (falls back to type-based default)
  refreshInterval?: number; // Override default poll interval (ms)
  config?: object;      // Provider-specific config (see below)
}
```

## Provider-Specific Config

The `config` field carries provider-specific settings. Shape depends on tile type.

### Generic Tile Sub-Configs

**REST tile** (`type: "rest"`):
```typescript
{
  url: string;            // Endpoint URL
  method?: string;        // HTTP method (default "GET")
  headers?: Record<string, string>;
  body?: string;
  interval?: number;      // Poll interval in ms
  jsonPath?: string;      // JSONPath expression to extract data
}
```

**WebSocket tile** (`type: "websocket"`):
```typescript
{
  url: string;            // WebSocket URL (ws:// or wss://)
  protocols?: string[];
  initMessage?: string;   // Message to send on connect
  jsonPath?: string;
}
```

**Custom API tile** (`type: "custom-api"`):
```typescript
{
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  interval?: number;
  jsonPath?: string;
  transform?: string;     // JS expression to transform response
}
```

**GraphQL tile** (`type: "graphql"`):
```typescript
{
  url: string;            // GraphQL endpoint
  query: string;          // GraphQL query string
  variables?: object;
  headers?: Record<string, string>;
  interval?: number;
  jsonPath?: string;
}
```

**RSS Feed tile** (`type: "rss-feed"`):
```typescript
{
  url: string;            // RSS/Atom feed URL
  maxItems?: number;      // Max items to display
  interval?: number;
}
```

### Provider Tiles

Provider tiles typically need no `config` — they use server-side API keys from env vars. Some accept optional overrides:

- **Reddit tiles**: `config.subreddit` (string) — which subreddit to monitor
- **HackerNews**: `config.query` (string) — search/mention keyword
- **npm tiles**: `config.package` (string) — package name
- **Alpha Vantage**: `config.symbol` (string) — stock ticker
- **CoinGecko**: `config.coinId` (string) — coin identifier
- **Finnhub**: `config.symbol` (string) — stock symbol

## Grid Defaults

When `x`, `y`, `w`, `h` are omitted in `add_tile`, the server applies defaults:
- `x: 0`, `y: 0` — top-left corner
- `w` and `h` — type-dependent defaults (typically `w: 4`, `h: 3`)

Tiles may overlap if positions aren't managed. Use `list_tiles` to see current layout before placing new tiles.
