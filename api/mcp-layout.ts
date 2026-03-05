/**
 * MCP layout helpers — read/write per-user tile layouts from auth.db.
 *
 * Intentionally kept as a standalone module (no imports from server.ts)
 * to avoid circular dependencies. Broadcasting (broadcastSse) is handled
 * by the caller in server.ts.
 */

import { authDb } from './db.ts';

const stmtGetLayout = authDb.prepare<{ tiles_json: string }, [number, string]>(
  'SELECT tiles_json FROM tile_layouts WHERE user_id = ? AND workspace = ?',
);
const stmtUpsertLayout = authDb.prepare<void, [number, string, string, number]>(
  'INSERT INTO tile_layouts (user_id, workspace, tiles_json, updated_at) VALUES (?, ?, ?, ?) ' +
  'ON CONFLICT(user_id, workspace) DO UPDATE SET tiles_json=excluded.tiles_json, updated_at=excluded.updated_at',
);

/**
 * Return the tile layout for a given user + workspace from the `tile_layouts`
 * table in `auth.db`.
 *
 * Each element in the returned array is a plain tile object matching the shape
 * stored by {@link writeLayout}, e.g.:
 * ```json
 * { "id": "<uuid>", "type": "stripe-payments", "x": 8, "y": 8, "w": 400, "h": 300 }
 * ```
 *
 * Falls back to an empty array when:
 * - no row exists yet for the `userId`/`workspace` pair, or
 * - the stored JSON is unparseable.
 *
 * @param userId   - The authenticated user's numeric ID from `auth.db`.
 * @param workspace - The workspace (dashboard) name, e.g. `"dashboard-1"`.
 * @returns An array of tile objects (possibly empty). The caller should treat
 *          each element as `Record<string, unknown>` and narrow types as needed.
 */
export function readLayout(userId: number, workspace: string): unknown[] {
  const row = stmtGetLayout.get(userId, workspace);
  if (!row) return [];
  try { return JSON.parse(row.tiles_json) as unknown[]; } catch { return []; }
}

/**
 * Return the list of workspace names that have a saved layout for `userId`,
 * ordered by most-recently updated first.
 *
 * @param userId - The authenticated user's numeric ID from `auth.db`.
 * @returns An array of workspace name strings, possibly empty.
 */
export function listWorkspaces(userId: number): string[] {
  const rows = authDb.prepare<{ workspace: string }, [number]>(
    'SELECT workspace FROM tile_layouts WHERE user_id = ? ORDER BY updated_at DESC',
  ).all(userId);
  return rows.map((r: { workspace: string }) => r.workspace);
}

const REDDIT_TILE_TYPES = new Set(['reddit-posts', 'reddit-hot-posts', 'reddit-keyword-monitor']);

/**
 * Scan every tile layout row in the DB and return the de-duped union of all
 * `subreddits` values configured on Reddit tiles across all users and workspaces.
 * This is called at poll time so the server always fetches exactly what the
 * tiles need — no REDDIT_SUBREDDITS env variable required.
 */
export function getAllRedditSubreddits(): string[] {
  const rows = authDb.prepare<{ tiles_json: string }, []>(
    'SELECT tiles_json FROM tile_layouts',
  ).all();
  const seen = new Set<string>();
  for (const row of rows) {
    let tiles: unknown[];
    try { tiles = JSON.parse(row.tiles_json) as unknown[]; } catch { continue; }
    for (const tile of tiles) {
      const t = tile as Record<string, unknown>;
      if (!REDDIT_TILE_TYPES.has(t['type'] as string)) continue;
      const raw = t['subreddits'];
      if (typeof raw !== 'string' || !raw.trim()) continue;
      for (const sub of raw.split(',').map(s => s.trim()).filter(Boolean)) {
        seen.add(sub.toLowerCase());
      }
    }
  }
  return [...seen];
}

/**
 * Return the maximum `fetchLimit` configured on any Reddit tile in the DB.
 * The server uses this to decide how many posts to fetch per subreddit.
 * Returns 0 when no tile has a fetchLimit set (meaning "all available").
 */
export function getRedditMaxFetchLimit(): number {
  const rows = authDb.prepare<{ tiles_json: string }, []>(
    'SELECT tiles_json FROM tile_layouts',
  ).all();
  let max = 0;
  for (const row of rows) {
    let tiles: unknown[];
    try { tiles = JSON.parse(row.tiles_json) as unknown[]; } catch { continue; }
    for (const tile of tiles) {
      const t = tile as Record<string, unknown>;
      if (!REDDIT_TILE_TYPES.has(t['type'] as string)) continue;
      const fl = t['fetchLimit'];
      if (typeof fl === 'number' && fl > max) max = fl;
    }
  }
  return max;
}

