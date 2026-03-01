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
 * Return the tile layout for a given user + workspace.
 * Falls back to an empty array if no layout has been saved yet.
 */
export function readLayout(userId: number, workspace: string): unknown[] {
  const row = stmtGetLayout.get(userId, workspace);
  if (!row) return [];
  try { return JSON.parse(row.tiles_json) as unknown[]; } catch { return []; }
}

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
 * Persist a tile layout for a given user + workspace.
 */
export function writeLayout(userId: number, workspace: string, tiles: unknown[]): void {
  stmtUpsertLayout.run(userId, workspace, JSON.stringify(tiles), Math.floor(Date.now() / 1000));
}