/**
 * Persist a tile layout for a given user + workspace into the `tile_layouts`
 * table in `auth.db`.
 *
 * Uses an **upsert** — if a row already exists for the `userId`/`workspace`
 * pair it is overwritten; otherwise a new row is inserted. The `tiles` array
 * is serialised to JSON and stored in the `tiles_json` column. `updated_at`
 * is set to the current Unix epoch (seconds).
 *
 * @param userId    - The authenticated user's numeric ID from `auth.db`.
 * @param workspace - The workspace (dashboard) name, e.g. `"dashboard-1"`.
 * @param tiles     - Full replacement tile array. The entire column is
 *                    overwritten; callers must read ({@link readLayout}),
 *                    mutate, and then write back.
 */
export function writeLayout(userId: number, workspace: string, tiles: unknown[]): void {
  stmtUpsertLayout.run(userId, workspace, JSON.stringify(tiles), Math.floor(Date.now() / 1000));
}

// ── Tile-aware polling helpers ────────────────────────────────────────────────

/**
 * Maps SSE channel names to the tile type(s) that consume them.
 *
 * Only non-identity mappings are listed here — channels whose SSE event name
 * differs from the tile `type` string, or where multiple tile types share a
 * single broadcast channel.  For all other channels the tile type equals the
 * channel name and no entry is needed.
 *
 * Exported so `server.ts` can build the reverse look-up (`tileTypeToChannel`)
 * without duplicating the data, and so `hasActiveTiles()` can resolve a
 * channel to the full set of consuming tile types.
 *
 * @example
 * // 'hibp-breaches' channel is consumed by two different tile types:
 * CHANNEL_TO_TILE_TYPES['hibp-breaches'] // ['hibp-breach-status', 'hibp-recent-breaches']
 */
export const CHANNEL_TO_TILE_TYPES: Record<string, string[]> = {
  'github-runs':         ['github-actions'],
  'cf-pages':            ['cloudflare-pages'],
  'cf-workers':          ['cloudflare-functions'],
  'paypal-data':         ['paypal-transactions'],
  'coingecko-markets':   ['coingecko-prices'],
  'hibp-breaches':       ['hibp-breach-status', 'hibp-recent-breaches'],
  'plaid-accounts':      ['plaid-balances'],
  'shodan-search':       ['shodan-exposed-services', 'shodan-vuln-summary'],
  'virustotal-analyses': ['virustotal-domain-threats', 'virustotal-url-scan'],
  'hn-top-stories':      ['hn-top-stories', 'hn-mentions'],
  'reddit-posts':        ['reddit-posts', 'reddit-hot-posts', 'reddit-keyword-monitor'],
  // FLINT / LOPC e-commerce
  'flint-session':         ['flint-auth'],
  'flint-dashboard':       ['flint-overview'],
  'flint-sales':           ['flint-sales-chart'],
  'flint-customer-report': ['flint-customer-reports'],
  'flint-webhooks':        ['flint-webhook-monitor'],
};

const stmtAllLayouts = authDb.prepare<{ tiles_json: string }, []>(
  'SELECT tiles_json FROM tile_layouts',
);

/**
 * Return `true` if at least one tile that consumes `channel` exists in any
 * workspace across all users in the database.
 *
 * ### How it works
 * 1. Looks up the set of tile type strings for `channel` via
 *    {@link CHANNEL_TO_TILE_TYPES}.  Falls back to `[channel]` when no
 *    explicit mapping exists (identity channels).
 * 2. Scans every `tile_layouts` row in SQLite, parses the JSON array, and
 *    checks whether any tile's `type` field is in that set.
 * 3. Short-circuits on the first match for performance.
 *
 * ### Why it exists
 * The poll loop calls this before making an external API request.  When no
 * user has the corresponding tile on any dashboard, the fetch is skipped
 * entirely — saving bandwidth and API quota while the server is otherwise
 * running normally.
 *
 * @param channel - The SSE event / channel name (e.g. `'github-runs'`).
 * @returns `true` if a consuming tile was found; `false` if the channel has
 *   no active tiles and the poll can be safely skipped.
 */
export function hasActiveTiles(channel: string): boolean {
  const types = CHANNEL_TO_TILE_TYPES[channel] ?? [channel];
  const typeSet = new Set(types);
  for (const row of stmtAllLayouts.all()) {
    let tiles: unknown[];
    try { tiles = JSON.parse(row.tiles_json) as unknown[]; } catch { continue; }
    for (const tile of tiles) {
      const t = tile as Record<string, unknown>;
      if (typeSet.has(t['type'] as string)) return true;
    }
  }
  return false;
}
